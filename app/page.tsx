"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const VALID_USERNAME = "oritipul";
const VALID_PASSWORD = "0547454546";

// ─── Types ────────────────────────────────────────────────────────────────────
type StyleKey    = "short" | "clinical" | "thematic";
type AppScreen   = "dashboard" | "session" | "report";
type SessionState = "idle" | "recording" | "loading" | "result";
type InputMode   = "mic" | "audio" | "image";
type ReportStep  = "upload" | "updates" | "loading" | "result";

// ─── Summary styles ───────────────────────────────────────────────────────────
const STYLE_OPTIONS: { key: StyleKey; label: string; desc: string; icon: string }[] = [
  { key: "short",    label: "סיכום נקודות קצר",  desc: "ממוקד ומהיר",        icon: "⚡" },
  { key: "clinical", label: "סיכום קליני מורחב", desc: "מפורט ומקיף",        icon: "📄" },
  { key: "thematic", label: "חלוקה לפי תמות",    desc: "תמות ונקודות להמשך", icon: "🗂️" },
];

const MOCK_SESSION: Record<StyleKey, { main: string; themes: string; next: string }> = {
  short: {
    main:   "• שיפור בשינה דווח\n• קשיים בגבולות בעבודה\n• חשש מדחייה — תמה חוזרת\n• [מטופל/ת] הביעה רצון לשינוי",
    themes: "• דחייה וגבולות\n• דפוסים מוקדמים עם דמות האב",
    next:   "• תרגיל בית: 3 סיטואציות גבול\n• לבחון קשר הצלחה–דימוי עצמי",
  },
  clinical: {
    main:   "[מטופל/ת] הגיעה לפגישה במצב רוח מעורב. דיווחה על שיפור מסוים בשינה, אך תיארה קשיים מתמשכים בניהול מערכות יחסים בסביבת העבודה. עלתה דינמיקה חוזרת של חשש מדחייה, המקושרת לדפוסים מוקדמים עם דמות האב. [מטופל/ת] הפגינה תובנה ורצון אמיתי לשינוי.",
    themes: "• דפוס חשש מדחייה — מקושר לחוויות ילדות\n• קשיים בהצבת גבולות עם קולגות\n• תחושת \"לא שייכת\" — דפוס חוזר\n• שיפור בוויסות הרגשי",
    next:   "• לעבוד על זיהוי הטריגר לתחושת הדחייה\n• תרגיל בית: 3 סיטואציות גבול\n• לבחון הצלחות מקצועיות ודימוי עצמי\n• לשקול הפניה לקבוצת תמיכה",
  },
  thematic: {
    main:   "תמה 1 — גבולות ודחייה:\nקשיים בהצבת גבולות. חשש מדחייה כתגובה לגבול.\n\nתמה 2 — דפוסים מוקדמים:\n[מטופל/ת] מזהה קישור לדינמיקה עם דמות האב.\n\nתמה 3 — משאבים:\nשיפור בשינה. רצון לשינוי — נקודת כוח.",
    themes: "תמות פעילות:\n→ דחייה וגבולות (עיקרית)\n→ דפוסים מוקדמים\n→ שייכות ומקום בקבוצה",
    next:   "לטווח קצר:\n• זיהוי טריגרים לדחייה\n\nלטווח בינוני:\n• יומן גבולות\n• בחינת הפניה לקבוצה",
  },
};

const MOCK_REPORT = {
  periodSummary: `בתקופה הנסקרת עבדה [מטופל/ת] על דפוסי קשר בין-אישיים הקשורים לחרדת נטישה ולקושי בהצבת גבולות. ניכרת התקדמות הדרגתית ביכולת הזיהוי של טריגרים לחרדה. [מטופל/ת] הצליחה ליישם כלים שנלמדו בפגישות בסיטואציות יומיומיות. מערכת הקשר הטיפולי מתפתחת ומעמיקה.`,
  progress: `• גבולות: שיפור ניכר — [מטופל/ת] דיווחה על 3 סיטואציות שהצליחה לסרב\n• ניהול חרדה: שיפור חלקי, הכלים עובדים בעצימות נמוכה\n• שינה: שיפור יציב — 6.5 שעות ממוצע לעומת 5 שעות בתחילת הטיפול`,
  themes: `• חרדת נטישה — מקושרת לדפוסי ילדות עם דמות האם\n• קושי בהצבת גבולות — עיקר העבודה הטיפולית\n• דימוי עצמי ומסוגלות — הולך ומתחזק\n• [מטופל/ת] ודמות האב — נושא שצץ לאחרונה, דורש המשך`,
  recommendations: `• להמשיך עבודה על גבולות בעצימות גבוהה\n• להעמיק בחינת הקשר עם דמות האב\n• לשקול הצגת טכניקת EMDR\n• להמשיך לחזק כלים לוויסות רגשי\n• מומלץ מפגש פעם בשבועיים בשלב הבא`,
};

