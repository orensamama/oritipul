"use client";

import type { StyleKey } from "../lib/types";
import { STYLE_OPTIONS, APPROACH_OPTIONS } from "../lib/constants";
import { XIcon, CheckIcon, ShieldIcon } from "./icons";

export default function SettingsDrawer({ open, onClose, selected, onSelect, therapistName, onNameChange,
  approaches, onApproachesChange, otherApproach, onOtherApproachChange,
  therapistTitle, onTitleChange, therapistLicense, onLicenseChange, therapistFramework, onFrameworkChange }: {
  open: boolean; onClose: () => void;
  selected: StyleKey; onSelect: (k: StyleKey) => void;
  therapistName: string; onNameChange: (n: string) => void;
  approaches: string[]; onApproachesChange: (a: string[]) => void;
  otherApproach: string; onOtherApproachChange: (v: string) => void;
  therapistTitle: string; onTitleChange: (v: string) => void;
  therapistLicense: string; onLicenseChange: (v: string) => void;
  therapistFramework: string; onFrameworkChange: (v: string) => void;
}) {
  const toggleApproach = (key: string) => {
    onApproachesChange(
      approaches.includes(key) ? approaches.filter((k) => k !== key) : [...approaches, key]
    );
  };
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

          {/* ── Signature details for report-builder exports ── */}
          <div>
            <p className="text-xs text-sage-500 font-semibold tracking-wider uppercase mb-1">פרטי חתימה לדוחות</p>
            <p className="text-[11px] text-sage-400 mb-3">ישמשו אוטומטית בסיום דוחות (מחולל הדוחות) — לא נדרש למלא בכל דוח מחדש</p>
            <div className="flex flex-col gap-2.5">
              <div className="bg-white/80 rounded-2xl border border-sage-100 px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🎓</span>
                <input type="text" placeholder="תואר מקצועי, למשל: עובדת סוציאלית קלינית MSW" value={therapistTitle}
                  onChange={(e) => onTitleChange(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300" dir="rtl" />
              </div>
              <div className="bg-white/80 rounded-2xl border border-sage-100 px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🪪</span>
                <input type="text" placeholder="מספר רישום" value={therapistLicense}
                  onChange={(e) => onLicenseChange(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300" dir="rtl" />
              </div>
              <div className="bg-white/80 rounded-2xl border border-sage-100 px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🏥</span>
                <input type="text" placeholder="מסגרת טיפולית, למשל: קליניקה פרטית / מרכז X" value={therapistFramework}
                  onChange={(e) => onFrameworkChange(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-sage-800 placeholder:text-sage-300" dir="rtl" />
              </div>
            </div>
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
          {/* ── Therapeutic approaches ── */}
          <div>
            <p className="text-xs text-sage-500 font-semibold tracking-wider uppercase mb-1">גישות טיפוליות דומיננטיות</p>
            <p className="text-[11px] text-sage-400 mb-3">הגישות יוזרקו לפרומפט ה-AI לסיכומים מותאמים אישית</p>
            <div className="flex flex-col gap-1.5">
              {APPROACH_OPTIONS.map((opt) => {
                const checked = approaches.includes(opt.key);
                return (
                  <button key={opt.key} onClick={() => toggleApproach(opt.key)}
                    className={`flex items-center gap-3 w-full text-right px-3 py-2.5 rounded-xl border transition-all duration-150 active:scale-[0.98]
                      ${checked ? "bg-sage-50 border-sage-300" : "bg-white/70 border-sage-100 hover:border-sage-200"}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors
                      ${checked ? "bg-sage-500 border-sage-500" : "border-sage-200 bg-white"}`}>
                      {checked && (
                        <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </div>
                    <span className={`text-xs leading-snug ${checked ? "text-sage-800 font-medium" : "text-sage-500"}`}>{opt.label}</span>
                  </button>
                );
              })}

              {/* Other — free text */}
              <div className={`flex items-start gap-3 w-full px-3 py-2.5 rounded-xl border transition-all duration-150
                ${otherApproach.trim() ? "bg-sage-50 border-sage-300" : "bg-white/70 border-sage-100"}`}>
                <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors
                  ${otherApproach.trim() ? "bg-sage-500 border-sage-500" : "border-sage-200 bg-white"}`}>
                  {otherApproach.trim() && (
                    <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-xs text-sage-500 font-medium">אחר:</span>
                  <input
                    type="text"
                    placeholder="הקלידי גישות נוספות..."
                    value={otherApproach}
                    onChange={(e) => onOtherApproachChange(e.target.value)}
                    className="bg-transparent outline-none text-xs text-sage-800 placeholder:text-sage-300 w-full"
                    dir="rtl"
                  />
                </div>
              </div>
            </div>
            {approaches.length > 0 && (
              <p className="text-[10px] text-sage-400 mt-2 px-1">
                {approaches.length} גישות נבחרו{otherApproach.trim() ? " + תוספת חופשית" : ""}
              </p>
            )}
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
