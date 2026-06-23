"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Summary styles ───────────────────────────────────────────────────────────
type StyleKey = "short" | "clinical" | "thematic";

const STYLE_OPTIONS: { key: StyleKey; label: string; desc: string; icon: string }[] = [
  {
    key: "short",
    label: "סיכום נקודות קצר",
    desc: "ממוקד ומהיר",
    icon: "⚡",
  },
  {
    key: "clinical",
    label: "סיכום קליני מורחב",
    desc: "מפורט ומקיף",
    icon: "📄",
  },
  {
    key: "thematic",
    label: "חלוקה לפי תמות",
    desc: "תמות ונקודות להמשך",
    icon: "🗂️",
  },
];

const MOCK_SUMMARIES: Record<StyleKey, { main: string; themes: string; next: string }> = {
  short: {
    main: `• שיפור בשינה דווח
• קשיים בגבולות בעבודה
• חשש מדחייה — תמה חוזרת
• תובנה ורצון לשינוי קיימים`,
    themes: `• דחייה וגבולות
• דפוסים מוקדמים עם דמות האב`,
    next: `• תרגיל בית: 3 סיטואציות גבול
• לבחון קשר הצלחה–דימוי עצמי`,
  },
  clinical: {
    main: `המטופלת הגיעה לפגישה במצב רוח מעורב. בתחילת הפגישה דיווחה על שיפור מסוים בשינה, אך תיארה קשיים מתמשכים בניהול מערכות יחסים בסביבת העבודה. במהלך הפגישה עלתה דינמיקה חוזרת של חשש מדחייה, המקושרת לדפוסים התפתחותיים מוקדמים עם דמות האב. המטופלת הפגינה תובנה טובה ורצון אמיתי לשינוי. האפקט היה מגוון ומתאים לתכנים שעלו.`,
    themes: `• דפוס חשש מדחייה — מקושר לחוויות ילדות מוקדמות עם דמות האב
• קשיים בהצבת גבולות עם קולגות בכירים בסביבה מקצועית
• תחושת "לא שייכת" — דפוס חוזר בהקשרים קבוצתיים
• סימנים ראשוניים לשיפור בוויסות רגשי בהשוואה לחודש הקודם`,
    next: `• להמשיך לעבוד על זיהוי הטריגר הספציפי לתחושת הדחייה
• תרגיל בית: לרשום שלוש סיטואציות שבהן הצליחה להציב גבול
• לבחון בפגישה הבאה את הקשר בין הצלחות מקצועיות לדימוי עצמי
• לשקול הפניה לקבוצת תמיכה — להציג בפגישה הבאה`,
  },
  thematic: {
    main: `תמה 1 — גבולות ודחייה:
קשיים מתמשכים בהצבת גבולות. חשש מדחייה כתגובה לגבול.

תמה 2 — דפוסים מוקדמים:
קישור ברור לדינמיקה עם דמות האב. המטופלת מזהה את הקשר.

תמה 3 — משאבים וחוסן:
שיפור בשינה. תובנה גוברת. רצון לשינוי — נקודת כוח.`,
    themes: `תמות פעילות:
→ דחייה וגבולות (עיקרית)
→ דפוסים מוקדמים עם דמות האב
→ שייכות ומקום בקבוצה

תמות שצצו:
→ קשר הצלחה–דימוי עצמי (לבחון בהמשך)`,
    next: `לטווח קצר (פגישה הבאה):
• לעבוד על טריגרים לתחושת הדחייה
• לבחון תגובת הגוף בסיטואציות גבול

לטווח בינוני:
• תרגיל בית: יומן גבולות
• לבחון הפניה לקבוצה טיפולית`,
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type AppState = "idle" | "recording" | "loading" | "result";

// ─── Icons ────────────────────────────────────────────────────────────────────
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
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
function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-4 animate-fade-in">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-sage-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sage-500 animate-spin-slow" />
        <div className="absolute inset-2 rounded-full bg-sage-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-sage-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
      </div>
      <p className="text-sage-600 font-medium text-sm tracking-wide">מעבד את ההקלטה…</p>
      <p className="text-sage-400 text-xs">מייצר סיכום מקצועי</p>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon, value, onChange }: {
  title: string; icon: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-sage-100 shadow-sm overflow-hidden animate-slide-up">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-sage-50 bg-sage-50/60">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold text-sage-700 tracking-wide uppercase">{title}</span>
      </div>
      <textarea
        className="w-full px-4 py-3 text-sm text-gray-700 leading-relaxed bg-transparent outline-none min-h-[90px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="rtl"
      />
    </div>
  );
}

