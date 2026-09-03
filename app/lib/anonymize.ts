// Server-only deterministic anonymization backstop. Prompts instruct the model
// to anonymize on its own, but an LLM instruction is probabilistic — this
// module is the guarantee layer: it runs on every OpenAI response before it
// is ever sent back to the client, so a missed name cannot reach the browser,
// clipboard, a download, or any external system the therapist pastes it into.
//
// The real patient name (when the therapist supplies one, purely as a "please
// scrub this if you see it" hint) is used ONLY here, in our own server code,
// to post-process OpenAI's response. It is never included in the prompt/request
// sent TO OpenAI — see each route's callOpenAI-style function for that boundary.

// The canonical placeholder the rest of the app already keys off (highlighting
// in applyHighlights, and the client-side display-name substitution feature).
export const PATIENT_TOKEN = "[מטופל/ת]";

// Every bracketed form a prompt might reasonably produce — including the
// exact wording requested for the anonymization rule ("[המטופל/ת]" /
// "[הפונה]") — gets normalized to the one token the app's UI understands.
const PATIENT_TOKEN_VARIANTS = [
  "[המטופל/ת]", "[המטופלת]", "[המטופל]",
  "[הפונה/ת]", "[הפונה]",
  "[מטופל/ת]", "[מטופלת]", "[מטופל]",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePatientTokens(text: string): string {
  let out = text;
  for (const variant of PATIENT_TOKEN_VARIANTS) {
    if (variant === PATIENT_TOKEN) continue;
    out = out.split(variant).join(PATIENT_TOKEN);
  }
  return out;
}

// Deterministically strips every occurrence of any explicitly-known
// identifying name (and each of its individual words, so "Dana Cohen"
// mentioned only as "Dana" elsewhere still gets caught) from AI-generated
// text. This is a blanket replace by design — for a privacy-critical field,
// over-redacting a rare false-positive substring is preferable to missing a
// real name.
function scrubKnownNames(text: string, names: (string | undefined | null)[]): string {
  let out = text;
  const parts = new Set<string>();
  for (const raw of names) {
    const name = raw?.trim();
    if (!name || name.length < 2) continue;
    parts.add(name);
    for (const word of name.split(/\s+/)) {
      if (word.length > 1) parts.add(word);
    }
  }
  // Longest-first so a full name is replaced before its individual words,
  // avoiding a partially-scrubbed leftover fragment.
  for (const part of Array.from(parts).sort((a, b) => b.length - a.length)) {
    out = out.split(part).join(PATIENT_TOKEN);
  }
  return out;
}

export function sanitizeAnonymization(text: string, knownNames: (string | undefined | null)[] = []): string {
  return scrubKnownNames(normalizePatientTokens(text), knownNames);
}

// Recursively applies sanitizeAnonymization to every string in a JSON-like
// value (object/array of any shape), so a route can run it on its whole
// parsed response in one call regardless of its exact field structure.
export function sanitizeJsonStrings<T>(value: T, knownNames: (string | undefined | null)[] = []): T {
  if (typeof value === "string") {
    return sanitizeAnonymization(value, knownNames) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeJsonStrings(v, knownNames)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeJsonStrings(v, knownNames);
    }
    return out as T;
  }
  return value;
}
