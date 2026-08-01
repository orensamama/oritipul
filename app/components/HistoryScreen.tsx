"use client";

import { useState, useEffect } from "react";
import type { SessionRecord } from "../lib/types";
import { loadHistory, deleteHistory } from "../lib/storage";
import { applyHighlights } from "../lib/constants";
import { HistoryIcon, CopyIcon, CheckIcon, TrashIcon } from "./icons";

export default function HistoryScreen({ onRestore }: { onRestore: (r: SessionRecord) => void }) {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { setRecords(loadHistory()); }, []);

  const handleDelete = (id: string) => {
    deleteHistory(id); setRecords((prev) => prev.filter((r) => r.id !== id));
    if (expanded === id) setExpanded(null);
  };

  const handleCopy = async (r: SessionRecord) => {
    const plain = (s: string) => s.replace(/\[\[([^\]]+)\]\]/g, "$1");
    const text = [
      `תאריך: ${r.sessionDate}`,
      r.sessionNumber ? `מפגש מס׳: ${r.sessionNumber}` : "",
      r.sessionLocation ? `מיקום: ${r.sessionLocation}` : "",
      "",
      "📋 סיכום רשמי:", plain(r.summary.official), "",
      "🔍 תמות:", plain(r.summary.themes), "",
      "💡 תובנות:", plain(r.summary.insights), "",
      "🔬 שאלות קליניות:", plain(r.summary.goals),
    ].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(r.id); setTimeout(() => setCopied(null), 2000); }
    catch { /* silent */ }
  };

  const timeAgo = (ts: number) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 60) return `לפני ${m} דקות`;
    const h = Math.floor(m / 60);
    return `לפני ${h} שעות`;
  };

  return (
    <div className="flex flex-col gap-4 pt-2 animate-fade-in">
      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <HistoryIcon />
          <p className="text-sage-500 text-sm">אין סיכומים מ-24 השעות האחרונות</p>
          <p className="text-sage-400 text-xs">לאחר כל פגישה, הסיכום יישמר כאן אוטומטית</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-sage-400 px-1">נמחקים אוטומטית לאחר 24 שעות • {records.length} סיכומים</p>
          {records.map((r) => (
            <div key={r.id} className="bg-white/80 border border-sage-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Header row */}
              <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-sage-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-sage-800">{r.sessionDate}</span>
                    {r.sessionNumber && <span className="text-[10px] bg-sage-100 text-sage-600 px-1.5 py-0.5 rounded-full">מפגש {r.sessionNumber}</span>}
                    {r.sessionLocation && <span className="text-[10px] text-sage-400">{r.sessionLocation}</span>}
                  </div>
                  <p className="text-[11px] text-sage-400 mt-0.5">{timeAgo(r.ts)}</p>
                  {expanded !== r.id && (
                    <p className="text-xs text-sage-600 mt-1 truncate">{r.summary.official.replace(/\[\[([^\]]+)\]\]/g, "$1").substring(0, 90)}…</p>
                  )}
                </div>
                <span className={`text-sage-300 transition-transform duration-200 ${expanded === r.id ? "rotate-90" : ""}`}>›</span>
              </button>

              {/* Expanded content */}
              {expanded === r.id && (
                <div className="border-t border-sage-50 px-4 py-3 flex flex-col gap-3">
                  {[
                    { label: "📋 סיכום רשמי", text: r.summary.official },
                    { label: "🔍 תמות", text: r.summary.themes },
                    { label: "💡 תובנות", text: r.summary.insights },
                    { label: "🔬 שאלות קליניות", text: r.summary.goals },
                  ].map(({ label, text }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: applyHighlights(text) }} dir="rtl" />
                    </div>
                  ))}
                  {r.personalNotes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <p className="text-[10px] font-semibold text-amber-700 mb-1">🔒 תרשומת אישית</p>
                      <p className="text-xs text-amber-900 whitespace-pre-line">{r.personalNotes}</p>
                    </div>
                  )}
                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleCopy(r)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95
                        ${copied === r.id ? "bg-sage-500 text-white" : "bg-sage-50 border border-sage-200 text-sage-600 hover:bg-sage-100"}`}>
                      <CopyIcon small />{copied === r.id ? "הועתק ✓" : "העתק"}
                    </button>
                    <button onClick={() => onRestore(r)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium bg-sage-500 text-white hover:bg-sage-600 transition-all active:scale-95">
                      ✏️ ערוך/יצא
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-red-400 bg-red-50 border border-red-100 hover:bg-red-100 transition-all active:scale-95">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
