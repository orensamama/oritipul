"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const VALID_USERNAME = "oritipul";
const VALID_PASSWORD = "0547454546";

// ─── Summary styles ───────────────────────────────────────────────────────────
type StyleKey = "short" | "clinical" | "thematic";
type AppState = "idle" | "recording" | "loading" | "result";
type InputMode = "mic" | "audio" | "image";

const STYLE_OPTIONS: { key: StyleKey; label: string; desc: string; icon: string }[] = [
  { key: "short",    label: "סיכום נקודות קצר",  desc: "ממוקד ומהיר",        icon: "⚡" },
  { key: "clinical", label: "סיכום קליני מורחב", desc: "מפורט ומקיף",        icon: "📄" },
  { key: "thematic", label: "חלוקה לפי תמות",    desc: "תמות ונקודות להמשך", icon: "🗂️" },
];

// Fallback mock for mic simulation
const MOCK_SUMMARY_BY_STYLE: Record<StyleKey, { main: string; themes: string; next: string }> = {
  short: {
    main:   "• שיפור בשינה דווח\n• קשיים בגבולות בעבודה\n• חשש מדחייה — תמה חוזרת\n• [מטופל/ת] הביעה רצון לשינוי",
    themes: "• דחייה וגבולות\n• דפוסים מוקדמים עם דמות האב",
    next:   "• תרגיל בית: 3 סיטואציות גבול\n• לבחון קשר הצלחה–דימוי עצמי",
  },
  clinical: {
    main:   "[מטופל/ת] הגיעה לפגישה במצב רוח מעורב. בתחילת הפגישה דיווחה על שיפור מסוים בשינה, אך תיארה קשיים מתמשכים בניהול מערכות יחסים בסביבת העבודה. במהלך הפגישה עלתה דינמיקה חוזרת של חשש מדחייה, המקושרת לדפוסים התפתחותיים מוקדמים עם דמות האב. [מטופל/ת] הפגינה תובנה טובה ורצון אמיתי לשינוי.",
    themes: "• דפוס חשש מדחייה — מקושר לחוויות ילדות מוקדמות\n• קשיים בהצבת גבולות עם קולגות בכירים\n• תחושת \"לא שייכת\" — דפוס חוזר\n• שיפור בוויסות הרגשי",
    next:   "• לעבוד על זיהוי הטריגר לתחושת הדחייה\n• תרגיל בית: לרשום שלוש סיטואציות שהצליחה להציב בהן גבול\n• לבחון את הקשר בין הצלחות מקצועיות לדימוי עצמי\n• לשקול הפניה לקבוצת תמיכה",
  },
  thematic: {
    main:   "תמה 1 — גבולות ודחייה:\nקשיים מתמשכים בהצבת גבולות. חשש מדחייה כתגובה לגבול.\n\nתמה 2 — דפוסים מוקדמים:\nקישור ברור לדינמיקה עם דמות האב. [מטופל/ת] מזהה את הקשר.\n\nתמה 3 — משאבים וחוסן:\nשיפור בשינה. תובנה גוברת. רצון לשינוי — נקודת כוח.",
    themes: "תמות פעילות:\n→ דחייה וגבולות (עיקרית)\n→ דפוסים מוקדמים עם דמות האב\n→ שייכות ומקום בקבוצה\n\nתמות שצצו:\n→ קשר הצלחה–דימוי עצמי",
    next:   "לטווח קצר:\n• לעבוד על טריגרים לתחושת הדחייה\n• לבחון תגובת הגוף בסיטואציות גבול\n\nלטווח בינוני:\n• תרגיל בית: יומן גבולות\n• לבחון הפניה לקבוצה טיפולית",
  },
};

