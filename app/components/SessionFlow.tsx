"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { StyleKey, SessionSummary, SessionState, InputMode, ImageFile, SessionRecord } from "../lib/types";
import { MOCK_SESSION } from "../lib/constants";
import { loadDraft, saveDraft, clearDraft, pushHistory } from "../lib/storage";
import { extractAudioFileFromClipboardEvent, readAudioFileFromClipboard } from "../lib/audio-paste";
import {
  MicIcon, StopIcon, CheckIcon, XIcon, AudioFileIcon, CameraIcon, PlusIcon,
  PauseIcon, PlayIcon, DownloadIcon, TrashIcon, CopyIcon, ShieldIcon, PasteIcon,
} from "./icons";
import { LoadingSpinner, WaveformBars, SectionCard, FilePill, DropZone } from "./shared";

export default function SessionFlow({ summaryStyle, onBack, restoreRecord, onRestoreConsumed }: {
  summaryStyle: StyleKey; onBack: () => void;
  restoreRecord?: SessionRecord | null; onRestoreConsumed?: () => void;
}) {
  // ── Main recording state ─────────────────────────────────────────────────
  const [state, setState]        = useState<SessionState>("idle");
  const [inputMode, setMode]     = useState<InputMode>("mic");
  const [summary, setSummary]    = useState<SessionSummary>({ official: "", themes: "", insights: "", goals: "" });
  const [label, setLabel]        = useState("מעבד…");
  const [micError, setMicError]    = useState("");
  const [file, setFile]            = useState<File | null>(null);        // audio file
  const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);          // multi-image

  // ── Manual timer (supports pause) ────────────────────────────────────────
  const [timerSecs, setTimerSecs]   = useState(0);
  const timerIntervalRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimer  = useCallback(() => {
    if (timerIntervalRef.current) return;
    timerIntervalRef.current = setInterval(() => setTimerSecs((s) => s + 1), 1000);
  }, []);
  const pauseTimer  = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
  }, []);
  const resetTimer  = useCallback(() => { pauseTimer(); setTimerSecs(0); }, [pauseTimer]);
  const timerDisplay = `${String(Math.floor(timerSecs / 60)).padStart(2, "0")}:${String(timerSecs % 60).padStart(2, "0")}`;

  // ── Main recorder refs ────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const mimeTypeRef      = useRef<string>("audio/webm");
  const audioBlobRef     = useRef<Blob | null>(null);       // saved blob for retry
  const audioBlobUrlRef  = useRef<string | null>(null);     // object URL for cleanup
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Personal notes state ──────────────────────────────────────────────────
  const [noteState, setNoteState]         = useState<"idle" | "recording" | "loading" | "done">("idle");
  const [personalNotes, setPersonalNotes] = useState("");
  const [noteMicError, setNoteMicError]   = useState("");
  const noteRecorderRef = useRef<MediaRecorder | null>(null);
  const noteChunksRef   = useRef<Blob[]>([]);
  const noteStreamRef   = useRef<MediaStream | null>(null);
  const noteMimeRef     = useRef<string>("audio/webm");

  // ── Export / session metadata ─────────────────────────────────────────────
  const [sessionDate, setSessionDate]         = useState(() => new Date().toLocaleDateString("he-IL"));
  const [sessionNumber, setSessionNumber]     = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [exportInclude, setExportInclude]     = useState({ official: true, themes: true, insights: false, goals: false });
  const [exportCopied, setExportCopied]       = useState(false);

  // ── Restore from history ───────────────────────────────────────────────────
  useEffect(() => {
    if (!restoreRecord) return;
    setSummary(restoreRecord.summary);
    setPersonalNotes(restoreRecord.personalNotes);
    setSessionDate(restoreRecord.sessionDate);
    setSessionNumber(restoreRecord.sessionNumber);
    setSessionLocation(restoreRecord.sessionLocation);
    setState("result");
    onRestoreConsumed?.();
  }, [restoreRecord]);

  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  // ── Load 24h draft on mount ───────────────────────────────────────────────
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setSummary(d.summary);
      setPersonalNotes(d.personalNotes);
      setSessionDate(d.sessionDate);
      setSessionNumber(d.sessionNumber);
      setSessionLocation(d.sessionLocation);
      setExportInclude(d.exportInclude);
      setState("result");
    }
  }, []);

  // ── Auto-save draft whenever result changes ───────────────────────────────
  useEffect(() => {
    if (state !== "result") return;
    saveDraft({ summary, personalNotes, sessionDate, sessionNumber, sessionLocation, exportInclude });
  }, [state, summary, personalNotes, sessionDate, sessionNumber, sessionLocation, exportInclude]);

  // ── Cleanup helpers ───────────────────────────────────────────────────────
  const cleanupMain = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try { mr.ondataavailable = null; mr.onstop = null; mr.stop(); } catch { /* ignore */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null; streamRef.current = null; audioChunksRef.current = [];
    resetTimer();
  }, [resetTimer]);

  const cleanupNotes = useCallback(() => {
    const mr = noteRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try { mr.ondataavailable = null; mr.onstop = null; mr.stop(); } catch { /* ignore */ }
    }
    noteStreamRef.current?.getTracks().forEach((t) => t.stop());
    noteRecorderRef.current = null; noteStreamRef.current = null; noteChunksRef.current = [];
  }, []);

  const reset = useCallback(() => {
    cleanupMain(); cleanupNotes();
    if (audioBlobUrlRef.current) { URL.revokeObjectURL(audioBlobUrlRef.current); audioBlobUrlRef.current = null; }
    audioBlobRef.current = null;
    setAudioUrl(null); setErrorMsg("");
    setSummary({ official: "", themes: "", insights: "", goals: "" });
    setPersonalNotes(""); setFile(null); setImageFiles([]);
    setMicError(""); setNoteMicError("");
    setMode("mic"); setState("idle"); setNoteState("idle");
    setSessionDate(new Date().toLocaleDateString("he-IL"));
    setSessionNumber(""); setSessionLocation("");
    setExportInclude({ official: true, themes: true, insights: false, goals: false });
    setExportCopied(false); clearDraft();
    if (audioRef.current) audioRef.current.value = "";
    if (imageRef.current) imageRef.current.value = "";
  }, [cleanupMain, cleanupNotes]);

  // ── MIME detection ────────────────────────────────────────────────────────
  const getBestMimeType = () => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  };

  // ── Main recording controls ───────────────────────────────────────────────
  const startRecording = async (continuation = false) => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      streamRef.current = stream;
      if (!continuation) { audioChunksRef.current = []; resetTimer(); }

      const mimeType = continuation ? mimeTypeRef.current : getBestMimeType();
      if (!continuation && mimeType) mimeTypeRef.current = mimeType;

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(250);
      mediaRecorderRef.current = mr;
      startTimer();
      setState("recording");
    } catch {
      setMicError("לא ניתן לגשת למיקרופון. אנא אשרי הרשאת מיקרופון בדפדפן.");
    }
  };

  const pauseRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "recording") return;
    mr.pause(); pauseTimer(); setState("paused");
  };

  const resumeRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "paused") return;
    mr.resume(); startTimer(); setState("recording");
  };

  const stopRecording = async () => {
    const mr = mediaRecorderRef.current;
    pauseTimer();
    if (mr && mr.state !== "inactive") {
      await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; mediaRecorderRef.current = null;

    // Snapshot current chunks into a playable blob for the audio player
    const mimeType = mimeTypeRef.current || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    audioBlobRef.current = blob;
    if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    const url = URL.createObjectURL(blob);
    audioBlobUrlRef.current = url;
    setAudioUrl(url);

    setState("stopped");
  };

  // ── Paste audio from clipboard (e.g. a voice message copied from WhatsApp/iPhone) ──
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState("");

  const adoptPastedAudioForMic = (pasted: File) => {
    mimeTypeRef.current = pasted.type || "audio/webm";
    audioBlobRef.current = pasted;
    if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    const url = URL.createObjectURL(pasted);
    audioBlobUrlRef.current = url;
    setAudioUrl(url);
    setState("stopped");
  };

  const pasteAudioFromClipboard = async () => {
    setPasteError(""); setPasteBusy(true);
    const pasted = await readAudioFileFromClipboard();
    setPasteBusy(false);
    if (!pasted) { setPasteError("לא נמצא קובץ שמע בלוח. העתיקי הודעה קולית (למשל מוואטסאפ) ונסי שוב."); return; }
    if (inputMode === "audio") setFile(pasted); else adoptPastedAudioForMic(pasted);
  };

  // Passive listener — catches a native Ctrl+V paste of an audio file anywhere
  // on the idle screen, no need to click the dedicated button first.
  useEffect(() => {
    if (state !== "idle" || (inputMode !== "mic" && inputMode !== "audio")) return;
    const handler = (e: ClipboardEvent) => {
      const pasted = extractAudioFileFromClipboardEvent(e);
      if (!pasted) return;
      e.preventDefault();
      setPasteError("");
      if (inputMode === "audio") setFile(pasted); else adoptPastedAudioForMic(pasted);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [state, inputMode]);

  const sendToAI = async () => {
    // Use saved blob (set by stopRecording) — supports retry without re-recording
    const blob = audioBlobRef.current;
    if (!blob) return;

    const mimeType = mimeTypeRef.current || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";

    setLabel("מתמלל הקלטה…"); setState("loading"); setErrorMsg("");
    try {
      const form = new FormData();
      form.append("file", blob, `recording.${ext}`);
      const trRes = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!trRes.ok) throw new Error(`שגיאת תמלול (${trRes.status})`);
      const { text } = await trRes.json();

      setLabel("מסכם פגישה…");
      const sumRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style: summaryStyle }),
      });
      if (!sumRes.ok) throw new Error(`שגיאת סיכום (${sumRes.status})`);
      const result = await sumRes.json();
      // Free chunks now that we have a successful result
      audioChunksRef.current = [];
      setSummary(result); saveResult(result); setState("result");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setErrorMsg(
        msg.includes("504") || msg.includes("timeout")
          ? "פסק זמן — ההקלטה ארוכה מדי. נסי שוב או פצלי לשניים."
          : `שגיאה בעיבוד: ${msg || "בעיית רשת"}. ניתן לנסות שוב.`
      );
      setState("error");
    }
  };

  // ── Personal notes recorder ───────────────────────────────────────────────
  const startNoteRecording = async () => {
    setNoteMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      noteStreamRef.current = stream; noteChunksRef.current = [];
      const mimeType = getBestMimeType();
      if (mimeType) noteMimeRef.current = mimeType;
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data?.size > 0) noteChunksRef.current.push(e.data); };
      mr.start(250); noteRecorderRef.current = mr; setNoteState("recording");
    } catch { setNoteMicError("לא ניתן לגשת למיקרופון."); }
  };

  const stopNoteRecording = async () => {
    const mr = noteRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    noteStreamRef.current?.getTracks().forEach((t) => t.stop());
    noteStreamRef.current = null; noteRecorderRef.current = null;

    const mimeType = noteMimeRef.current || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(noteChunksRef.current, { type: mimeType });
    noteChunksRef.current = [];
    setNoteState("loading");
    try {
      const form = new FormData();
      form.append("file", blob, `note.${ext}`);
      const trRes = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!trRes.ok) throw new Error();
      const { text } = await trRes.json();
      setPersonalNotes((prev) => prev ? `${prev}\n${text}` : text);
    } catch { setPersonalNotes((prev) => prev ? `${prev}\n[שגיאה בתמלול]` : "[שגיאה בתמלול]"); }
    setNoteState("done");
  };

  // ── File processing ───────────────────────────────────────────────────────
  const processAudio = async () => {
    if (!file) return;
    setLabel("מתמלל קובץ שמע…"); setState("loading");
    try {
      const form = new FormData(); form.append("file", file);
      const trRes = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!trRes.ok) throw new Error();
      const { text } = await trRes.json();
      setLabel("מסכם פגישה…");
      const sumRes = await fetch("/api/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style: summaryStyle }),
      });
      if (!sumRes.ok) throw new Error();
      const result = await sumRes.json();
      setSummary(result); saveResult(result); setState("result");
    } catch { setSummary({ ...MOCK_SESSION }); saveResult(MOCK_SESSION); setState("result"); }
  };

  // ── Save new result to 24h history ───────────────────────────────────────
  const saveResult = (s: SessionSummary) => {
    pushHistory({ summary: s, personalNotes, sessionDate, sessionNumber, sessionLocation });
  };

  const processImages = async () => {
    if (imageFiles.length === 0) return;
    const pageLabel = imageFiles.length === 1 ? "קורא עמוד 1…" : `קורא ${imageFiles.length} עמודים…`;
    setLabel(pageLabel); setState("loading");
    try {
      // Convert all images to base64 in parallel
      const images = await Promise.all(
        imageFiles.map(({ file: f }) =>
          new Promise<{ base64: string; mimeType: string }>((resolve) => {
            const r = new FileReader();
            r.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              resolve({ base64: dataUrl.split(",")[1], mimeType: f.type });
            };
            r.readAsDataURL(f);
          })
        )
      );
      setLabel("מסכם פגישה…");
      const sumRes = await fetch("/api/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, style: summaryStyle }),
      });
      if (!sumRes.ok) throw new Error();
      const result = await sumRes.json();
      setSummary(result); saveResult(result); setState("result");
    } catch { setSummary({ ...MOCK_SESSION }); saveResult(MOCK_SESSION); setState("result"); }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const stripMarkers = (s: string) => s.replace(/\[\[([^\]]+)\]\]/g, "$1");

  const buildExportText = () => {
    const lines = [
      "════════════════════════════════",
      "      סיכום פגישה טיפולית",
      "════════════════════════════════",
      `תאריך: ${sessionDate}`,
      ...(sessionNumber   ? [`מפגש מס׳: ${sessionNumber}`]   : []),
      ...(sessionLocation ? [`מיקום: ${sessionLocation}`]     : []),
      "",
    ];
    const sections = [
      { key: "official" as const, title: "📋 סיכום פגישה רשמי" },
      { key: "themes"   as const, title: "🔍 תמות מרכזיות שעלו בשיחה" },
      { key: "insights" as const, title: "💡 תובנות ושיפוט מקצועי" },
      { key: "goals"    as const, title: "🔬 שאלות להעמקה קלינית" },
    ];
    for (const sec of sections) {
      if (!exportInclude[sec.key]) continue;
      lines.push(sec.title, "────────────────────", stripMarkers(summary[sec.key]), "");
    }
    return lines.join("\n");
  };

  const copyToTipulog = async () => {
    try {
      await navigator.clipboard.writeText(buildExportText());
      setExportCopied(true); setTimeout(() => setExportCopied(false), 2500);
    } catch { /* silent */ }
  };

  const downloadReport = () => {
    const blob = new Blob(["﻿" + buildExportText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `סיכום-פגישה-${sessionDate.replace(/\//g, "-")}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Shared: personal notes box (used in both idle & result views) ─────────
  const PersonalNotesMini = () => (
    <div className="w-full">
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔒</span>
          <p className="text-xs font-semibold text-amber-800 flex-1">תרשומת אישית</p>
          <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">לא תיכלל בדוח</span>
        </div>

        {noteState === "idle" && !personalNotes && (
          <>
            <p className="text-[11px] text-amber-600 leading-relaxed">מחשבות חופשיות, תחושות בטן ותזכורות — לא ישלחו ל-AI ולא ייכללו בדוח</p>
            <button onClick={startNoteRecording}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-200 transition-all active:scale-95">
              <MicIcon className="w-3.5 h-3.5" />הקלט תרשומת אישית
            </button>
            {noteMicError && <p className="text-red-400 text-[11px]">{noteMicError}</p>}
          </>
        )}

        {noteState === "recording" && (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-[11px] text-red-400 font-medium animate-pulse">● מקליט תרשומת</span>
              <WaveformBars />
            </div>
            <button onClick={stopNoteRecording}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium hover:bg-red-100 transition-all active:scale-95">
              <StopIcon className="w-3.5 h-3.5" />עצור
            </button>
          </div>
        )}

        {noteState === "loading" && (
          <div className="flex items-center gap-2 py-1">
            <div className="w-4 h-4 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />
            <span className="text-xs text-amber-600">מתמלל תרשומת…</span>
          </div>
        )}

        {(noteState === "done" || (noteState === "idle" && personalNotes)) && (
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full bg-white/60 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-900 leading-relaxed outline-none focus:border-amber-400 transition-colors min-h-[60px] placeholder:text-amber-300"
              placeholder="כתבי או ערכי כאן…" value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)} dir="rtl" />
            <button onClick={() => { setNoteState("idle"); startNoteRecording(); }}
              className="text-[11px] text-amber-500 hover:text-amber-700 transition-colors self-start flex items-center gap-1">
              <PlusIcon small />הוסף הקלטה נוספת
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1">
      <input ref={audioRef} type="file" accept=".mp3,.wav,.m4a,audio/*" className="hidden"
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); }} />
      <input ref={imageRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        files.forEach((f) => {
          const r = new FileReader();
          r.onload = (ev) => {
            const preview = ev.target?.result as string;
            setImageFiles((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, file: f, preview }]);
          };
          r.readAsDataURL(f);
        });
        if (imageRef.current) imageRef.current.value = ""; // allow re-selecting same files
      }} />

      {/* ── Loading ── */}
      {state === "loading" && (
        <div className="flex flex-col items-center justify-center flex-1 py-16"><LoadingSpinner label={label} /></div>
      )}

      {/* ── Result view ── */}
      {state === "result" && (
        <div className="flex flex-col gap-4 animate-slide-up">
          {/* Date header */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-sage-400 text-xs">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</span>
            <div className="flex-1 h-px bg-sage-100" />
          </div>

          {/* Session metadata */}
          <div className="bg-white/80 border border-sage-100 rounded-2xl px-4 py-3 flex flex-col gap-3 shadow-sm">
            <p className="text-[11px] text-sage-500 font-semibold tracking-wider uppercase">פרטי המפגש</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-sage-400">תאריך</label>
                <input type="text" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                  className="text-xs text-sage-800 bg-sage-50 rounded-lg px-2 py-1.5 outline-none border border-sage-100 focus:border-sage-400 transition-colors" dir="rtl" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-sage-400">מפגש מס׳</label>
                <input type="text" placeholder="למשל: 12" value={sessionNumber} onChange={(e) => setSessionNumber(e.target.value)}
                  className="text-xs text-sage-800 bg-sage-50 rounded-lg px-2 py-1.5 outline-none border border-sage-100 focus:border-sage-400 transition-colors" dir="rtl" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-sage-400">מיקום המפגש</label>
              <input type="text" placeholder="מרפאה / אונליין / בית" value={sessionLocation} onChange={(e) => setSessionLocation(e.target.value)}
                className="text-xs text-sage-800 bg-sage-50 rounded-lg px-2 py-1.5 outline-none border border-sage-100 focus:border-sage-400 transition-colors" dir="rtl" />
            </div>
          </div>

          {/* Highlight legend */}
          <div className="flex items-center gap-3 px-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <mark className="patient-mark text-[10px]">מטופל/ת</mark>
              <span className="text-[10px] text-sage-400">שמות מוסתרים</span>
            </div>
            <div className="flex items-center gap-1.5">
              <mark className="clinical-mark text-[10px]">מונח קליני</mark>
              <span className="text-[10px] text-sage-400">סמן טיפולי</span>
            </div>
          </div>

          {/* 4 clinical boxes with per-section export checkboxes */}
          {([
            { key: "official" as const, title: "סיכום פגישה רשמי (להעתקה לטיפולוג)", icon: "📋" },
            { key: "themes"   as const, title: "תמות מרכזיות שעלו בשיחה",             icon: "🔍" },
            { key: "insights" as const, title: "תובנות ושיפוט מקצועי",                 icon: "💡" },
            { key: "goals"    as const, title: "שאלות להעמקה קלינית ולהדרכה",         icon: "🔬" },
          ]).map(({ key, title, icon }) => (
            <div key={key}>
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <button onClick={() => setExportInclude((p) => ({ ...p, [key]: !p[key] }))}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${exportInclude[key] ? "bg-sage-500 border-sage-500" : "border-sage-200 bg-white"}`}>
                  {exportInclude[key] && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <span className="text-[10px] text-sage-400">{exportInclude[key] ? "כלול בדוח" : "לא כלול בדוח"}</span>
              </div>
              <SectionCard title={title} icon={icon}
                value={summary[key]}
                onChange={(v) => setSummary((s) => ({ ...s, [key]: v }))} />
            </div>
          ))}

          {/* Personal notes — private, never exported */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-100 bg-amber-50">
              <span className="text-base">🔒</span>
              <span className="text-xs font-semibold text-amber-800 flex-1">תרשומת אישית — לעיני המטפלת בלבד</span>
              <span className="text-[9px] bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">לא מיוצאת</span>
            </div>
            <textarea
              className="w-full px-4 py-3 text-sm text-amber-900 leading-relaxed bg-transparent outline-none min-h-[80px] placeholder:text-amber-300"
              placeholder="מחשבות חופשיות, תחושות בטן, תזכורות אישיות…"
              value={personalNotes} onChange={(e) => setPersonalNotes(e.target.value)} dir="rtl" />
          </div>

          {/* 24h privacy notice */}
          <div className="flex items-center justify-center gap-1.5 py-0.5">
            <ShieldIcon />
            <p className="text-[11px] text-sage-400">נשמר במכשירך בלבד — נמחק אוטומטית לאחר 24 שעות</p>
          </div>

          {/* Export panel */}
          <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">📤</span>
              <p className="text-xs font-semibold text-sage-700">יצוא לטיפולוג</p>
              <span className="text-[10px] text-sage-400 mr-1">— רק הסעיפים המסומנים ✓ ייכללו</span>
            </div>
            <div className="flex gap-2">
              <button onClick={copyToTipulog}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium shadow-sm transition-all duration-200 active:scale-[0.97]
                  ${exportCopied ? "bg-sage-600 text-white" : "bg-sage-500 text-white hover:bg-sage-600 shadow-sage-200"}`}>
                <CopyIcon />{exportCopied ? "הועתק ✓" : "העתק לטיפולוג"}
              </button>
              <button onClick={downloadReport}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-sage-600 bg-white border border-sage-200 hover:bg-sage-50 transition-all duration-200 active:scale-[0.97]">
                <DownloadIcon />הורד
              </button>
            </div>
          </div>

          {/* Delete / close */}
          <button onClick={reset}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-all duration-200 active:scale-[0.97]">
            <TrashIcon />מחק וסגור
          </button>
        </div>
      )}

      {/* ── Idle / Recording / Paused / Stopped / Error ── */}
      {(state === "idle" || state === "recording" || state === "paused" || state === "stopped" || state === "error") && (
        <div className="flex flex-col items-center flex-1 gap-6 py-4">

          {/* Input mode tabs — idle only */}
          {state === "idle" && (
            <div className="flex gap-2 bg-sage-50 rounded-2xl p-1 w-full max-w-[300px]">
              {([
                { key: "mic"   as InputMode, label: "הקלטה",    icon: <MicIcon className="w-4 h-4" /> },
                { key: "audio" as InputMode, label: "קובץ שמע", icon: <AudioFileIcon /> },
                { key: "image" as InputMode, label: "תמונה",    icon: <CameraIcon /> },
              ]).map((tab) => (
                <button key={tab.key} onClick={() => { setMode(tab.key); setFile(null); setImageFiles([]); setMicError(""); }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-all duration-200
                    ${inputMode === tab.key ? "bg-white text-sage-700 shadow-sm" : "text-sage-400 hover:text-sage-600"}`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Active recorder UI (recording / paused / stopped) ── */}
          {(state === "recording" || state === "paused" || state === "stopped") && (
            <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
              {/* Status label */}
              <p className="text-sage-500 text-sm text-center">
                {state === "recording" ? "ההקלטה פעילה" : state === "paused" ? "ההקלטה מושהית" : "ההקלטה הסתיימה"}
              </p>

              {/* Visual indicator */}
              <div className="relative">
                {state === "recording" && (
                  <><span className="absolute inset-0 rounded-full bg-red-300 opacity-30 animate-ping" />
                  <span className="absolute -inset-3 rounded-full bg-red-200 opacity-20 animate-ping" style={{ animationDelay: "0.3s" }} /></>
                )}
                <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg
                  ${state === "recording" ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-200/60"
                  : state === "paused"    ? "bg-gradient-to-br from-amber-400 to-amber-500 shadow-amber-200/60"
                  :                         "bg-gradient-to-br from-sage-400 to-sage-500 shadow-sage-200/60"} text-white`}>
                  {state === "recording" ? <MicIcon className="w-9 h-9" />
                  : state === "paused"   ? <PauseIcon />
                  :                        <CheckIcon />}
                </div>
              </div>

              {/* Timer + waveform */}
              <div className="flex flex-col items-center gap-1.5">
                {state === "recording" && <WaveformBars />}
                <span className="text-2xl font-light tabular-nums text-sage-700 tracking-widest">{timerDisplay}</span>
                <span className={`text-[11px] font-medium ${
                  state === "recording" ? "text-red-400 animate-pulse" :
                  state === "paused"    ? "text-amber-500" : "text-sage-400"}`}>
                  {state === "recording" ? "● מקליט" : state === "paused" ? "⏸ מושהה" : "✓ הסתיים"}
                </span>
              </div>

              {/* Controls */}
              {state === "recording" && (
                <div className="flex gap-3 w-full">
                  <button onClick={pauseRecording}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-all active:scale-95">
                    <PauseIcon small />השהה
                  </button>
                  <button onClick={stopRecording}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-all active:scale-95">
                    <StopIcon className="w-4 h-4" />עצור
                  </button>
                </div>
              )}

              {state === "paused" && (
                <div className="flex gap-3 w-full">
                  <button onClick={resumeRecording}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-sage-500 text-white text-sm font-medium hover:bg-sage-600 shadow-sm transition-all active:scale-95">
                    <PlayIcon />המשך
                  </button>
                  <button onClick={stopRecording}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-all active:scale-95">
                    <StopIcon className="w-4 h-4" />עצור
                  </button>
                </div>
              )}

              {state === "stopped" && (
                <div className="flex flex-col gap-2.5 w-full">
                  {/* Audio player — verify recording before sending */}
                  {audioUrl && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] text-sage-400 text-center">האזיני לפני שליחה</p>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio controls src={audioUrl} className="w-full rounded-xl" />
                    </div>
                  )}
                  <button onClick={sendToAI}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 transition-all active:scale-[0.98]">
                    🪄 שלח ל-AI לסיכום
                  </button>
                  <button onClick={() => startRecording(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-sage-200 text-sage-600 text-sm font-medium hover:bg-sage-50 transition-all active:scale-[0.98]">
                    <PlusIcon />הוסף הקלטת המשך
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Error state ── */}
          {state === "error" && (
            <div className="flex flex-col items-center gap-4 w-full max-w-[300px]">
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-400">
                <XIcon />
              </div>
              <p className="text-red-500 text-sm text-center leading-relaxed px-2">{errorMsg}</p>
              {audioUrl && (
                <div className="w-full flex flex-col gap-1">
                  <p className="text-[11px] text-sage-400 text-center">ניתן להאזין לפני שליחה חוזרת</p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={audioUrl} className="w-full rounded-xl" />
                </div>
              )}
              <button onClick={sendToAI}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 transition-all active:scale-[0.98]">
                🔄 נסה לעבד שוב
              </button>
              <button onClick={reset}
                className="text-sm text-sage-400 hover:text-sage-600 transition-colors py-1">
                מחק והתחל מחדש
              </button>
            </div>
          )}

          {/* ── Idle mic ── */}
          {inputMode === "mic" && state === "idle" && (
            <>
              <p className="text-sage-500 text-sm text-center max-w-[240px] leading-relaxed">לחצי על המיקרופון להתחלת הקלטה</p>
              {micError && (
                <p className="text-red-400 text-xs text-center max-w-[260px] bg-red-50 border border-red-200 rounded-xl px-3 py-2">{micError}</p>
              )}
              <button onClick={() => startRecording(false)}
                className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-sage-500 to-sage-600 text-white shadow-sage-300/50 hover:from-sage-400 hover:to-sage-500 transition-all duration-200 active:scale-95">
                <MicIcon className="w-12 h-12" />
              </button>
              <button onClick={pasteAudioFromClipboard} disabled={pasteBusy}
                className="flex items-center gap-1.5 text-xs text-sage-400 hover:text-sage-600 transition-colors py-1">
                <PasteIcon className="w-3.5 h-3.5" />{pasteBusy ? "מדביק…" : "הדבק שמע מהלוח"}
              </button>
              {pasteError && <p className="text-red-400 text-[11px] text-center max-w-[260px]">{pasteError}</p>}
            </>
          )}

          {/* ── Audio file ── */}
          {inputMode === "audio" && state === "idle" && (
            <div className="flex flex-col items-center gap-5 w-full max-w-[300px]">
              <p className="text-sage-500 text-sm text-center leading-relaxed">העלי קובץ הקלטה לתמלול ועיבוד אוטומטי</p>
              {file ? (
                <><FilePill name={file.name} onRemove={() => { setFile(null); if (audioRef.current) audioRef.current.value = ""; }} />
                <button onClick={processAudio} className="w-full py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200">עבד קובץ שמע ←</button></>
              ) : (
                <>
                  <DropZone icon={<AudioFileIcon />} label="בחרי קובץ שמע" sub="MP3, WAV, M4A" onClick={() => audioRef.current?.click()} />
                  <button onClick={pasteAudioFromClipboard} disabled={pasteBusy}
                    className="flex items-center gap-1.5 text-xs text-sage-400 hover:text-sage-600 transition-colors py-1">
                    <PasteIcon className="w-3.5 h-3.5" />{pasteBusy ? "מדביק…" : "הדבק שמע מהלוח"}
                  </button>
                </>
              )}
              {pasteError && <p className="text-red-400 text-[11px] text-center">{pasteError}</p>}
            </div>
          )}

          {/* ── Image (multi-page) ── */}
          {inputMode === "image" && state === "idle" && (
            <div className="flex flex-col gap-4 w-full max-w-[320px]">
              <p className="text-sage-500 text-sm text-center leading-relaxed">
                צלמי או העלי דפי מחברת — ניתן להוסיף מספר עמודים
              </p>
              {/* Thumbnails grid */}
              {imageFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {imageFiles.map((img, i) => (
                    <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-sage-100 shadow-sm bg-sage-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt={`עמוד ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-tl-lg">{i + 1}</div>
                      <button onClick={() => setImageFiles((prev) => prev.filter((f) => f.id !== img.id))}
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-white">
                        <XIcon small />
                      </button>
                    </div>
                  ))}
                  {/* Add more tile */}
                  <button onClick={() => imageRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-sage-200 flex flex-col items-center justify-center gap-1 text-sage-400 hover:border-sage-400 hover:text-sage-600 hover:bg-sage-50/50 transition-all">
                    <PlusIcon small /><span className="text-[9px]">הוסף</span>
                  </button>
                </div>
              )}
              {imageFiles.length === 0 && (
                <DropZone icon={<CameraIcon />} label="צלמי / העלי עמוד" sub="JPG, PNG, PDF — ניתן לבחור מספר" onClick={() => imageRef.current?.click()} />
              )}
              {imageFiles.length > 0 && (
                <button onClick={processImages}
                  className="w-full py-4 rounded-2xl bg-sage-500 text-white font-semibold text-sm shadow-md shadow-sage-200/60 hover:bg-sage-600 active:scale-[0.98] transition-all duration-200">
                  {imageFiles.length === 1 ? "קרא עמוד וסכם ←" : `קרא ${imageFiles.length} עמודים וסכם ←`}
                </button>
              )}
            </div>
          )}

          {/* ── Personal notes mini-recorder (always visible here) ── */}
          <PersonalNotesMini />
        </div>
      )}
    </div>
  );
}
