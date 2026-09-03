"use client";

import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import { extractAudioFileFromClipboardEvent, readAudioFileFromClipboard, transcribeAudioFile, getBestMimeType } from "../lib/audio-paste";
import { compressImageToBase64 } from "../lib/image";
import { MicIcon, StopIcon, UploadIcon, PasteIcon } from "./icons";

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB — matches the server-side guard

// Reusable input: free text + voice recording + image/PDF content extraction
// + clipboard audio paste (event & button) — the app's one "combine voice,
// text and files freely" building block, used across the session and
// report-builder screens.
export default function VoiceFileTextarea({ label, placeholder, value, onChange, hint, extraAction, minRows = 4 }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: Dispatch<SetStateAction<string>>;
  hint?: string;
  extraAction?: React.ReactNode;
  minRows?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [fileError, setFileError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const append = (text: string) => onChange((prev) => (prev ? `${prev}\n${text}` : text));

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream; chunksRef.current = [];
      const mimeType = getBestMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      mr.start(250); recorderRef.current = mr; setRecording(true);
    } catch { /* mic unavailable — user can type instead */ }
  };

  const stopRecording = async () => {
    const mr = recorderRef.current;
    if (!mr || mr.state === "inactive") return;
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; recorderRef.current = null;
    setRecording(false);

    const mimeType = getBestMimeType() || "audio/webm";
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    setTranscribing(true);
    const text = await transcribeAudioFile(new File([blob], `note.${ext}`, { type: mimeType }));
    if (text) append(text);
    setTranscribing(false);
  };

  const handleFile = async (f: File) => {
    setFileError("");
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (isPdf && f.size > MAX_PDF_BYTES) {
      setFileError(`קובץ ה-PDF גדול מדי (כ-${Math.round(f.size / (1024 * 1024))}MB). נא להעלות קובץ עד 8MB, או להעלות אותו כתמונה/סריקה במקום.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setExtracting(true);
    try {
      let base64: string; let mime: string;
      if (isPdf) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error("file read failed"));
          r.readAsDataURL(f);
        });
        base64 = dataUrl.split(",")[1]; mime = f.type || "application/pdf";
      } else {
        const compressed = await compressImageToBase64(f);
        base64 = compressed.base64; mime = compressed.mime;
      }

      const res = await fetch("/api/report-builder/extract-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, fileMime: mime, fileName: f.name }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || "שגיאה בחילוץ התוכן מהקובץ. ניתן לנסות שוב.");
      }

      const data = await res.json();
      if (data.text) append(data.text);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "שגיאה בחילוץ התוכן מהקובץ. ניתן לנסות שוב.");
    } finally {
      // Privacy: the uploaded file's content is discarded from memory the instant
      // extraction finishes (or fails) — only its extracted, anonymized text remains.
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Paste a voice message copied from WhatsApp/iPhone directly, with no need
  // to save it to Files first — works while the textarea is focused (Ctrl+V).
  const handleTextareaPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const audioFile = extractAudioFileFromClipboardEvent(e);
    if (!audioFile) return; // let normal text paste proceed
    e.preventDefault();
    setFileError(""); setTranscribing(true);
    const text = await transcribeAudioFile(audioFile);
    if (text) append(text); else setFileError("לא הצלחתי לתמלל את קובץ השמע שהודבק. נסי שוב.");
    setTranscribing(false);
  };

  // Explicit button variant — reads the OS clipboard directly, for cases with
  // no focused text field to catch a native paste event.
  const handlePasteButton = async () => {
    setFileError(""); setPasting(true);
    const audioFile = await readAudioFileFromClipboard();
    if (!audioFile) {
      setFileError("לא נמצא קובץ שמע בלוח. העתיקי הודעה קולית (למשל מוואטסאפ) ונסי שוב.");
      setPasting(false);
      return;
    }
    setPasting(false); setTranscribing(true);
    const text = await transcribeAudioFile(audioFile);
    if (text) append(text); else setFileError("לא הצלחתי לתמלל את קובץ השמע שהודבק. נסי שוב.");
    setTranscribing(false);
  };

  const busy = transcribing || extracting || pasting;

  return (
    <div className="flex flex-col gap-1.5">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <div className="flex items-center justify-between px-1 flex-wrap gap-y-1.5">
        <label className="text-xs font-semibold text-sage-600">{label}</label>
        <div className="flex items-center gap-2">
          {extraAction}
          <button onClick={recording ? stopRecording : startRecording} disabled={busy}
            title="הקלטה קולית"
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95
              ${recording ? "bg-red-500 text-white animate-pulse" : "bg-sage-50 text-sage-500 hover:bg-sage-100"}`}>
            {transcribing ? <div className="w-3 h-3 rounded-full border-2 border-sage-300 border-t-sage-600 animate-spin" />
              : recording ? <StopIcon className="w-3 h-3" /> : <MicIcon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={busy}
            title="העלאת תמונה/מסמך"
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-sage-50 text-sage-500 hover:bg-sage-100 transition-all active:scale-95">
            {extracting ? <div className="w-3 h-3 rounded-full border-2 border-sage-300 border-t-sage-600 animate-spin" /> : <UploadIcon className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handlePasteButton} disabled={busy}
            title="הדבק שמע מהלוח (הודעה קולית שהועתקה)"
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-sage-50 text-sage-500 hover:bg-sage-100 transition-all active:scale-95">
            {pasting ? <div className="w-3 h-3 rounded-full border-2 border-sage-300 border-t-sage-600 animate-spin" /> : <PasteIcon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <textarea
        className="w-full bg-white/80 border border-sage-100 rounded-2xl px-4 py-3 text-sm text-gray-700 leading-relaxed outline-none focus:border-sage-400 transition-colors shadow-sm"
        style={{ minHeight: `${minRows * 1.6 + 1.5}rem` }}
        placeholder={placeholder}
        value={value} onChange={(e) => onChange(e.target.value)} onPaste={handleTextareaPaste} dir="rtl" />
      {hint && <p className="text-[10px] text-sage-400 px-1">{hint}</p>}
      {fileError && <p className="text-red-400 text-[11px] px-1">{fileError}</p>}
    </div>
  );
}
