"use client";

import { useState } from "react";
import { MicIcon, ShieldIcon } from "./icons";

const VALID_USERNAME = "oritipul";
const VALID_PASSWORD = "0547454546";

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
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