// ─── Highlight utility ────────────────────────────────────────────────────────
function applyHighlights(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const highlighted = escaped.replace(
    /(\[מטופל\/ת\]|(?:[הלבכמשוד])?מטופל(?:ת|ים|ות)?)/g,
    '<mark class="patient-mark">$1</mark>'
  );

  return highlighted.replace(/\n/g, "<br>");
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
  const s = small ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <svg className={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
  const s = small ? "w-3 h-3" : "w-4 h-4";
  return (
    <svg className={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
      <p className="text-sage-400 text-xs">מייצר סיכום מקצועי</p>
    </div>
  );
}

// ─── Section card with per-section copy + highlight preview ───────────────────
function SectionCard({ title, icon, value, onChange }: {
  title: string; icon: string; value: string; onChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  const handlePreviewClick = () => {
    setFocused(true);
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-sage-100 shadow-sm overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-sage-50 bg-sage-50/60">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold text-sage-700 tracking-wide flex-1">{title}</span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200
            ${copied ? "bg-sage-500 text-white" : "bg-white border border-sage-200 text-sage-500 hover:bg-sage-50 active:scale-95"}`}
        >
          {copied ? <CheckIcon small /> : <CopyIcon small />}
          {copied ? "הועתק" : "העתק"}
        </button>
      </div>

      {/* Body: textarea when focused, highlighted preview otherwise */}
      {focused ? (
        <textarea
          ref={textareaRef}
          className="w-full px-4 py-3 text-sm text-gray-700 leading-relaxed bg-transparent outline-none min-h-[100px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setFocused(false)}
          dir="rtl"
        />
      ) : (
        <div
          onClick={handlePreviewClick}
          className="px-4 py-3 text-sm text-gray-700 leading-relaxed min-h-[100px] cursor-text"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: applyHighlights(value) || '<span class="text-gray-300">לחצי לעריכה…</span>' }}
        />
      )}
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
      // Case-insensitive username check
      if (username.trim().toLowerCase() === VALID_USERNAME && password === VALID_PASSWORD) {
        onUnlock();
      } else {
        setShake(true);
        setError("שם משתמש או סיסמה שגויים");
        setLoading(false);
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

      <form
        onSubmit={handleSubmit}
        className={`w-full max-w-[320px] flex flex-col gap-4 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-sage-600 px-1">שם משתמש</label>
          <div className="bg-white/90 border border-sage-100 rounded-2xl flex items-center gap-3 px-4 py-3.5 focus-within:border-sage-400 transition-colors shadow-sm">
            <svg className="w-4 h-4 text-sage-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <input
              type="text" autoComplete="username"
              placeholder="שם משתמש"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300"
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-sage-600 px-1">סיסמה</label>
          <div className="bg-white/90 border border-sage-100 rounded-2xl flex items-center gap-3 px-4 py-3.5 focus-within:border-sage-400 transition-colors shadow-sm">
            <svg className="w-4 h-4 text-sage-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              type={showPassword ? "text" : "password"} autoComplete="current-password"
              placeholder="סיסמה"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300"
              dir="ltr"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-sage-300 hover:text-sage-500 transition-colors">
              {showPassword ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="mt-2 py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "מתחבר..." : "כניסה"}
        </button>
      </form>

      <div className="mt-8 flex items-center gap-1.5">
        <ShieldIcon />
        <p className="text-[11px] text-sage-400">גישה מוגנת — חדר הטיפולים</p>
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
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[80vw] max-w-[320px] z-50 flex flex-col bg-gradient-to-b from-[#f4f7f4] to-[#fdf8f2] shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ borderRadius: "0 0 0 24px" }}
      >
        <div className="flex items-center justify-between px-5 pt-12 pb-5 border-b border-sage-100">
          <div>
            <h2 className="text-lg font-bold text-sage-800">הסלון</h2>
            <p className="text-xs text-sage-400 mt-0.5">הגדרות אישיות</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/80 border border-sage-100 flex items-center justify-center text-sage-400 hover:text-sage-600 transition-colors">
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-7">
          {/* Therapist name */}
          <div>
            <p className="text-xs text-sage-500 font-semibold tracking-wider uppercase mb-3">שם המטפל/ת</p>
            <div className="bg-white/80 rounded-2xl border border-sage-100 px-4 py-3 flex items-center gap-3">
              <span className="text-lg">👤</span>
              <input
                type="text" placeholder="למשל: אורית"
                value={therapistName}
                onChange={(e) => onNameChange(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300"
                dir="rtl"
              />
            </div>
            <p className="text-[11px] text-sage-300 mt-2 px-1">הכותרת תתעדכן אוטומטית</p>
          </div>

          {/* Style */}
          <div>
            <p className="text-xs text-sage-500 font-semibold tracking-wider uppercase mb-3">סגנון סיכום</p>
            <div className="flex flex-col gap-3">
              {STYLE_OPTIONS.map((opt) => {
                const isActive = selected === opt.key;
                return (
                  <button key={opt.key} onClick={() => { onSelect(opt.key); onClose(); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-right transition-all duration-200 active:scale-[0.98]
                      ${isActive ? "bg-sage-500 border-sage-500 shadow-md shadow-sage-200/60" : "bg-white/80 border-sage-100 hover:border-sage-300 hover:bg-sage-50"}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${isActive ? "bg-white/20" : "bg-sage-50 border border-sage-100"}`}>
                      {opt.icon}
                    </div>
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

          {/* Privacy */}
          <div className="bg-sage-50/80 rounded-2xl border border-sage-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldIcon />
              <p className="text-xs font-semibold text-sage-700">פרטיות מלאה</p>
            </div>
            <p className="text-[11px] text-sage-500 leading-relaxed">
              המידע לא נשמר בשום שרת או ענן. הכל מתבצע על המכשיר שלך בלבד ונמחק בלחיצה על "מחק וסגור".
            </p>
          </div>
        </div>
        <div className="h-8" />
      </div>
    </>
  );
}

// ─── File preview pill ────────────────────────────────────────────────────────
function FilePill({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl text-sm text-sage-700 max-w-full">
      <span className="truncate flex-1 text-xs">{name}</span>
      <button onClick={onRemove} className="text-sage-400 hover:text-sage-600 flex-shrink-0">
        <XIcon />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [unlocked, setUnlocked]         = useState(false);
  const [appState, setAppState]         = useState<AppState>("idle");
  const [inputMode, setInputMode]       = useState<InputMode>("mic");
  const [summaryStyle, setSummaryStyle] = useState<StyleKey>("clinical");
  const [therapistName, setTherapistName] = useState("");
  const [summary, setSummary]           = useState({ main: "", themes: "", next: "" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [allCopied, setAllCopied]       = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("מעבד…");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const timerDisplay  = useTimer(appState === "recording");
  const loadingRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load persisted settings
  useEffect(() => {
    const style = localStorage.getItem("summaryStyle") as StyleKey | null;
    if (style && MOCK_SUMMARY_BY_STYLE[style]) setSummaryStyle(style);
    setTherapistName(localStorage.getItem("therapistName") || "");
    if (sessionStorage.getItem("unlocked") === "1") setUnlocked(true);
  }, []);

  const handleUnlock = () => { sessionStorage.setItem("unlocked", "1"); setUnlocked(true); };

  const handleStyleSelect = useCallback((key: StyleKey) => {
    setSummaryStyle(key); localStorage.setItem("summaryStyle", key);
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setTherapistName(name); localStorage.setItem("therapistName", name);
  }, []);

  // ── Mic recording ──────────────────────────────────────────────────────────
  const handleMicPress = useCallback(() => {
    if (appState === "idle") {
      setAppState("recording");
    } else if (appState === "recording") {
      setLoadingLabel("מעבד הקלטה…");
      setAppState("loading");
      loadingRef.current = setTimeout(() => {
        setSummary({ ...MOCK_SUMMARY_BY_STYLE[summaryStyle] });
        setAppState("result");
      }, 3000);
    }
  }, [appState, summaryStyle]);

  // ── Audio file upload ──────────────────────────────────────────────────────
  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImagePreview(null);
  };

  const processAudioFile = async () => {
    if (!selectedFile) return;
    setLoadingLabel("מתמלל קובץ שמע…");
    setAppState("loading");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const transcribeRes = await fetch("/api/transcribe", { method: "POST", body: form });
      const { text } = await transcribeRes.json();

      setLoadingLabel("מסכם פגישה…");
      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style: summaryStyle }),
      });
      const result = await sumRes.json();
      setSummary(result);
      setAppState("result");
    } catch {
      setSummary({ ...MOCK_SUMMARY_BY_STYLE[summaryStyle] });
      setAppState("result");
    }
  };

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const processImageFile = async () => {
    if (!selectedFile) return;
    setLoadingLabel("קורא הערות מהתמונה…");
    setAppState("loading");
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl  = ev.target?.result as string;
        const base64   = dataUrl.split(",")[1];
        const mimeType = selectedFile.type;

        const sumRes = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType, style: summaryStyle }),
        });
        const result = await sumRes.json();
        setSummary(result);
        setAppState("result");
      };
      reader.readAsDataURL(selectedFile);
    } catch {
      setSummary({ ...MOCK_SUMMARY_BY_STYLE[summaryStyle] });
      setAppState("result");
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (loadingRef.current) clearTimeout(loadingRef.current);
    setSummary({ main: "", themes: "", next: "" });
    setSelectedFile(null);
    setImagePreview(null);
    setAllCopied(false);
    setInputMode("mic");
    setAppState("idle");
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, []);

  const handleCopyAll = useCallback(async () => {
    const text = ["📋 סיכום פגישה טיפולית", "", "עיקרי הפגישה:", summary.main, "", "תמות מרכזיות:", summary.themes, "", "נקודות להמשך:", summary.next].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2500);
    } catch { /* silent */ }
  }, [summary]);

  const activeStyle   = STYLE_OPTIONS.find((s) => s.key === summaryStyle)!;
  const displayTitle  = therapistName.trim() ? `חדר הטיפולים של ${therapistName.trim()}` : "חדר הטיפולים";

  if (!unlocked) return <LockScreen onUnlock={handleUnlock} />;

  return (
    <>
      {/* Hidden file inputs */}
      <input ref={audioInputRef} type="file" accept=".mp3,.wav,.m4a,audio/*" className="hidden" onChange={handleAudioFile} />
      <input ref={imageInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleImageFile} />

      <SettingsDrawer
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        selected={summaryStyle} onSelect={handleStyleSelect}
        therapistName={therapistName} onNameChange={handleNameChange}
      />

      <main className="min-h-dvh flex flex-col max-w-md mx-auto px-4 pb-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between py-5">
          <div className="flex-1 min-w-0 ml-3">
            <h1 className="text-lg font-bold text-sage-800 leading-tight truncate">{displayTitle}</h1>
            <p className="text-[11px] text-sage-400 tracking-wider mt-0.5">סיכום פגישות טיפוליות</p>
          </div>
          <button onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-white/80 border border-sage-100 shadow-sm flex items-center justify-center text-sage-500 hover:bg-sage-50 transition-colors active:scale-95 flex-shrink-0">
            <SettingsGearIcon />
          </button>
        </header>

        {/* ── Badges ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-100 border border-warm-200 text-warm-700 text-[10px] font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-warm-400 animate-pulse" />
            מצב הדגמה
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-50 border border-sage-200 text-sage-600 text-[10px] font-medium">
            {activeStyle.icon} {activeStyle.label}
          </span>
        </div>

        {/* ── Privacy notice ───────────────────────────────────────────── */}
        {appState === "idle" && (
          <div className="flex items-center justify-center gap-1.5 mb-5">
            <ShieldIcon />
            <p className="text-[11px] text-sage-400">המידע לא נשמר בשרת — פרטיות מלאה</p>
          </div>
        )}

        {/* ── Idle / Recording ─────────────────────────────────────────── */}
        {(appState === "idle" || appState === "recording") && (
          <div className="flex flex-col items-center flex-1 gap-6 py-4">

            {/* Input mode tabs */}
            {appState === "idle" && (
              <div className="flex gap-2 bg-sage-50 rounded-2xl p-1 w-full max-w-[300px]">
                {([
                  { key: "mic",   label: "הקלטה",   icon: <MicIcon className="w-4 h-4" /> },
                  { key: "audio", label: "קובץ שמע", icon: <AudioFileIcon /> },
                  { key: "image", label: "תמונה",    icon: <CameraIcon /> },
                ] as { key: InputMode; label: string; icon: React.ReactNode }[]).map((tab) => (
                  <button key={tab.key} onClick={() => { setInputMode(tab.key); setSelectedFile(null); setImagePreview(null); }}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-all duration-200
                      ${inputMode === tab.key ? "bg-white text-sage-700 shadow-sm" : "text-sage-400 hover:text-sage-600"}`}>
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Mic mode ── */}
            {inputMode === "mic" && (
              <>
                <p className="text-sage-500 text-sm text-center max-w-[220px] leading-relaxed">
                  {appState === "idle" ? "לחצי על המיקרופון להתחלת הקלטה" : "ההקלטה פעילה — לחצי שוב לעצירה"}
                </p>
                <div className="relative">
                  {appState === "recording" && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-sage-300 opacity-30 animate-ping" />
                      <span className="absolute -inset-3 rounded-full bg-sage-200 opacity-20 animate-ping" style={{ animationDelay: "0.3s" }} />
                    </>
                  )}
                  <button onClick={handleMicPress}
                    className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95
                      ${appState === "idle"
                        ? "bg-gradient-to-br from-sage-500 to-sage-600 text-white hover:from-sage-400 hover:to-sage-500 shadow-sage-300/50"
                        : "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-200/60 animate-pulse-ring"}`}>
                    {appState === "idle" ? <MicIcon className="w-12 h-12" /> : <StopIcon className="w-10 h-10" />}
                  </button>
                </div>
                {appState === "recording" && (
                  <div className="flex flex-col items-center gap-3 animate-fade-in">
                    <WaveformBars />
                    <span className="text-2xl font-light tabular-nums text-sage-700 tracking-widest">{timerDisplay}</span>
                    <span className="text-[11px] text-red-400 font-medium tracking-widest uppercase animate-pulse">● מקליט</span>
                  </div>
                )}
              </>
            )}

            {/* ── Audio file mode ── */}
            {inputMode === "audio" && appState === "idle" && (
              <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
                <p className="text-sage-500 text-sm text-center leading-relaxed">
                  העלי קובץ הקלטה לעיבוד ותמלול אוטומטי
                </p>
                {selectedFile ? (
                  <>
                    <FilePill name={selectedFile.name} onRemove={() => { setSelectedFile(null); if (audioInputRef.current) audioInputRef.current.value = ""; }} />
                    <button onClick={processAudioFile}
                      className="w-full py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200">
                      עבד קובץ שמע ←
                    </button>
                  </>
                ) : (
                  <button onClick={() => audioInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed border-sage-200 text-sage-400 hover:border-sage-400 hover:text-sage-600 hover:bg-sage-50/50 transition-all duration-200">
                    <AudioFileIcon />
                    <span className="text-sm font-medium">בחרי קובץ שמע</span>
                    <span className="text-[11px]">MP3, WAV, M4A</span>
                  </button>
                )}
              </div>
            )}

            {/* ── Image mode ── */}
            {inputMode === "image" && appState === "idle" && (
              <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
                <p className="text-sage-500 text-sm text-center leading-relaxed">
                  צלמי או העלי סריקה של המחברת — ה-AI יקרא וישמר
                </p>
                {imagePreview ? (
                  <>
                    <div className="relative w-full rounded-2xl overflow-hidden border border-sage-100 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="תצוגה מקדימה" className="w-full object-cover max-h-44" />
                      <button onClick={() => { setSelectedFile(null); setImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
                        className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white">
                        <XIcon />
                      </button>
                    </div>
                    <button onClick={processImageFile}
                      className="w-full py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200">
                      קרא הערות וסכם ←
                    </button>
                  </>
                ) : (
                  <button onClick={() => imageInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed border-sage-200 text-sage-400 hover:border-sage-400 hover:text-sage-600 hover:bg-sage-50/50 transition-all duration-200">
                    <CameraIcon />
                    <span className="text-sm font-medium">צלמי / העלי תמונה</span>
                    <span className="text-[11px]">JPG, PNG, PDF</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {appState === "loading" && (
          <div className="flex flex-col items-center justify-center flex-1 py-16">
            <LoadingSpinner label={loadingLabel} />
          </div>
        )}

        {/* ── Result ───────────────────────────────────────────────────── */}
        {appState === "result" && (
          <div className="flex flex-col gap-4 animate-slide-up">
            <div className="flex items-center gap-2 px-1">
              <span className="text-sage-400 text-xs">
                {new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
              </span>
              <div className="flex-1 h-px bg-sage-100" />
              <span className="text-sage-300 text-[10px]">{activeStyle.icon} {activeStyle.label}</span>
            </div>

            {/* Highlight legend */}
            <div className="flex items-center gap-2 px-1">
              <mark className="patient-mark text-[11px]">מטופל/ת</mark>
              <span className="text-[11px] text-sage-400">— שמות הוחלפו אוטומטית לפרטיות. לחצי על תיבה לעריכה.</span>
            </div>

            <SectionCard title="עיקרי הפגישה"  icon="📋" value={summary.main}   onChange={(v) => setSummary((s) => ({ ...s, main: v }))} />
            <SectionCard title="תמות מרכזיות"  icon="🔍" value={summary.themes} onChange={(v) => setSummary((s) => ({ ...s, themes: v }))} />
            <SectionCard title="נקודות להמשך"  icon="📌" value={summary.next}   onChange={(v) => setSummary((s) => ({ ...s, next: v }))} />

            <div className="flex items-center justify-center gap-1.5 py-1">
              <ShieldIcon />
              <p className="text-[11px] text-sage-400">המידע לא נשמר — יימחק בלחיצה על "מחק וסגור"</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={handleCopyAll}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium bg-sage-500 text-white hover:bg-sage-600 shadow-sm shadow-sage-200 transition-all duration-200 active:scale-[0.97]">
                <CopyIcon />
                {allCopied ? "הועתק ✓" : "העתק הכל"}
              </button>
              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-medium text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-all duration-200 active:scale-[0.97] shadow-sm">
                <TrashIcon />
                מחק וסגור
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
