import type { SessionRecord, SessionSummary } from "./types";

// ─── Draft persistence (24-hour auto-delete) ──────────────────────────────────
const DRAFT_KEY = "sessionDraft_v1";
const DRAFT_TTL = 24 * 60 * 60 * 1000;

export interface SessionDraft {
  ts: number;
  summary: SessionSummary;
  personalNotes: string;
  sessionDate: string;
  sessionNumber: string;
  sessionLocation: string;
  exportInclude: { official: boolean; themes: boolean; insights: boolean; goals: boolean };
}

export function loadDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SessionDraft;
    if (Date.now() - d.ts > DRAFT_TTL) { localStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
}
export function saveDraft(d: Omit<SessionDraft, "ts">) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, ts: Date.now() })); } catch { /* quota */ }
}
export function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }

// ─── Session history (multiple 24-hour records) ───────────────────────────────
const HISTORY_KEY = "sessionHistory_v1";

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as SessionRecord[];
    const fresh = all.filter((r) => Date.now() - r.ts < DRAFT_TTL);
    if (fresh.length !== all.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(fresh));
    return fresh;
  } catch { return []; }
}
export function pushHistory(rec: Omit<SessionRecord, "id" | "ts">) {
  try {
    const existing = loadHistory();
    const newRec: SessionRecord = { ...rec, id: `${Date.now()}`, ts: Date.now() };
    localStorage.setItem(HISTORY_KEY, JSON.stringify([newRec, ...existing].slice(0, 30)));
  } catch { /* quota */ }
}
export function deleteHistory(id: string) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(loadHistory().filter((r) => r.id !== id))); }
  catch { /* ignore */ }
}
