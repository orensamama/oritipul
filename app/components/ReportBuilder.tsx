"use client";

import { useState, useRef } from "react";
import type { ReportSection, ReportTemplateKey } from "../lib/types";
import { loadHistory } from "../lib/storage";
import { REPORT_TEMPLATES } from "../lib/constants";
import { compressImageToBase64 } from "../lib/image";
import {
  ShieldIcon, SparkleIcon, CheckIcon, DownloadIcon, UploadIcon,
} from "./icons";
import { LoadingSpinner, SectionCard, FilePill, ActionRow } from "./shared";
import VoiceFileTextarea from "./VoiceFileTextarea";

const PATIENT_TOKEN = "[מטופל/ת]";
const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB — matches the server-side guard

type BuilderStep = "form" | "loading" | "draft";

export default function ReportBuilder({ therapistName, therapistTitle, therapistLicense, therapistFramework }: {
  therapistName?: string; therapistTitle?: string; therapistLicense?: string; therapistFramework?: string;
}) {
  const [stepState, setStepState] = useState<BuilderStep>("form");
  const [loadingLabel, setLoadingLabel] = useState("מייצר דוח…");

  // ── (a) report template ──────────────────────────────────────────────
  const [reportTemplate, setReportTemplate] = useState<ReportTemplateKey | "">("");

  // ── (b) sample document — deleted from memory right after structure extraction ──
  // Not used for the rigid "extension" template, which has a fixed structure.
  const [sampleName, setSampleName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [structure, setStructure] = useState<unknown | null>(null);
  const [structureLabel, setStructureLabel] = useState<string>("");
  const sampleInputRef = useRef<HTMLInputElement>(null);

  // ── (c) guidelines + current-period content + treatment history ─────────
  const [guidelines, setGuidelines] = useState("");
  const [content, setContent] = useState("");
  const [history, setHistory] = useState("");

  // ── draft / clarifications (chat-in-the-loop) ───────────────────────────
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState("");
  const [approved, setApproved] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [allCopied, setAllCopied] = useState(false);
  const [genError, setGenError] = useState("");

  // ── sample upload → extract structure → immediately discard the file ───
  const handleSampleFile = async (f: File) => {
    setExtractError(""); setSampleName(f.name); setStructure(null); setStructureLabel("");

    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (isPdf && f.size > MAX_PDF_BYTES) {
      setExtractError(
        `קובץ ה-PDF גדול מדי (כ-${Math.round(f.size / (1024 * 1024))}MB). נא להעלות קובץ עד 8MB, או להעלות אותו כתמונה/סריקה במקום.`
      );
      if (sampleInputRef.current) sampleInputRef.current.value = "";
      return;
    }

    setExtracting(true);
    try {
      let base64: string; let mime: string;
      if (isPdf) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error("file read failed"));
          r.readAsDataURL(f);
        });
        base64 = dataUrl.split(",")[1]; mime = f.type || "application/pdf";
      } else {
        const compressed = await compressImageToBase64(f);
        base64 = compressed.base64; mime = compressed.mime;
      }

      const res = await fetch("/api/report-builder/extract-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleBase64: base64, sampleMime: mime, sampleName: f.name, reportType: reportTemplate, knownPatientName: patientName }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || "שגיאה בזיהוי מבנה הדוגמה. ניתן לנסות שוב או להמשיך ללא תבנית.");
      }

      const data = await res.json();
      setStructure(data.structure);
      const secs = (data.structure?.sections as { heading: string }[] | undefined) ?? [];
      setStructureLabel(
        secs.length ? `${secs.length} סעיפים זוהו: ${secs.map((s) => s.heading).join(" • ")}` : "מבנה זוהה בהצלחה"
      );
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "שגיאה בזיהוי מבנה הדוגמה. ניתן לנסות שוב או להמשיך ללא תבנית.");
    } finally {
      // Privacy: the sample file's content is discarded from memory the instant
      // structure extraction finishes (or fails) — only the filename label remains.
      setExtracting(false);
      if (sampleInputRef.current) sampleInputRef.current.value = "";
    }
  };

  const removeSample = () => {
    setSampleName(null); setStructure(null); setStructureLabel(""); setExtractError("");
    if (sampleInputRef.current) sampleInputRef.current.value = "";
  };

  // ── import last session summary into content field ──────────────────────
  const importLastSession = () => {
    const last = loadHistory()[0];
    if (!last) return;
    const plain = (s: string) => s.replace(/\[\[([^\]]+)\]\]/g, "$1");
    const text = [
      `תאריך: ${last.sessionDate}`,
      "סיכום רשמי:", plain(last.summary.official),
      "תמות:", plain(last.summary.themes),
      "תובנות:", plain(last.summary.insights),
    ].join("\n");
    setContent((prev) => (prev ? `${prev}\n\n${text}` : text));
  };

  // ── generate (initial) / update draft (iteration with clarifications) ───
  const runGenerate = async (iteration: boolean) => {
    setGenError("");
    setLoadingLabel(iteration ? "מעדכנת את הטיוטה לפי התשובות שלך…" : "סורקת את התוכן וההיסטוריה ומכינה טיוטה ראשונה…");
    setStepState("loading");
    try {
      const res = await fetch("/api/report-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structure, reportTemplate, guidelines, content, history,
          therapistName, therapistTitle, therapistLicense, therapistFramework,
          // Never part of the guidance/content the AI drafts from — used only
          // server-side, after the AI responds, to deterministically scrub any
          // residual real name from the returned text. See app/lib/anonymize.ts.
          knownPatientName: patientName,
          ...(iteration ? { previousDraft: sections, clarificationAnswers } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSections(data.sections ?? []);
      setClarifications(Array.isArray(data.clarifications) ? data.clarifications : []);
      setClarificationAnswers("");
      setApproved(false);
      setStepState("draft");
    } catch {
      setGenError(iteration ? "שגיאה בעדכון הטיוטה. נסי שוב." : "שגיאה בייצור הדוח. נסי שוב.");
      setStepState("draft");
    }
  };

  const displayValue = (raw: string) =>
    patientName.trim() ? raw.split(PATIENT_TOKEN).join(patientName.trim()) : raw;

  const buildFinalText = () => {
    const templateLabel = REPORT_TEMPLATES.find((t) => t.key === reportTemplate)?.label ?? "";
    const lines = ["✨ דוח מותאם אישית", templateLabel ? `סוג דוח: ${templateLabel}` : "", ""];
    for (const sec of sections) lines.push(sec.heading, "────────────────────", displayValue(sec.content), "");
    return lines.join("\n");
  };

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(buildFinalText()); setAllCopied(true); setTimeout(() => setAllCopied(false), 2500); }
    catch { /* silent */ }
  };

  const download = () => {
    const blob = new Blob(["﻿" + buildFinalText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `דוח-מותאם-אישית-${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStepState("form"); setReportTemplate(""); removeSample(); setGuidelines(""); setContent(""); setHistory("");
    setSections([]); setClarifications([]); setClarificationAnswers(""); setApproved(false);
    setPatientName(""); setAllCopied(false); setGenError("");
  };

  const canGenerate = Boolean(reportTemplate) && (guidelines.trim() || content.trim() || history.trim() || structure) && !extracting;

  // ── Render ───────────────────────────────────────────────────────────
  if (stepState === "loading") {
    return <div className="flex flex-col items-center justify-center flex-1 py-16"><LoadingSpinner label={loadingLabel} /></div>;
  }

  if (stepState === "draft") {
    const templateLabel = REPORT_TEMPLATES.find((t) => t.key === reportTemplate)?.label ?? "";
    return (
      <div className="flex flex-col gap-4 animate-slide-up">
        <div className="flex items-center gap-2 px-1">
          <span className="text-sage-400 text-xs">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</span>
          <div className="flex-1 h-px bg-sage-100" />
          <span className="text-sage-300 text-[10px]">✨ {approved ? "דוח מוכן לייצוא" : "טיוטה"}{templateLabel ? ` — ${templateLabel}` : ""}</span>
        </div>

        {genError && <p className="text-red-400 text-xs text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2">{genError}</p>}

        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔏</span>
            <p className="text-xs font-semibold text-purple-800">שם המטופל/ת לצורך הטבעה בטקסט</p>
          </div>
          <input type="text" placeholder="למילוי בטקסט המוצג/מיוצא בלבד, ולניקוי בטיחות אוטומטי" value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="bg-white/80 border border-purple-200 rounded-xl px-3 py-2 text-sm text-purple-900 outline-none focus:border-purple-400 transition-colors placeholder:text-purple-300" dir="rtl" />
          <p className="text-[10px] text-purple-500">ברירת מחדל: "{PATIENT_TOKEN}" בכל מקום בטקסט — השם לעולם לא נכלל בהנחיה שנשלחת ל-AI</p>
        </div>

        {sections.map((sec, i) => (
          <SectionCard key={i} title={sec.heading} icon="📄"
            value={displayValue(sec.content)}
            onChange={(v) => setSections((s) => s.map((x, idx) => (idx === i ? { ...x, content: v } : x)))} />
        ))}

        {!approved && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">❓</span>
              <p className="text-xs font-semibold text-amber-800">תיבת הבהרות קליניות</p>
            </div>
            {clarifications.length > 0 ? (
              <ul className="flex flex-col gap-1.5 pr-1">
                {clarifications.map((c, i) => (
                  <li key={i} className="text-xs text-amber-800 leading-relaxed flex gap-1.5">
                    <span className="flex-shrink-0">•</span><span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-amber-700 leading-relaxed">אין הבהרות נוספות כרגע — ניתן להוסיף פרטים ולעדכן את הטיוטה, או לאשר את הדוח.</p>
            )}
            <VoiceFileTextarea
              label="תשובות / השלמות (טקסט, קול או קובץ)"
              placeholder="השלימי כאן בנקודות את התשובות להבהרות שלמעלה — או הקליטי/העלי קובץ"
              value={clarificationAnswers} onChange={setClarificationAnswers}
              knownPatientName={patientName}
            />
            <button onClick={() => runGenerate(true)} disabled={!clarificationAnswers.trim()}
              className="w-full py-3 rounded-2xl bg-amber-500 text-white font-semibold text-sm shadow-sm hover:bg-amber-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
              🔄 עדכן טיוטה
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 py-1">
          <ShieldIcon /><p className="text-[11px] text-sage-400">קובץ הדוגמה לא נשמר בשום שלב — נעשה בו שימוש לחילוץ מבנה בלבד ונמחק מיד</p>
        </div>

        {!approved ? (
          <button onClick={() => setApproved(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-purple-200/60 hover:from-purple-400 hover:to-indigo-500 active:scale-[0.98] transition-all duration-200">
            <CheckIcon />הדוח מוכן — אשרי לייצוא
          </button>
        ) : (
          <>
            <button onClick={() => setApproved(false)} className="text-sage-400 text-xs text-center hover:text-sage-600 transition-colors">
              ← חזרה לעריכת הטיוטה
            </button>
            <ActionRow onCopyAll={copyAll} allCopied={allCopied} onReset={reset} />
            <button onClick={download}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-sage-600 bg-white border border-sage-200 hover:bg-sage-50 transition-all duration-200 active:scale-[0.97]">
              <DownloadIcon />הורד כקובץ
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-4 animate-fade-in">
      <input ref={sampleInputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSampleFile(f); }} />

      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1"><SparkleIcon /><p className="text-xs font-semibold text-purple-800">מחולל דוחות מותאם אישית</p></div>
        <p className="text-[11px] text-purple-600 leading-relaxed">בחרי סוג דוח, הוסיפי תוכן והנחיות — תקבלי טיוטה, תוכלי להשלים הבהרות, ורק אז לאשר ולייצא</p>
      </div>

      {/* Patient name — optional, local safety net only (see below) */}
      <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔏</span>
          <p className="text-xs font-semibold text-purple-800">שם המטופל/ת (אופציונלי)</p>
        </div>
        <input type="text" placeholder="למילוי בטקסט המוצג/מיוצא בלבד, ולניקוי בטיחות אוטומטי" value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          className="bg-white/80 border border-purple-200 rounded-xl px-3 py-2 text-sm text-purple-900 outline-none focus:border-purple-400 transition-colors placeholder:text-purple-300" dir="rtl" />
        <p className="text-[10px] text-purple-500 leading-relaxed">
          השם לעולם אינו נכלל בהנחיה שנשלחת ל-AI. הוא משמש רק (1) בדפדפן שלך, כדי להטביע אותו במקום
          "{PATIENT_TOKEN}" בטקסט המוצג/מועתק/מיוצא, ו-(2) כרשת ביטחון בשרת שמוחקת אוטומטית כל הופעה שלו
          אם בטעות "דלף" לתוך תשובת ה-AI — ולא לשום מטרה אחרת.
        </p>
      </div>

      {/* (a) report template */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-sage-600 px-1">סוג הדוח</label>
        <select value={reportTemplate} onChange={(e) => setReportTemplate(e.target.value as ReportTemplateKey)}
          className="w-full bg-white/80 border border-sage-100 rounded-2xl px-4 py-3 text-sm text-sage-800 outline-none focus:border-sage-400 transition-colors shadow-sm" dir="rtl">
          <option value="" disabled>בחרי סוג דוח…</option>
          {REPORT_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {reportTemplate && (
          <p className="text-[11px] text-sage-400 px-1">{REPORT_TEMPLATES.find((t) => t.key === reportTemplate)?.desc}</p>
        )}
      </div>

      {/* (b) sample upload — not used for the rigid extension template */}
      {reportTemplate === "extension" ? (
        <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4">
          <p className="text-[11px] text-sage-500 leading-relaxed">סוג דוח זה משתמש במבנה קבוע ומובנה (הנדון, 4 פסקאות וסיום חתום) — אין צורך בדוגמת מסמך.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-sage-600 px-1">דוגמת מסמך / תבנית קודמת (אופציונלי)</label>
          {sampleName ? (
            <div className="flex flex-col gap-2">
              <FilePill name={sampleName} onRemove={removeSample} />
              {extracting && (
                <div className="flex items-center gap-2 px-3 py-2 bg-sage-50 border border-sage-100 rounded-xl">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-sage-300 border-t-sage-600 animate-spin" />
                  <span className="text-xs text-sage-500">מזהה מבנה ומוחקת את הקובץ מהזיכרון…</span>
                </div>
              )}
              {!extracting && structureLabel && (
                <div className="flex items-start gap-2 px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl">
                  <span className="text-sage-500 flex-shrink-0 mt-0.5"><CheckIcon small /></span>
                  <span className="text-[11px] text-sage-600 leading-relaxed">{structureLabel}</span>
                </div>
              )}
              {extractError && <p className="text-red-400 text-[11px] px-1">{extractError}</p>}
            </div>
          ) : (
            <button onClick={() => sampleInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-6 rounded-2xl border-2 border-dashed border-sage-200 text-sage-400 hover:border-sage-400 hover:text-sage-600 hover:bg-sage-50/50 transition-all duration-200">
              <UploadIcon />
              <span className="text-sm font-medium">העלי דוגמת מסמך (אופציונלי)</span>
              <span className="text-[11px]">תמונה / סריקה / PDF — ישמש רק לחילוץ מבנה וימחק מיד</span>
            </button>
          )}
        </div>
      )}

      {/* (c) guidelines */}
      <VoiceFileTextarea
        label="הנחיות ודגשים למטפלת"
        placeholder='למשל: "להתמקד בתפקוד הרגשי, שפה קלינית רשמית, להתייחס לתמות מהמפגש"'
        value={guidelines} onChange={setGuidelines}
        knownPatientName={patientName}
      />

      {/* current-period content */}
      <VoiceFileTextarea
        label="תוכן הפגישה / התקופה הנוכחית"
        placeholder="הדביקי כאן תמלול, תמות או סיכום מהפגישה הנוכחית — או השתמשי בכפתורים למעלה"
        value={content} onChange={setContent}
        hint="🎙️ הקלטה • 📎 תמונה/PDF • 📋 הדבקת שמע מהלוח — הכל מתומלל/מחולץ ועובר אנונימיזציה אוטומטית, שום קובץ לא נשמר"
        extraAction={
          <button onClick={importLastSession} className="text-[11px] text-sage-500 hover:text-sage-700 underline underline-offset-2">
            ייבא מסיכום אחרון
          </button>
        }
        knownPatientName={patientName}
      />

      {/* treatment history */}
      <VoiceFileTextarea
        label="היסטוריית טיפול / גיליון רפואי / סיכומים קודמים"
        placeholder="הדביקי כאן היסטוריית טיפול, גיליון רפואי או סיכומים קודמים — או השתמשי בכפתורים למעלה להקלטה/העלאת קובץ/הדבקת שמע"
        value={history} onChange={setHistory}
        hint="🎙️ הקלטה • 📎 תמונה/PDF • 📋 הדבקת שמע מהלוח — ניתן לשלב עם טקסט מודבק, הכל נסרק יחד בעת הפקת הדוח"
        knownPatientName={patientName}
      />

      {genError && <p className="text-red-400 text-xs text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2">{genError}</p>}

      <button onClick={() => runGenerate(false)} disabled={!canGenerate}
        className="w-full py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-purple-200/60 hover:from-purple-400 hover:to-indigo-500 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        <SparkleIcon />צרי טיוטת דוח
      </button>

      <div className="flex items-center justify-center gap-1.5">
        <ShieldIcon /><p className="text-[11px] text-sage-400">קובץ הדוגמה אינו נשמר במסד נתונים או ב-LocalStorage בשום שלב</p>
      </div>
    </div>
  );
}
