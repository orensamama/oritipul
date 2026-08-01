"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { AppScreen, StyleKey, SessionRecord } from "./lib/types";
import { STYLE_OPTIONS } from "./lib/constants";
import { SettingsGearIcon, BackIcon } from "./components/icons";
import { LoadingSpinner } from "./components/shared";
import LockScreen from "./components/LockScreen";
import SettingsDrawer from "./components/SettingsDrawer";
import Dashboard from "./components/Dashboard";

// Heavy, screen-specific flows are only needed once the therapist navigates
// into them — loading them on demand keeps the initial dashboard paint light.
const ScreenLoading = () => (
  <div className="flex flex-col items-center justify-center flex-1 py-16"><LoadingSpinner /></div>
);

const SessionFlow = dynamic(() => import("./components/SessionFlow"), { ssr: false, loading: ScreenLoading });
const ReportFlow = dynamic(() => import("./components/ReportFlow"), { ssr: false, loading: ScreenLoading });
const HistoryScreen = dynamic(() => import("./components/HistoryScreen"), { ssr: false, loading: ScreenLoading });
const ReportBuilder = dynamic(() => import("./components/ReportBuilder"), { ssr: false, loading: ScreenLoading });

export default function HomePage() {
  const [unlocked, setUnlocked]           = useState(false);
  const [screen, setScreen]               = useState<AppScreen>("dashboard");
  const [summaryStyle, setSummaryStyle]   = useState<StyleKey>("clinical");
  const [therapistName, setTherapistName]       = useState("");
  const [settingsOpen, setSettingsOpen]         = useState(false);
  const [isDemo, setIsDemo]                     = useState(true);
  const [approaches, setApproaches]             = useState<string[]>([]);
  const [otherApproach, setOtherApproach]       = useState("");

  useEffect(() => {
    const style = localStorage.getItem("summaryStyle") as StyleKey | null;
    const VALID_STYLES: StyleKey[] = ["short", "clinical", "thematic"];
    if (style && VALID_STYLES.includes(style)) setSummaryStyle(style);
    setTherapistName(localStorage.getItem("therapistName") || "");
    try {
      const saved = localStorage.getItem("therapistApproaches");
      if (saved) setApproaches(JSON.parse(saved));
    } catch { /* ignore */ }
    setOtherApproach(localStorage.getItem("therapistOtherApproach") || "");
    if (sessionStorage.getItem("unlocked") === "1") setUnlocked(true);
    // Check if API key is configured on the server
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => setIsDemo(data.demo))
      .catch(() => setIsDemo(true));
  }, []);

  const handleUnlock      = () => { sessionStorage.setItem("unlocked", "1"); setUnlocked(true); };
  const handleStyleSelect = (key: StyleKey) => { setSummaryStyle(key); localStorage.setItem("summaryStyle", key); };
  const handleNameChange  = (name: string) => { setTherapistName(name); localStorage.setItem("therapistName", name); };
  const handleApproachesChange = (a: string[]) => { setApproaches(a); localStorage.setItem("therapistApproaches", JSON.stringify(a)); };
  const handleOtherApproachChange = (v: string) => { setOtherApproach(v); localStorage.setItem("therapistOtherApproach", v); };

  const displayTitle = therapistName.trim() ? `חדר הטיפולים של ${therapistName.trim()}` : "חדר הטיפולים";

  const [restoreRecord, setRestoreRecord] = useState<SessionRecord | null>(null);

  const handleRestore = (r: SessionRecord) => { setRestoreRecord(r); setScreen("session"); };

  const screenTitle: Record<AppScreen, string> = {
    dashboard: displayTitle,
    session:   "תיעוד פגישה טיפולית",
    report:    "מחולל דוחות תקופתיים",
    history:   "הסיכומים שלי (24 שעות)",
    builder:   "דוח מותאם אישית",
  };
  const activeStyle = STYLE_OPTIONS.find((s) => s.key === summaryStyle)!;

  if (!unlocked) return <LockScreen onUnlock={handleUnlock} />;

  return (
    <>
      <SettingsDrawer
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        selected={summaryStyle} onSelect={handleStyleSelect}
        therapistName={therapistName} onNameChange={handleNameChange}
        approaches={approaches} onApproachesChange={handleApproachesChange}
        otherApproach={otherApproach} onOtherApproachChange={handleOtherApproachChange}
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
          {isDemo ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-100 border border-warm-200 text-warm-700 text-[10px] font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-warm-400 animate-pulse" />מצב הדגמה — נתונים מדומים
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-100 border border-sage-300 text-sage-700 text-[10px] font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />מחובר ל-AI
            </span>
          )}
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
          <SessionFlow summaryStyle={summaryStyle} onBack={() => setScreen("dashboard")} restoreRecord={restoreRecord} onRestoreConsumed={() => setRestoreRecord(null)} />
        )}
        {screen === "report" && (
          <ReportFlow summaryStyle={summaryStyle} />
        )}
        {screen === "history" && (
          <HistoryScreen onRestore={handleRestore} />
        )}
        {screen === "builder" && (
          <ReportBuilder />
        )}
      </main>
    </>
  );
}