// ─── Settings drawer ──────────────────────────────────────────────────────────
function SettingsDrawer({
  open, onClose, selected, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  selected: StyleKey;
  onSelect: (k: StyleKey) => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer panel — slides in from right (RTL start) */}
      <div
        className={`fixed top-0 right-0 h-full w-[80vw] max-w-[320px] z-50 flex flex-col
          bg-gradient-to-b from-[#f4f7f4] to-[#fdf8f2] shadow-2xl
          transition-transform duration-350 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ borderRadius: "0 0 0 24px" }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-5 border-b border-sage-100">
          <div>
            <h2 className="text-lg font-bold text-sage-800">הסלון</h2>
            <p className="text-xs text-sage-400 mt-0.5">הגדרות אישיות</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/80 border border-sage-100 flex items-center justify-center text-sage-400 hover:text-sage-600 transition-colors"
            aria-label="סגור"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <p className="text-xs text-sage-500 font-medium tracking-wider uppercase mb-4">סגנון סיכום</p>

          <div className="flex flex-col gap-3">
            {STYLE_OPTIONS.map((opt) => {
              const isActive = selected === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => { onSelect(opt.key); onClose(); }}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-2xl border text-right
                    transition-all duration-200 active:scale-[0.98]
                    ${isActive
                      ? "bg-sage-500 border-sage-500 shadow-md shadow-sage-200/60"
                      : "bg-white/80 border-sage-100 hover:border-sage-300 hover:bg-sage-50"}
                  `}
                >
                  {/* Icon bubble */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0
                    ${isActive ? "bg-white/20" : "bg-sage-50 border border-sage-100"}`}>
                    {opt.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-tight ${isActive ? "text-white" : "text-sage-800"}`}>
                      {opt.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${isActive ? "text-sage-100" : "text-sage-400"}`}>
                      {opt.desc}
                    </p>
                  </div>

                  {/* Check */}
                  {isActive && (
                    <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0">
                      <CheckIcon />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider + info */}
          <div className="mt-8 pt-6 border-t border-sage-100">
            <p className="text-[11px] text-sage-300 leading-relaxed text-center">
              הסגנון הנבחר יחול על הסיכום הבא שיופק
            </p>
          </div>
        </div>

        {/* Bottom safe area */}
        <div className="h-8" />
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [summaryStyle, setSummaryStyle] = useState<StyleKey>("clinical");
  const [summary, setSummary] = useState(MOCK_SUMMARIES.clinical);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerDisplay = useTimer(appState === "recording");
  const loadingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist style in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("summaryStyle") as StyleKey | null;
    if (saved && MOCK_SUMMARIES[saved]) setSummaryStyle(saved);
  }, []);

  const handleStyleSelect = useCallback((key: StyleKey) => {
    setSummaryStyle(key);
    localStorage.setItem("summaryStyle", key);
  }, []);

  const handleMicPress = useCallback(() => {
    if (appState === "idle") {
      setAppState("recording");
    } else if (appState === "recording") {
      setAppState("loading");
      loadingRef.current = setTimeout(() => {
        setSummary({ ...MOCK_SUMMARIES[summaryStyle] });
        setAppState("result");
      }, 3000);
    }
  }, [appState, summaryStyle]);

  const handleReset = useCallback(() => {
    if (loadingRef.current) clearTimeout(loadingRef.current);
    setCopied(false);
    setAppState("idle");
  }, []);

  const handleCopy = useCallback(async () => {
    const text = [
      "📋 סיכום פגישה טיפולית",
      "",
      "עיקרי הפגישה:",
      summary.main,
      "",
      "תמות מרכזיות:",
      summary.themes,
      "",
      "נקודות להמשך:",
      summary.next,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* silent */ }
  }, [summary]);

  const activeStyle = STYLE_OPTIONS.find((s) => s.key === summaryStyle)!;

  return (
    <>
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        selected={summaryStyle}
        onSelect={handleStyleSelect}
      />

      <main className="min-h-dvh flex flex-col max-w-md mx-auto px-4 pb-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between py-5">
          <div>
            <h1 className="text-xl font-bold text-sage-800 leading-tight">הסלון</h1>
            <p className="text-[11px] text-sage-400 tracking-wider mt-0.5">סיכום פגישות טיפוליות</p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-white/80 border border-sage-100 shadow-sm flex items-center justify-center text-sage-500 hover:bg-sage-50 transition-colors active:scale-95"
            aria-label="פתח הגדרות"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        {/* ── Badges ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-100 border border-warm-200 text-warm-700 text-[10px] font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-warm-400 animate-pulse" />
            מצב הדגמה
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-50 border border-sage-200 text-sage-600 text-[10px] font-medium">
            {activeStyle.icon} {activeStyle.label}
          </span>
        </div>

        {/* ── Idle / Recording ─────────────────────────────────────────── */}
        {(appState === "idle" || appState === "recording") && (
          <div className="flex flex-col items-center justify-center flex-1 gap-8 py-8">
            <p className="text-sage-500 text-sm text-center max-w-[220px] leading-relaxed">
              {appState === "idle"
                ? "לחצי על המיקרופון להתחלת הקלטה"
                : "ההקלטה פעילה — לחצי שוב לעצירה"}
            </p>

            <div className="relative">
              {appState === "recording" && (
                <>
                  <span className="absolute inset-0 rounded-full bg-sage-300 opacity-30 animate-ping" />
                  <span className="absolute -inset-3 rounded-full bg-sage-200 opacity-20 animate-ping" style={{ animationDelay: "0.3s" }} />
                </>
              )}
              <button
                onClick={handleMicPress}
                className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95
                  ${appState === "idle"
                    ? "bg-gradient-to-br from-sage-500 to-sage-600 text-white hover:from-sage-400 hover:to-sage-500 shadow-sage-300/50"
                    : "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-200/60 animate-pulse-ring"}`}
                aria-label={appState === "idle" ? "התחל הקלטה" : "עצור הקלטה"}
              >
                {appState === "idle"
                  ? <MicIcon className="w-12 h-12" />
                  : <StopIcon className="w-10 h-10" />}
              </button>
            </div>

            {appState === "recording" && (
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                <WaveformBars />
                <span className="text-2xl font-light tabular-nums text-sage-700 tracking-widest">{timerDisplay}</span>
                <span className="text-[11px] text-red-400 font-medium tracking-widest uppercase animate-pulse">● מקליט</span>
              </div>
            )}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {appState === "loading" && (
          <div className="flex flex-col items-center justify-center flex-1 py-16">
            <LoadingSpinner />
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

            <SectionCard title="עיקרי הפגישה" icon="📋" value={summary.main} onChange={(v) => setSummary((s) => ({ ...s, main: v }))} />
            <SectionCard title="תמות מרכזיות" icon="🔍" value={summary.themes} onChange={(v) => setSummary((s) => ({ ...s, themes: v }))} />
            <SectionCard title="נקודות להמשך" icon="📌" value={summary.next} onChange={(v) => setSummary((s) => ({ ...s, next: v }))} />

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium bg-sage-500 text-white hover:bg-sage-600 shadow-sm shadow-sage-200 transition-all duration-200 active:scale-[0.97]"
              >
                <CopyIcon />
                {copied ? "הועתק ✓" : "העתק סיכום"}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-white/80 border border-gray-200 hover:bg-gray-50 transition-all duration-200 active:scale-[0.97] shadow-sm"
              >
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
