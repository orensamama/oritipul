import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

// Vercel's default serverless request-body ceiling is ~4.5MB; base64 inflates
// binary size by ~33%, so we cap the decoded file well below that.
export const MAX_DECODED_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_PDF_TEXT_CHARS = 9000;

export function jsonError(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, message, ...extra }, { status });
}

export function decodedByteLength(base64: string) {
  return Math.floor((base64.length * 3) / 4);
}

export function detectFileKind(mime: string | undefined, name: string | undefined): "pdf" | "image" | "unsupported" {
  const isPdf = mime === "application/pdf" || /\.pdf$/i.test(name ?? "");
  if (isPdf) return "pdf";
  if (!mime || mime.startsWith("image/")) return "image";
  return "unsupported";
}

export async function extractPdfText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (text ?? "").trim();
}
