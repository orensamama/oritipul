"use client";

import { useState, useRef } from "react";
import type { StyleKey, ReportStep } from "../lib/types";
import { MOCK_REPORT } from "../lib/constants";
import { MicIcon, StopIcon, DocumentIcon, XIcon, ShieldIcon } from "./icons";
import { LoadingSpinner, WaveformBars, SectionCard, FilePill, DropZone, ActionRow, useTimer } from "./shared";

export default function ReportFlow({ summaryStyle }: { summaryStyle: StyleKey }) {
  const [step, setStep]           = useState<ReportStep>("upload");
  const [oldReport, setOldReport] = useState<File | null>(null);
  const [oldPreview, setOldPreview] = useState<string | null>(null);
  const [updatesMode, setUpdatesMode] = useState<"text" | "audio">("text");
  const [updatesText, setUpdatesText] = useState("");
  const [, setUpdatesFile] = useState<File | null>(null);
  // Optional — used only client-side for display, and server-side purely to
  // scrub a leaked real name from the AI response. Never sent as prompt content.
  const [knownPatientName, setKnownPatientName] = useState("");
  const [recording, setRecording] = useState(false);
  const [label, setLabel]         = useState("מייצר דוח…");
  const [result, setResult]       = useState({ periodSummary: "", progress: "", themes: "", recommendations: "" });
  const [allCopied, setAllCopied] = useState(false);
  const timerDisplay = useTimer(recording);
  const loadingRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportRef    = useRef<HTMLInputElement>(null);
  const audioRef     = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (loadingRef.current) clearTimeout(loadingRef.current);
    setOldReport(null); setOldPreview(null); setUpdatesText(""); setUpdatesFile(null);
    setKnownPatientName("");
    setRecording(false); setAllCopied(false); setStep("upload");
    if (reportRef.current) reportRef.current.value = "";
    if (audioRef.current) audioRef.current.value = "";
  };

  const handleOldReport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null; setOldReport(f);
    if (f && f.type.startsWith("image/")) {
      const r = new FileReader(); r.onload = (ev) => setOldPreview(ev.target?.result as string); r.readAsDataURL(f);
    } else if (f) { setOldPreview(null); }
  };

  const handleMicUpdate = () => {
    if (!recording) { setRecording(true); }
    else {
      setRecording(false);
      setUpdatesText((prev) => prev + (prev ? "\n" : "") + "[הקלטה קולית שתומלל בעת החיבור ל-AI]");
    }
  };

  const processReport = async () => {
    setLabel("מנתח דוח קיים…"); setStep("loading");
    try {
      let oldReportBase64: string | undefined;
      let oldReportMime: string | undefined;
      if (oldReport) {
        const r = new FileReader();
        await new Promise<void>((res) => { r.onload = (ev) => { const d = ev.target?.result as string; oldReportBase64 = d.split(",")[1]; oldReportMime = oldReport.type; res(); }; r.readAsDataURL(oldReport); });
      }
      setLabel("מייצר דוח מעודכן…");
      const res = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldReportBase64, oldReportMime, updates: updatesText, style: summaryStyle, knownPatientName }),
      });
      setResult(await res.json()); setStep("result");
    } catch { setResult({ ...MOCK_REPORT }); setStep("result"); }
  };

  const copyAll = async () => {
    const text = ["📊 דוח תקופתי מעודכן", "", "סיכום תקופתי:", result.periodSummary, "", "התקדמות ויעדים:", result.progress, "", "תמות עיקריות:", result.themes, "", "המלצות להמשך:", result.recommendations].join("\n");
    try { await navigator.clipboard.writeText(text); setAllCopied(true); setTimeout(() => setAllCopied(false), 2500); } catch { /* silent */ }
  };

  return (
    <div className="flex flex-col flex-1">
      <input ref={reportRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleOldReport} />
      <input ref={audioRef}  type="file" accept=".mp3,.wav,.m4a,audio/*" className="hidden"
        onChange={(e) => { setUpdatesFile(e.target.files?.[0] ?? null); }} />

      {/* Loading */}
      {step === "loading" && (
        <div className="flex flex-col items-center justify-center flex-1 py-16"><LoadingSpinner label={label} /></div>
      )}

      {/* Result */}
      {step === "result" && (
        <div className="flex flex-col gap-4 animate-slide-up">
          <div className="flex items-center gap-2 px-1">
            <span className="text-sage-400 text-xs">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</span>
            <div className="flex-1 h-px bg-sage-100" />
            <span className="text-sage-300 text-[10px]">📊 דוח תקופתי</span>
          </div>
          <div className="flex items-center gap-2 px-1">
            <mark className="patient-mark text-[11px]">מטופל/ת</mark>
            <span className="text-[11px] text-sage-400">— שמות הוחלפו אוטומטית. לחצי לעריכה.</span>
          </div>
          <SectionCard title="סיכום תקופתי"     icon="📊" value={result.periodSummary}  onChange={(v) => setResult((s) => ({ ...s, periodSummary: v }))} />
          <SectionCard title="התקדמות ויעדים"   icon="📈" value={result.progress}        onChange={(v) => setResult((s) => ({ ...s, progress: v }))} />
          <SectionCard title="תמות עיקריות"     icon="🔍" value={result.themes}          onChange={(v) => setResult((s) => ({ ...s, themes: v }))} />
          <SectionCard title="המלצות להמשך"     icon="📌" value={result.recommendations} onChange={(v) => setResult((s) => ({ ...s, recommendations: v }))} />
          <div className="flex items-center justify-center gap-1.5 py-1"><ShieldIcon /><p className="text-[11px] text-sage-400">המידע לא נשמר — יימחק בלחיצה על "מחק וסגור"</p></div>
          <ActionRow onCopyAll={copyAll} allCopied={allCopied} onReset={reset} />
        </div>
      )}

      {/* Step: upload old report */}
      {step === "upload" && (
        <div className="flex flex-col gap-5 py-4 animate-fade-in">
          <div className="bg-warm-50 border border-warm-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-warm-700 mb-1">שלב 1 — דוח קיים</p>
            <p className="text-[11px] text-warm-600 leading-relaxed">העלי את הדוח התקופתי הקודם (תמונה, סריקה, או PDF)</p>
          </div>
          {oldReport ? (
            <div className="flex flex-col gap-3">
              {oldPreview && (
                <div className="relative w-full rounded-2xl overflow-hidden border border-sage-100 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={oldPreview} alt="דוח קיים" className="w-full object-cover max-h-44" />
                  <button onClick={() => { setOldReport(null); setOldPreview(null); if (reportRef.current) reportRef.current.value = ""; }} className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white"><XIcon small /></button>
                </div>
              )}
              {!oldPreview && <FilePill name={oldReport.name} onRemove={() => { setOldReport(null); if (reportRef.current) reportRef.current.value = ""; }} />}
              <button onClick={() => setStep("updates")} className="w-full py-4 rounded-2xl bg-warm-500 text-white font-semibold text-sm shadow-md hover:bg-warm-600 active:scale-[0.98] transition-all duration-200">
                המשך להוספת עדכונים ←
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <DropZone icon={<DocumentIcon />} label="העלי דוח קיים" sub="תמונה, סריקה, PDF" onClick={() => reportRef.current?.click()} />
              <button onClick={() => setStep("updates")} className="text-sage-400 text-sm text-center underline underline-offset-2 hover:text-sage-600 transition-colors">
                המשך ללא דוח קיים
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: add updates */}
      {step === "updates" && (
        <div className="flex flex-col gap-5 py-4 animate-fade-in">
          <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-sage-700 mb-1">שלב 2 — עדכונים חדשים</p>
            <p className="text-[11px] text-sage-600 leading-relaxed">הקליטי או כתבי את העדכונים מאז הדוח האחרון</p>
          </div>

          {/* Optional safety-net name — never sent as prompt content */}
          <div className="bg-sage-50/60 border border-sage-100 rounded-2xl p-3 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-sage-600 px-0.5">שם המטופל/ת (אופציונלי)</label>
            <input type="text" placeholder="לרשת ביטחון בלבד — לא נשלח כתוכן ל-AI" value={knownPatientName}
              onChange={(e) => setKnownPatientName(e.target.value)}
              className="bg-white/80 border border-sage-200 rounded-xl px-3 py-2 text-xs text-sage-800 outline-none focus:border-sage-400 transition-colors placeholder:text-sage-300" dir="rtl" />
            <p className="text-[10px] text-sage-400 leading-relaxed">משמש רק כרשת ביטחון בשרת שמוחקת אוטומטית כל הופעה של השם בתשובת ה-AI — לעולם אינו נכלל בהנחיה שנשלחת אליה.</p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 bg-sage-50 rounded-2xl p-1">
            {([{ key: "text" as const, label: "✏️ הקלדה" }, { key: "audio" as const, label: "🎙️ הקלטה" }]).map((m) => (
              <button key={m.key} onClick={() => setUpdatesMode(m.key)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${updatesMode === m.key ? "bg-white text-sage-700 shadow-sm" : "text-sage-400 hover:text-sage-600"}`}>
                {m.label}
              </button>
            ))}
          </div>

          {updatesMode === "text" && (
            <textarea
              className="w-full bg-white/80 border border-sage-100 rounded-2xl px-4 py-3 text-sm text-gray-700 leading-relaxed outline-none focus:border-sage-400 transition-colors min-h-[140px] shadow-sm"
              placeholder="כתבי כאן את העדכונים שלך — מה השתנה מאז הדוח הקודם, אירועים משמעותיים, יעדים חדשים…"
              value={updatesText} onChange={(e) => setUpdatesText(e.target.value)} dir="rtl"
            />
          )}

          {updatesMode === "audio" && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                {recording && <><span className="absolute inset-0 rounded-full bg-red-300 opacity-30 animate-ping" /></>}
                <button onClick={handleMicUpdate}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95
                    ${recording ? "bg-gradient-to-br from-red-500 to-rose-600 text-white" : "bg-gradient-to-br from-sage-500 to-sage-600 text-white"}`}>
                  {recording ? <StopIcon className="w-8 h-8" /> : <MicIcon className="w-8 h-8" />}
                </button>
              </div>
              {recording ? (
                <div className="flex flex-col items-center gap-2"><WaveformBars />
                  <span className="text-lg font-light tabular-nums text-sage-700 tracking-widest">{timerDisplay}</span>
                  <span className="text-[11px] text-red-400 font-medium animate-pulse">● מקליט</span>
                </div>
              ) : updatesText ? (
                <div className="bg-sage-50 border border-sage-200 rounded-xl px-3 py-2 w-full text-xs text-sage-600 text-center">{updatesText}</div>
              ) : (
                <p className="text-sage-400 text-xs text-center">לחצי להקליט עדכונים קוליים</p>
              )}
            </div>
          )}

          <button onClick={processReport}
            className="w-full py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200">
            🪄 ייצר דוח מעודכן
          </button>
          <button onClick={() => setStep("upload")} className="text-sage-400 text-sm text-center hover:text-sage-600 transition-colors">
            ← חזור
          </button>
        </div>
      )}
    </div>
  );
}
