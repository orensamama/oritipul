"use client";

import { useState, useRef } from "react";
import type { ReportSection } from "../lib/types";
import { loadHistory } from "../lib/storage";
import {
  MicIcon, StopIcon, ShieldIcon, SparkleIcon,
  CheckIcon, DownloadIcon, UploadIcon,
} from "./icons";
import { LoadingSpinner, SectionCard, FilePill, ActionRow } from "./shared";

const PATIENT_TOKEN = "[מטופל/ת]";
const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB — matches the server-side guard

type BuilderStep = "form" | "loading" | "result";

// Phone-camera photos are routinely 5-10MB; downscaling + re-compressing
// client-side keeps the request well under serverless payload limits and
// speeds up the round-trip, without touching accuracy for a document scan.
async function compressImageToBase64(file: File, maxDim = 1600, quality = 0.82): Promise<{ base64: string; mime: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("file read failed"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("image decode failed"));
    im.src = dataUrl;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { base64: dataUrl.split(",")[1], mime: file.type || "image/jpeg" };
  ctx.drawImage(img, 0, 0, width, height);
  const outDataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: outDataUrl.split(",")[1], mime: "image/jpeg" };
}

export default function ReportBuilder() {
  const [stepState, setStepState] = useState<BuilderStep>("form");
  const [loadingLabel, setLoadingLabel] = useState("מייצר דוח…");

  // ── (a) report type ────────────────────────────────────────────────────
  const [reportType, setReportType] = useState("");
  const [typeRecording, setTypeRecording] = useState(false);
  const [typeTranscribing, setTypeTranscribing] = useState(false);
  const typeStreamRef = useRef<MediaStream | null>(null);
  const typeRecorderRef = useRef<MediaRecorder | null>(null);
  const typeChunksRef = useRef<Blob[]>([]);

  // ── (b) sample document — deleted from memory right after structure extraction ──
  const [sampleName, setSampleName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [structure, setStructure] = useState<unknown | null>(null);
  const [structureLabel, setStructureLabel] = useState<string>("");
  const sampleInputRef = useRef<HTMLInputElement>(null);

  // ── (c) guidelines + current session content ───────────────────────────
  const [guidelines, setGuidelines] = useState("");
  const [content, setContent] = useState("");

  // ── result ───────────────────────────────────────────────────────────
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [patientName, setPatientName] = useState("");
  const [allCopied, setAllCopied] = useState(false);
  const [genError, setGenError] = useState("");

  const getBestMimeType = () => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  };

  // ── record report-type phrase ───────────────────────────────────────────
  const startTypeRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      typeStreamRef.current = stream; typeChunksRef.current = [];
      const mimeType = getBestMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data?.size > 0) typeChunksRef.current.push(e.data); };
      mr.start(250); typeRecorderRef.current = mr; setTypeRecording(true);
    } catch { /* mic unavailable — user can type instead */ }
  };

  const stopTypeRecording = async () => {
    const mr = typeRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    typeStreamRef.current?.getTracks().forEach((t) => t.stop());
    typeStreamRef.current = null; typeRecorderRef.current = null;
    setTypeRecording(false);

    const mimeType = getBestMimeType() || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(typeChunksRef.current, { type: mimeType });
    typeChunksRef.current = [];
    setTypeTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, `report-type.${ext}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (res.ok) {
        const { text } = await res.json();
        setReportType((prev) => (prev ? `${prev} ${text}` : text));
      }
    } catch { /* silent — user can still type */ }
    setTypeTranscribing(false);
  };

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
        body: JSON.stringify({ sampleBase64: base64, sampleMime: mime, sampleName: f.name, reportType }),
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

  // ── generate ─────────────────────────────────────────────────────────
  const generate = async () => {
    setGenError(""); setLoadingLabel("מלביש את התוכן במבנה שנלמד…"); setStepState("loading");
    try {
      const res = await fetch("/api/report-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structure, reportType, guidelines, content }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSections(data.sections ?? []);
      setStepState("result");
    } catch {
      setGenError("שגיאה בייצור הדוח. נסי שוב.");
      setStepState("form");
    }
  };

  const displayValue = (raw: string) =>
    patientName.trim() ? raw.split(PATIENT_TOKEN).join(patientName.trim()) : raw;

  const buildFinalText = () => {
    const lines = ["✨ דוח מותאם אישית", reportType ? `סוג דוח: ${reportType}` : "", ""];
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
    setStepState("form"); setReportType(""); removeSample(); setGuidelines(""); setContent("");
    setSections([]); setPatientName(""); setAllCopied(false); setGenError("");
  };

  const canGenerate = (reportType.trim() || structure || guidelines.trim() || content.trim()) && !extracting;

  // ── Render ───────────────────────────────────────────────────────────
  if (stepState === "loading") {
    return <div className="flex flex-col items-center justify-center flex-1 py-16"><LoadingSpinner label={loadingLabel} /></div>;
  }

  if (stepState === "result") {
    return (
      <div className="flex flex-col gap-4 animate-slide-up">
        <div className="flex items-center gap-2 px-1">
          <span className="text-sage-400 text-xs">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</span>
          <div className="flex-1 h-px bg-sage-100" />
          <span className="text-sage-300 text-[10px]">✨ דוח מותאם אישית{reportType ? ` — ${reportType}` : ""}</span>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔏</span>
            <p className="text-xs font-semibold text-purple-800">שם המטופל/ת לצורך הטבעה בטקסט</p>
          </div>
          <input type="text" placeholder="השם יוטבע רק בטקסט המוצג/מיוצא — לא נשלח ל-AI" value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="bg-white/80 border border-purple-200 rounded-xl px-3 py-2 text-sm text-purple-900 outline-none focus:border-purple-400 transition-colors placeholder:text-purple-300" dir="rtl" />
          <p className="text-[10px] text-purple-500">ברירת מחדל: "{PATIENT_TOKEN}" בכל מקום בטקסט</p>
        </div>

        {sections.map((sec, i) => (
          <SectionCard key={i} title={sec.heading} icon="📄"
            value={displayValue(sec.content)}
            onChange={(v) => setSections((s) => s.map((x, idx) => (idx === i ? { ...x, content: v } : x)))} />
        ))}

        <div className="flex items-center justify-center gap-1.5 py-1">
          <ShieldIcon /><p className="text-[11px] text-sage-400">קובץ הדוגמה לא נשמר בשום שלב — נעשה בו שימוש לחילוץ מבנה בלבד ונמחק מיד</p>
        </div>

        <ActionRow onCopyAll={copyAll} allCopied={allCopied} onReset={reset} />
        <button onClick={download}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-sage-600 bg-white border border-sage-200 hover:bg-sage-50 transition-all duration-200 active:scale-[0.97]">
          <DownloadIcon />הורד כקובץ
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-4 animate-fade-in">
      <input ref={sampleInputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSampleFile(f); }} />

      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1"><SparkleIcon /><p className="text-xs font-semibold text-purple-800">מחולל דוחות מותאם אישית</p></div>
        <p className="text-[11px] text-purple-600 leading-relaxed">העלי דוגמת מסמך ללימוד המבנה, הוסיפי הנחיות, והמערכת תלביש בו את הפגישה הנוכחית</p>
      </div>

      {/* (a) report type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-sage-600 px-1">סוג הדוח</label>
        <div className="bg-white/80 border border-sage-100 rounded-2xl flex items-center gap-2 px-4 py-3 shadow-sm focus-within:border-sage-400 transition-colors">
          <input type="text" placeholder='למשל: "סיכום ביניים", "בקשה להמשך טיפול", "דוח לוועדה"' value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300" dir="rtl" />
          <button onClick={typeRecording ? stopTypeRecording : startTypeRecording} disabled={typeTranscribing}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95
              ${typeRecording ? "bg-red-500 text-white animate-pulse" : "bg-sage-50 text-sage-500 hover:bg-sage-100"}`}>
            {typeTranscribing ? <div className="w-3.5 h-3.5 rounded-full border-2 border-sage-300 border-t-sage-600 animate-spin" />
              : typeRecording ? <StopIcon className="w-3.5 h-3.5" /> : <MicIcon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* (b) sample upload */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-sage-600 px-1">דוגמת מסמך / תבנית קודמת</label>
        {sampleName ? (
          <div className="flex flex-col gap-2">
            <FilePill name={sampleName} onRemove={removeSample} />
            {extracting && (
              <div className="flex items-center gap-2 px-3 py-2 bg-sage-50 border border-sage-100 rounded-xl">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-sage-300 border-t-sage-600 animate-spin" />
                <span className="text-xs text-sage-500">מזהה מבנה ומוחק את הקובץ מהזיכרון…</span>
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

      {/* (c) guidelines */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-sage-600 px-1">הנחיות ודגשים למטפלת</label>
        <textarea
          className="w-full bg-white/80 border border-sage-100 rounded-2xl px-4 py-3 text-sm text-gray-700 leading-relaxed outline-none focus:border-sage-400 transition-colors min-h-[90px] shadow-sm"
          placeholder='למשל: "להתמקד בתפקוד הרגשי, שפה קלינית רשמית, להתייחס לתמות מהמפגש"'
          value={guidelines} onChange={(e) => setGuidelines(e.target.value)} dir="rtl" />
      </div>

      {/* content to weave in */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <label className="text-xs font-semibold text-sage-600">תוכן הפגישה / התקופה הנוכחית</label>
          <button onClick={importLastSession} className="text-[11px] text-sage-500 hover:text-sage-700 underline underline-offset-2">
            ייבא מסיכום אחרון
          </button>
        </div>
        <textarea
          className="w-full bg-white/80 border border-sage-100 rounded-2xl px-4 py-3 text-sm text-gray-700 leading-relaxed outline-none focus:border-sage-400 transition-colors min-h-[110px] shadow-sm"
          placeholder="הדביקי כאן תמלול, תמות או סיכום מהפגישה הנוכחית — זה יילקח לכתיבת הדוח"
          value={content} onChange={(e) => setContent(e.target.value)} dir="rtl" />
      </div>

      {genError && <p className="text-red-400 text-xs text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2">{genError}</p>}

      <button onClick={generate} disabled={!canGenerate}
        className="w-full py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-purple-200/60 hover:from-purple-400 hover:to-indigo-500 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        <SparkleIcon />צרי דוח מותאם אישית
      </button>

      <div className="flex items-center justify-center gap-1.5">
        <ShieldIcon /><p className="text-[11px] text-sage-400">קובץ הדוגמה אינו נשמר במסד נתונים או ב-LocalStorage בשום שלב</p>
      </div>
    </div>
  );
}
