import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

// ─── Structure-only extraction prompt ─────────────────────────────────────────
// Privacy: this endpoint must NEVER echo back, log, or persist any patient content
// from the uploaded sample — only the structural/stylistic shape of the document.
const SYSTEM_PROMPT = `אתה עוזר AI המתמחה בניתוח מבנה מסמכים קליניים.
המשימה שלך היא לחלץ אך ורק את המבנה הצורני של המסמך המצורף — לעולם אל תעתיק, תצטט
או תתייחס לתוכן אישי/קליני/שמות של המטופל/ת המופיעים במסמך.

חלץ:
- כותרות הסעיפים לפי הסדר המדויק שבו הם מופיעים
- טון/סגנון הכתיבה (רשמי, קליני, תמציתי, נרטיבי וכו')
- אורך משוער לכל סעיף (קצר/בינוני/ארוך)
- מבנה כללי (פסקאות רציפות / בולטים / טבלה)

פורמט הפלט — JSON בלבד, ללא כל טקסט נוסף:
{
  "sections": [{ "heading": "...", "styleNote": "...", "lengthHint": "..." }],
  "toneNote": "..."
}`;

const MOCK_STRUCTURE = {
  sections: [
    { heading: "סיכום תקופתי", styleNote: "פסקה רציפה, לשון קלינית רשמית", lengthHint: "בינוני" },
    { heading: "התקדמות ביחס ליעדים", styleNote: "בולטים לפי יעד", lengthHint: "בינוני" },
    { heading: "תמות מרכזיות", styleNote: "בולטים קצרים", lengthHint: "קצר" },
    { heading: "המלצות להמשך", styleNote: "בולטים ממוקדים", lengthHint: "קצר" },
  ],
  toneNote: "קליני רשמי, גוף שלישי",
};

// Vercel's default serverless request-body ceiling is ~4.5MB; base64 inflates
// binary size by ~33%, so we cap the decoded file well below that.
const MAX_DECODED_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_PDF_TEXT_CHARS = 9000;

function jsonError(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, message, ...extra }, { status });
}

async function callOpenAI(apiKey: string, userContent: unknown) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800,
    }),
  });
  return res;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  let body: {
    sampleBase64?: string;
    sampleMime?: string;
    sampleName?: string;
    reportType?: string;
  };
  try {
    body = await req.json();
  } catch (err) {
    console.error("[report-builder/extract-structure] invalid request body", err);
    return jsonError(400, "BAD_REQUEST", "בקשה לא תקינה.");
  }

  if (!body.sampleBase64) {
    return jsonError(400, "NO_FILE", "לא סופק קובץ דוגמה.");
  }

  const decodedBytes = Math.floor((body.sampleBase64.length * 3) / 4);
  if (decodedBytes > MAX_DECODED_BYTES) {
    return jsonError(
      413,
      "FILE_TOO_LARGE",
      `הקובץ גדול מדי (כ-${Math.round(decodedBytes / (1024 * 1024))}MB). נא להעלות קובץ עד 8MB, או לצלם/לסרוק ברזולוציה נמוכה יותר.`
    );
  }

  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ structure: MOCK_STRUCTURE });
  }

  const isPdf = body.sampleMime === "application/pdf" || /\.pdf$/i.test(body.sampleName ?? "");
  const isImage = !isPdf && (body.sampleMime?.startsWith("image/") ?? true);

  if (!isPdf && !isImage) {
    return jsonError(415, "UNSUPPORTED_TYPE", "סוג קובץ לא נתמך. נא להעלות תמונה (JPG/PNG) או PDF.");
  }

  try {
    let userContent: unknown;

    if (isPdf) {
      let pdfText = "";
      try {
        const buffer = Buffer.from(body.sampleBase64, "base64");
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        pdfText = (text ?? "").trim();
      } catch (pdfErr) {
        console.error("[report-builder/extract-structure] PDF parsing failed", {
          name: body.sampleName,
          error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        });
        return jsonError(
          422,
          "PDF_PARSE_FAILED",
          "לא הצלחנו לקרוא את קובץ ה-PDF. ייתכן שהוא פגום — נסי להעלות אותו כתמונה/סריקה (JPG/PNG) במקום."
        );
      }

      if (pdfText.replace(/\s/g, "").length < 40) {
        return jsonError(
          422,
          "PDF_NO_TEXT",
          "קובץ ה-PDF שהועלה נראה כסריקה ללא טקסט הניתן לחילוץ. נא להעלות אותו כתמונה/סריקה (JPG/PNG) במקום, או PDF שנוצר מקובץ טקסט (למשל ייצוא מ-Word)."
        );
      }

      const instruction = `סוג הדוח המבוקש: ${body.reportType || "לא צוין"}.
להלן טקסט שחולץ מקובץ PDF לדוגמה. חלץ ממנו אך ורק את המבנה הצורני שלו, כמפורט בהנחיות המערכת.

═══ טקסט המסמך ═══
${pdfText.slice(0, MAX_PDF_TEXT_CHARS)}
═══ סוף הטקסט ═══`;

      userContent = instruction;
    } else {
      const instruction = `סוג הדוח המבוקש: ${body.reportType || "לא צוין"}.
נתח את קובץ הדוגמה המצורף וחלץ ממנו אך ורק את המבנה הצורני שלו, כמפורט בהנחיות המערכת.`;

      userContent = [
        { type: "text", text: instruction },
        {
          type: "image_url",
          image_url: { url: `data:${body.sampleMime ?? "image/jpeg"};base64,${body.sampleBase64}` },
        },
      ];
    }

    // Privacy: the sample's base64/text payload lives only in this request's
    // memory — it is never written to disk/DB and goes out of scope on return.
    let res: Response;
    try {
      res = await callOpenAI(apiKey, userContent);
    } catch (networkErr) {
      console.error("[report-builder/extract-structure] OpenAI request failed", networkErr);
      return jsonError(502, "OPENAI_UNREACHABLE", "שגיאת תקשורת עם מנוע ה-AI. נסי שוב בעוד רגע.");
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[report-builder/extract-structure] OpenAI returned an error", {
        status: res.status,
        body: errText.slice(0, 1000),
      });
      return jsonError(
        res.status,
        "OPENAI_ERROR",
        "מנוע ה-AI החזיר שגיאה בעת ניתוח הקובץ. נסי שוב, או נסי קובץ אחר."
      );
    }

    const data = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      console.error("[report-builder/extract-structure] empty completion", JSON.stringify(data).slice(0, 1000));
      return jsonError(502, "EMPTY_RESPONSE", "מנוע ה-AI לא החזיר תוצאה. נסי שוב.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error("[report-builder/extract-structure] failed to parse model JSON", {
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        rawContent: rawContent.slice(0, 1000),
      });
      return jsonError(502, "INVALID_JSON", "מנוע ה-AI החזיר פלט לא תקין. נסי שוב.");
    }

    return NextResponse.json({ structure: parsed });
  } catch (err) {
    console.error("[report-builder/extract-structure] unexpected error", {
      name: body.sampleName,
      mime: body.sampleMime,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });
    return jsonError(500, "UNEXPECTED_ERROR", "שגיאה לא צפויה בזיהוי מבנה הדוגמה. נסי שוב.");
  }
}
