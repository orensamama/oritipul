"use client";

import { useState, useEffect } from "react";
import type { AppScreen } from "../lib/types";
import { loadHistory } from "../lib/storage";
import { MicIcon, DocumentIcon, ArrowLeftIcon, HistoryIcon, ShieldIcon, SparkleIcon } from "./icons";

export default function Dashboard({ therapistName, onSelect }: { therapistName: string; onSelect: (s: AppScreen) => void }) {
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

      {/* Card 3 — Custom report builder */}
      <button onClick={() => onSelect("builder")}
        className="group w-full text-right bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl p-6 shadow-lg shadow-purple-300/40 active:scale-[0.98] transition-all duration-200 hover:shadow-xl hover:from-purple-400 hover:to-indigo-500">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <SparkleIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight mb-1">הפקת דוח מותאם אישית (לפי תבנית)</p>
            <p className="text-purple-100 text-xs leading-relaxed">העלי דוגמת מסמך קודם ללימוד המבנה — המערכת תלביש בו את הפגישה הנוכחית לפי הנחיותייך</p>
          </div>
          <ArrowLeftIcon />
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {["🧩 לפי תבנית", "🎯 הנחיות מותאמות", "🔒 המסמך נמחק אחרי חילוץ המבנה"].map((tag) => (
            <span key={tag} className="text-[10px] px-2.5 py-1 rounded-full bg-white/20 text-white font-medium">{tag}</span>
          ))}
        </div>
      </button>

      {/* History shortcut */}
      <HistoryShortcut onSelect={onSelect} />

      {/* Privacy note */}
      <div className="flex items-center justify-center gap-1.5">
        <ShieldIcon /><p className="text-[11px] text-sage-400">המידע לא נשמר בשרת — פרטיות מלאה</p>
      </div>
    </div>
  );
}

function HistoryShortcut({ onSelect }: { onSelect: (s: AppScreen) => void }) {
  const [count, setCount] = useState(0);
  useEffect(() => { setCount(loadHistory().length); }, []);
  if (count === 0) return null;
  return (
    <button onClick={() => onSelect("history")}
      className="w-full flex items-center gap-3 px-4 py-3 bg-white/70 border border-sage-100 rounded-2xl text-right hover:bg-sage-50 transition-all active:scale-[0.98]">
      <div className="w-9 h-9 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center text-sage-500 flex-shrink-0">
        <HistoryIcon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-sage-700">הסיכומים שלי</p>
        <p className="text-[11px] text-sage-400">{count} סיכום מ-24 השעות האחרונות</p>
      </div>
      <ArrowLeftIcon />
    </button>
  );
}
