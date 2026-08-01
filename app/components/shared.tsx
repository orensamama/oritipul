"use client";

import { useState, useEffect, useRef } from "react";
import { applyHighlights } from "../lib/constants";
import { CopyIcon, CheckIcon, XIcon, TrashIcon } from "./icons";

// ─── Timer ────────────────────────────────────────────────────────────────────
export function useTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
export function WaveformBars() {
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
export function LoadingSpinner({ label }: { label?: string }) {
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
export function SectionCard({ title, icon, value, onChange }: {
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
export function FilePill({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl max-w-full">
      <span className="truncate flex-1 text-xs text-sage-700">{name}</span>
      <button onClick={onRemove} className="text-sage-400 hover:text-sage-600 flex-shrink-0"><XIcon small /></button>
    </div>
  );
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────
export function DropZone({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
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
export function ActionRow({ onCopyAll, allCopied, onReset }: { onCopyAll: () => void; allCopied: boolean; onReset: () => void }) {
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
