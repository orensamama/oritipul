export type StyleKey    = "short" | "clinical" | "thematic";
export type AppScreen   = "dashboard" | "session" | "report" | "history" | "builder";
export type ImageFile   = { id: string; file: File; preview: string };
export type SessionState = "idle" | "recording" | "paused" | "stopped" | "loading" | "result" | "error";
export type InputMode   = "mic" | "audio" | "image";
export type ReportStep  = "upload" | "updates" | "loading" | "result";

export type SessionSummary = { official: string; themes: string; insights: string; goals: string };

export interface SessionRecord {
  id: string;
  ts: number;
  summary: SessionSummary;
  personalNotes: string;
  sessionDate: string;
  sessionNumber: string;
  sessionLocation: string;
}

export interface ReportSection {
  heading: string;
  content: string;
}

export type ReportTemplateKey = "extension" | "periodic" | "psychiatrist" | "final";

export interface TherapistProfile {
  therapistName: string;
  therapistTitle: string;
  therapistLicense: string;
  therapistFramework: string;
}
