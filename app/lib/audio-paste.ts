// Lets a therapist paste a voice message copied from WhatsApp/iPhone straight
// into a recording area, instead of saving it to Files first. Two entry points:
// a passive paste-event listener (works while a text field is focused, no
// permission prompt) and an explicit clipboard read (works from a button
// click anywhere, e.g. areas with no focused text field).

export function getBestMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function extractAudioFileFromClipboardEvent(e: ClipboardEvent | React.ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type.startsWith("audio/")) {
      return item.getAsFile();
    }
  }
  return null;
}

export async function readAudioFileFromClipboard(): Promise<File | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const audioType = item.types.find((t) => t.startsWith("audio/"));
      if (audioType) {
        const blob = await item.getType(audioType);
        const ext = audioType.split("/")[1]?.split(";")[0]?.split("+")[0] || "webm";
        return new File([blob], `pasted-audio.${ext}`, { type: audioType });
      }
    }
  } catch {
    // permission denied, unsupported browser, or no audio on the clipboard
  }
  return null;
}

export async function transcribeAudioFile(file: File): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", file, file.name || "pasted-audio.webm");
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    if (!res.ok) return null;
    const { text } = await res.json();
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}