// ─── Highlight utility ────────────────────────────────────────────────────────
function applyHighlights(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/(\[מטופל\/ת\]|(?:[הלבכמשוד])?מטופל(?:ת|ים|ות)?)/g,
      '<mark class="patient-mark">$1</mark>')
    .replace(/\n/g, "<br>");
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
function StopIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
}
function CopyIcon({ small }: { small?: boolean }) {
  return (
    <svg className={small ? "w-3.5 h-3.5" : "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
function CheckIcon({ small }: { small?: boolean }) {
  return (
    <svg className={small ? "w-3 h-3" : "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon({ small }: { small?: boolean }) {
  return (
    <svg className={small ? "w-4 h-4" : "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function SettingsGearIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function AudioFileIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function DocumentIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function ArrowLeftIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function useTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function WaveformBars() {
  const heights = [40, 70, 55, 85, 60, 90, 50, 75, 45, 80, 65, 55, 70, 40];
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {heights.map((h, i) => (
        <div key={i} className="w-1 rounded-full bg-sage-400 opacity-80"
          style={{ height: `${h}%`, animation: `waveBar 1.1s ease-in-out ${i * 0.07}s infinite alternate` }} />
      ))}
      <style>{`@keyframes waveBar{from{transform:scaleY(0.3);opacity:0.4}to{transform:scaleY(1);opacity:0.9}}`}</style>
    </div>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-sage-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sage-500 animate-spin-slow" />
        <div className="absolute inset-2 rounded-full bg-sage-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-sage-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="10" />
          </svg>
        </div>
      </div>
      <p className="text-sage-600 font-medium text-sm">{label ?? "מעבד…"}</p>
      <p className="text-sage-400 text-xs">אנא המתיני</p>
    </div>
  );
}

// ─── Section card (editable + highlighted preview) ────────────────────────────
function SectionCard({ title, icon, value, onChange }: {
  title: string; icon: string; value: string; onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* silent */ }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-sage-100 shadow-sm overflow-hidden animate-slide-up">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-sage-50 bg-sage-50/60">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold text-sage-700 flex-1">{title}</span>
        <button onClick={handleCopy}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200
            ${copied ? "bg-sage-500 text-white" : "bg-white border border-sage-200 text-sage-500 hover:bg-sage-50 active:scale-95"}`}>
          {copied ? <CheckIcon small /> : <CopyIcon small />}
          {copied ? "הועתק" : "העתק"}
        </button>
      </div>
      {focused ? (
        <textarea ref={taRef}
          className="w-full px-4 py-3 text-sm text-gray-700 leading-relaxed bg-transparent outline-none min-h-[100px]"
          value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => setFocused(false)} dir="rtl" />
      ) : (
        <div onClick={() => { setFocused(true); setTimeout(() => taRef.current?.focus(), 30); }}
          className="px-4 py-3 text-sm text-gray-700 leading-relaxed min-h-[100px] cursor-text"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: applyHighlights(value) || '<span class="text-gray-300">לחצי לעריכה…</span>' }} />
      )}
    </div>
  );
}

// ─── File pill ────────────────────────────────────────────────────────────────
function FilePill({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl max-w-full">
      <span className="truncate flex-1 text-xs text-sage-700">{name}</span>
      <button onClick={onRemove} className="text-sage-400 hover:text-sage-600 flex-shrink-0"><XIcon small /></button>
    </div>
  );
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────
function DropZone({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed border-sage-200 text-sage-400 hover:border-sage-400 hover:text-sage-600 hover:bg-sage-50/50 transition-all duration-200">
      {icon}
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[11px]">{sub}</span>
    </button>
  );
}

// ─── Action button row ────────────────────────────────────────────────────────
function ActionRow({ onCopyAll, allCopied, onReset }: { onCopyAll: () => void; allCopied: boolean; onReset: () => void }) {
  return (
    <div className="flex gap-3 pt-1">
      <button onClick={onCopyAll}
        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium bg-sage-500 text-white hover:bg-sage-600 shadow-sm shadow-sage-200 transition-all duration-200 active:scale-[0.97]">
        <CopyIcon />{allCopied ? "הועתק ✓" : "העתק הכל"}
      </button>
      <button onClick={onReset}
        className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-medium text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-all duration-200 active:scale-[0.97] shadow-sm">
        <TrashIcon />מחק וסגור
      </button>
    </div>
  );
}

// ─── Lock screen ──────────────────────────────────────────────────────────────
function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]   = useState("");
  const [shake, setShake]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (username.trim().toLowerCase() === VALID_USERNAME && password === VALID_PASSWORD) {
        onUnlock();
      } else {
        setShake(true); setError("שם משתמש או סיסמה שגויים"); setLoading(false);
        setTimeout(() => setShake(false), 600);
      }
    }, 400);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[#f4f7f4] to-[#fdf8f2]">
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-sage-500 flex items-center justify-center shadow-lg shadow-sage-300/40 mb-2">
          <MicIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-sage-800">חדר הטיפולים</h1>
        <p className="text-sm text-sage-400">התחברות למערכת</p>
      </div>
      <form onSubmit={handleSubmit}
        className={`w-full max-w-[320px] flex flex-col gap-4 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-sage-600 px-1">שם משתמש</label>
          <div className="bg-white/90 border border-sage-100 rounded-2xl flex items-center gap-3 px-4 py-3.5 focus-within:border-sage-400 transition-colors shadow-sm">
            <svg className="w-4 h-4 text-sage-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <input type="text" autoComplete="username" placeholder="שם משתמש" value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300" dir="ltr" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-sage-600 px-1">סיסמה</label>
          <div className="bg-white/90 border border-sage-100 rounded-2xl flex items-center gap-3 px-4 py-3.5 focus-within:border-sage-400 transition-colors shadow-sm">
            <svg className="w-4 h-4 text-sage-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="סיסמה" value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300" dir="ltr" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-sage-300 hover:text-sage-500 transition-colors">
              {showPassword
                ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
            </button>
          </div>
        </div>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button type="submit" disabled={loading || !username || !password}
          className="mt-2 py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? "מתחבר..." : "כניסה"}
        </button>
      </form>
      <div className="mt-8 flex items-center gap-1.5">
        <ShieldIcon /><p className="text-[11px] text-sage-400">גישה מוגנת — חדר הטיפולים</p>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

// ─── Settings drawer ──────────────────────────────────────────────────────────
function SettingsDrawer({ open, onClose, selected, onSelect, therapistName, onNameChange }: {
  open: boolean; onClose: () => void;
  selected: StyleKey; onSelect: (k: StyleKey) => void;
  therapistName: string; onNameChange: (n: string) => void;
}) {
  return (
    <>
      <div className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      <div className={`fixed top-0 right-0 h-full w-[80vw] max-w-[320px] z-50 flex flex-col bg-gradient-to-b from-[#f4f7f4] to-[#fdf8f2] shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ borderRadius: "0 0 0 24px" }}>
        <div className="flex items-center justify-between px-5 pt-12 pb-5 border-b border-sage-100">
          <div><h2 className="text-lg font-bold text-sage-800">הסלון</h2><p className="text-xs text-sage-400 mt-0.5">הגדרות אישיות</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/80 border border-sage-100 flex items-center justify-center text-sage-400 hover:text-sage-600 transition-colors"><XIcon /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-7">
          <div>
            <p className="text-xs text-sage-500 font-semibold tracking-wider uppercase mb-3">שם המטפל/ת</p>
            <div className="bg-white/80 rounded-2xl border border-sage-100 px-4 py-3 flex items-center gap-3">
              <span className="text-lg">👤</span>
              <input type="text" placeholder="למשל: אורית" value={therapistName} onChange={(e) => onNameChange(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300" dir="rtl" />
            </div>
            <p className="text-[11px] text-sage-300 mt-2 px-1">הכותרת תתעדכן אוטומטית</p>
          </div>
          <div>
            <p className="text-xs text-sage-500 font-semibold tracking-wider uppercase mb-3">סגנון סיכום</p>
            <div className="flex flex-col gap-3">
              {STYLE_OPTIONS.map((opt) => {
                const isActive = selected === opt.key;
                return (
                  <button key={opt.key} onClick={() => { onSelect(opt.key); onClose(); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-right transition-all duration-200 active:scale-[0.98]
                      ${isActive ? "bg-sage-500 border-sage-500 shadow-md shadow-sage-200/60" : "bg-white/80 border-sage-100 hover:border-sage-300 hover:bg-sage-50"}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${isActive ? "bg-white/20" : "bg-sage-50 border border-sage-100"}`}>{opt.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${isActive ? "text-white" : "text-sage-800"}`}>{opt.label}</p>
                      <p className={`text-xs mt-0.5 ${isActive ? "text-sage-100" : "text-sage-400"}`}>{opt.desc}</p>
                    </div>
                    {isActive && <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0"><CheckIcon /></div>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-sage-50/80 rounded-2xl border border-sage-100 p-4">
            <div className="flex items-center gap-2 mb-2"><ShieldIcon /><p className="text-xs font-semibold text-sage-700">פרטיות מלאה</p></div>
            <p className="text-[11px] text-sage-500 leading-relaxed">המידע לא נשמר בשום שרת או ענן. הכל מתבצע על המכשיר שלך בלבד ונמחק בלחיצה על "מחק וסגור".</p>
          </div>
        </div>
        <div className="h-8" />
      </div>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ therapistName, onSelect }: { therapistName: string; onSelect: (s: AppScreen) => void }) {
  const displayName = therapistName.trim();
  return (
    <div className="flex flex-col gap-6 pt-4 animate-fade-in">
      <div className="text-center">
        <p className="text-sage-500 text-sm leading-relaxed">
          {displayName ? `שלום ${displayName}, ` : ""}מה תרצי לעשות היום?
        </p>
      </div>

      {/* Card 1 — Session */}
      <button onClick={() => onSelect("session")}
        className="group w-full text-right bg-gradient-to-br from-sage-500 to-sage-600 rounded-3xl p-6 shadow-lg shadow-sage-300/40 active:scale-[0.98] transition-all duration-200 hover:shadow-xl hover:from-sage-400 hover:to-sage-500">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <MicIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight mb-1">תיעוד וסיכום פגישה טיפולית</p>
            <p className="text-sage-100 text-xs leading-relaxed">הקלטת פגישה, העלאת קובץ שמע, או סריקת מחברת — מפיק תמות ונקודות להמשך</p>
          </div>
          <ArrowLeftIcon />
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {["🎙️ הקלטה", "🎵 קובץ שמע", "📷 סריקת מחברת"].map((tag) => (
            <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full bg-white/20 text-white font-medium">{tag}</span>
          ))}
        </div>
      </button>

      {/* Card 2 — Reports */}
      <button onClick={() => onSelect("report")}
        className="group w-full text-right bg-gradient-to-br from-warm-500 to-warm-600 rounded-3xl p-6 shadow-lg shadow-warm-300/40 active:scale-[0.98] transition-all duration-200 hover:shadow-xl hover:from-warm-400 hover:to-warm-500">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <DocumentIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight mb-1">מחולל ומעדכן דוחות תקופתיים</p>
            <p className="text-warm-100 text-xs leading-relaxed">העלי דוח קודם, הוסיפי עדכונים בשמע או טקסט — מקבל דוח קליני מנוסח מחדש</p>
          </div>
          <ArrowLeftIcon />
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {["📄 דוח קיים", "🎙️ עדכוני שמע", "✏️ עדכוני טקסט"].map((tag) => (
            <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full bg-white/20 text-white font-medium">{tag}</span>
          ))}
        </div>
      </button>

      {/* Privacy note */}
      <div className="flex items-center justify-center gap-1.5">
        <ShieldIcon /><p className="text-[11px] text-sage-400">המידע לא נשמר בשרת — פרטיות מלאה</p>
      </div>
    </div>
  );
}

// ─── Session flow ─────────────────────────────────────────────────────────────
function SessionFlow({ summaryStyle, onBack }: { summaryStyle: StyleKey; onBack: () => void }) {
  const [state, setState]       = useState<SessionState>("idle");
  const [inputMode, setMode]    = useState<InputMode>("mic");
  const [summary, setSummary]   = useState({ main: "", themes: "", next: "" });
  const [label, setLabel]       = useState("מעבד…");
  const [allCopied, setAllCopied] = useState(false);
  const [file, setFile]         = useState<File | null>(null);
  const [imgPreview, setPreview] = useState<string | null>(null);
  const timerDisplay = useTimer(state === "recording");
  const loadingRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef     = useRef<HTMLInputElement>(null);
  const imageRef     = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (loadingRef.current) clearTimeout(loadingRef.current);
    setSummary({ main: "", themes: "", next: "" });
    setFile(null); setPreview(null); setAllCopied(false);
    setMode("mic"); setState("idle");
    if (audioRef.current) audioRef.current.value = "";
    if (imageRef.current) imageRef.current.value = "";
  };

  const handleMic = () => {
    if (state === "idle") { setState("recording"); }
    else if (state === "recording") {
      setLabel("מעבד הקלטה…"); setState("loading");
      loadingRef.current = setTimeout(() => { setSummary({ ...MOCK_SESSION[summaryStyle] }); setState("result"); }, 3000);
    }
  };

  const processAudio = async () => {
    if (!file) return;
    setLabel("מתמלל קובץ שמע…"); setState("loading");
    try {
      const form = new FormData(); form.append("file", file);
      const tr = await fetch("/api/transcribe", { method: "POST", body: form });
      const { text } = await tr.json();
      setLabel("מסכם פגישה…");
      const sr = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, style: summaryStyle }) });
      setSummary(await sr.json()); setState("result");
    } catch { setSummary({ ...MOCK_SESSION[summaryStyle] }); setState("result"); }
  };

  const processImage = async () => {
    if (!file) return;
    setLabel("קורא הערות מהתמונה…"); setState("loading");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dataUrl = ev.target?.result as string;
        const sr = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl.split(",")[1], mimeType: file.type, style: summaryStyle }) });
        setSummary(await sr.json()); setState("result");
      } catch { setSummary({ ...MOCK_SESSION[summaryStyle] }); setState("result"); }
    };
    reader.readAsDataURL(file);
  };

  const copyAll = async () => {
    const text = ["📋 סיכום פגישה טיפולית", "", "עיקרי הפגישה:", summary.main, "", "תמות מרכזיות:", summary.themes, "", "נקודות להמשך:", summary.next].join("\n");
    try { await navigator.clipboard.writeText(text); setAllCopied(true); setTimeout(() => setAllCopied(false), 2500); } catch { /* silent */ }
  };

  return (
    <div className="flex flex-col flex-1">
      <input ref={audioRef} type="file" accept=".mp3,.wav,.m4a,audio/*" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
      <input ref={imageRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0] ?? null; setFile(f);
        if (f) { const r = new FileReader(); r.onload = (ev) => setPreview(ev.target?.result as string); r.readAsDataURL(f); }
      }} />

      {/* Loading */}
      {state === "loading" && (
        <div className="flex flex-col items-center justify-center flex-1 py-16"><LoadingSpinner label={label} /></div>
      )}

      {/* Result */}
      {state === "result" && (
        <div className="flex flex-col gap-4 animate-slide-up">
          <div className="flex items-center gap-2 px-1">
            <span className="text-sage-400 text-xs">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</span>
            <div className="flex-1 h-px bg-sage-100" />
          </div>
          <div className="flex items-center gap-2 px-1">
            <mark className="patient-mark text-[11px]">מטופל/ת</mark>
            <span className="text-[11px] text-sage-400">— שמות הוחלפו אוטומטית. לחצי לעריכה.</span>
          </div>
          <SectionCard title="עיקרי הפגישה"  icon="📋" value={summary.main}   onChange={(v) => setSummary((s) => ({ ...s, main: v }))} />
          <SectionCard title="תמות מרכזיות"  icon="🔍" value={summary.themes} onChange={(v) => setSummary((s) => ({ ...s, themes: v }))} />
          <SectionCard title="נקודות להמשך"  icon="📌" value={summary.next}   onChange={(v) => setSummary((s) => ({ ...s, next: v }))} />
          <div className="flex items-center justify-center gap-1.5 py-1"><ShieldIcon /><p className="text-[11px] text-sage-400">המידע לא נשמר — יימחק בלחיצה על "מחק וסגור"</p></div>
          <ActionRow onCopyAll={copyAll} allCopied={allCopied} onReset={reset} />
        </div>
      )}

      {/* Idle / Recording */}
      {(state === "idle" || state === "recording") && (
        <div className="flex flex-col items-center flex-1 gap-6 py-4">
          {state === "idle" && (
            <div className="flex gap-2 bg-sage-50 rounded-2xl p-1 w-full max-w-[300px]">
              {([
                { key: "mic" as InputMode,   label: "הקלטה",   icon: <MicIcon className="w-4 h-4" /> },
                { key: "audio" as InputMode, label: "קובץ שמע", icon: <AudioFileIcon /> },
                { key: "image" as InputMode, label: "תמונה",    icon: <CameraIcon /> },
              ]).map((tab) => (
                <button key={tab.key} onClick={() => { setMode(tab.key); setFile(null); setPreview(null); }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-all duration-200
                    ${inputMode === tab.key ? "bg-white text-sage-700 shadow-sm" : "text-sage-400 hover:text-sage-600"}`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Mic */}
          {inputMode === "mic" && (
            <>
              <p className="text-sage-500 text-sm text-center max-w-[220px] leading-relaxed">
                {state === "idle" ? "לחצי על המיקרופון להתחלת הקלטה" : "ההקלטה פעילה — לחצי שוב לעצירה"}
              </p>
              <div className="relative">
                {state === "recording" && (
                  <><span className="absolute inset-0 rounded-full bg-sage-300 opacity-30 animate-ping" /><span className="absolute -inset-3 rounded-full bg-sage-200 opacity-20 animate-ping" style={{ animationDelay: "0.3s" }} /></>
                )}
                <button onClick={handleMic}
                  className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95
                    ${state === "idle" ? "bg-gradient-to-br from-sage-500 to-sage-600 text-white shadow-sage-300/50" : "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-200/60 animate-pulse-ring"}`}>
                  {state === "idle" ? <MicIcon className="w-12 h-12" /> : <StopIcon className="w-10 h-10" />}
                </button>
              </div>
              {state === "recording" && (
                <div className="flex flex-col items-center gap-3 animate-fade-in">
                  <WaveformBars />
                  <span className="text-2xl font-light tabular-nums text-sage-700 tracking-widest">{timerDisplay}</span>
                  <span className="text-[11px] text-red-400 font-medium tracking-widest uppercase animate-pulse">● מקליט</span>
                </div>
              )}
            </>
          )}

          {/* Audio file */}
          {inputMode === "audio" && state === "idle" && (
            <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
              <p className="text-sage-500 text-sm text-center leading-relaxed">העלי קובץ הקלטה לעיבוד ותמלול אוטומטי</p>
              {file ? (
                <><FilePill name={file.name} onRemove={() => { setFile(null); if (audioRef.current) audioRef.current.value = ""; }} />
                <button onClick={processAudio} className="w-full py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200">עבד קובץ שמע ←</button></>
              ) : (
                <DropZone icon={<AudioFileIcon />} label="בחרי קובץ שמע" sub="MP3, WAV, M4A" onClick={() => audioRef.current?.click()} />
              )}
            </div>
          )}

          {/* Image */}
          {inputMode === "image" && state === "idle" && (
            <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
              <p className="text-sage-500 text-sm text-center leading-relaxed">צלמי או העלי סריקת מחברת — ה-AI יקרא וישמר</p>
              {imgPreview ? (
                <><div className="relative w-full rounded-2xl overflow-hidden border border-sage-100 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgPreview} alt="תצוגה מקדימה" className="w-full object-cover max-h-44" />
                  <button onClick={() => { setFile(null); setPreview(null); if (imageRef.current) imageRef.current.value = ""; }} className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white"><XIcon small /></button>
                </div>
                <button onClick={processImage} className="w-full py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200">קרא הערות וסכם ←</button></>
              ) : (
                <DropZone icon={<CameraIcon />} label="צלמי / העלי תמונה" sub="JPG, PNG, PDF" onClick={() => imageRef.current?.click()} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Report flow ──────────────────────────────────────────────────────────────
function ReportFlow({ summaryStyle, onBack }: { summaryStyle: StyleKey; onBack: () => void }) {
  const [step, setStep]           = useState<ReportStep>("upload");
  const [oldReport, setOldReport] = useState<File | null>(null);
  const [oldPreview, setOldPreview] = useState<string | null>(null);
  const [updatesMode, setUpdatesMode] = useState<"text" | "audio">("text");
  const [updatesText, setUpdatesText] = useState("");
  const [updatesFile, setUpdatesFile] = useState<File | null>(null);
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
        body: JSON.stringify({ oldReportBase64, oldReportMime, updates: updatesText, style: summaryStyle }),
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [unlocked, setUnlocked]           = useState(false);
  const [screen, setScreen]               = useState<AppScreen>("dashboard");
  const [summaryStyle, setSummaryStyle]   = useState<StyleKey>("clinical");
  const [therapistName, setTherapistName] = useState("");
  const [settingsOpen, setSettingsOpen]   = useState(false);

  useEffect(() => {
    const style = localStorage.getItem("summaryStyle") as StyleKey | null;
    if (style && MOCK_SESSION[style]) setSummaryStyle(style);
    setTherapistName(localStorage.getItem("therapistName") || "");
    if (sessionStorage.getItem("unlocked") === "1") setUnlocked(true);
  }, []);

  const handleUnlock      = () => { sessionStorage.setItem("unlocked", "1"); setUnlocked(true); };
  const handleStyleSelect = (key: StyleKey) => { setSummaryStyle(key); localStorage.setItem("summaryStyle", key); };
  const handleNameChange  = (name: string) => { setTherapistName(name); localStorage.setItem("therapistName", name); };

  const displayTitle = therapistName.trim() ? `חדר הטיפולים של ${therapistName.trim()}` : "חדר הטיפולים";

  const screenTitle: Record<AppScreen, string> = {
    dashboard: displayTitle,
    session:   "תיעוד פגישה טיפולית",
    report:    "מחולל דוחות תקופתיים",
  };
  const activeStyle = STYLE_OPTIONS.find((s) => s.key === summaryStyle)!;

  if (!unlocked) return <LockScreen onUnlock={handleUnlock} />;

  return (
    <>
      <SettingsDrawer
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        selected={summaryStyle} onSelect={handleStyleSelect}
        therapistName={therapistName} onNameChange={handleNameChange}
      />

      <main className="min-h-dvh flex flex-col max-w-md mx-auto px-4 pb-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {screen !== "dashboard" && (
              <button onClick={() => setScreen("dashboard")}
                className="w-8 h-8 rounded-full bg-white/80 border border-sage-100 flex items-center justify-center text-sage-500 hover:bg-sage-50 transition-colors active:scale-95 flex-shrink-0">
                <BackIcon />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-sage-800 leading-tight truncate">{screenTitle[screen]}</h1>
              <p className="text-[11px] text-sage-400 tracking-wider mt-0.5">סיכום פגישות טיפוליות</p>
            </div>
          </div>
          <button onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-white/80 border border-sage-100 shadow-sm flex items-center justify-center text-sage-500 hover:bg-sage-50 transition-colors active:scale-95 flex-shrink-0 mr-2">
            <SettingsGearIcon />
          </button>
        </header>

        {/* ── Badges ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-100 border border-warm-200 text-warm-700 text-[10px] font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-warm-400 animate-pulse" />מצב הדגמה
          </span>
          {screen !== "dashboard" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-50 border border-sage-200 text-sage-600 text-[10px] font-medium">
              {activeStyle.icon} {activeStyle.label}
            </span>
          )}
        </div>

        {/* ── Screens ───────────────────────────────────────────────────── */}
        {screen === "dashboard" && (
          <Dashboard therapistName={therapistName} onSelect={setScreen} />
        )}
        {screen === "session" && (
          <SessionFlow summaryStyle={summaryStyle} onBack={() => setScreen("dashboard")} />
        )}
        {screen === "report" && (
          <ReportFlow summaryStyle={summaryStyle} onBack={() => setScreen("dashboard")} />
        )}
      </main>
    </>
  );
}
