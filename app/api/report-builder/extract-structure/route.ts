import { NextRequest, NextResponse } from "next/server";
import { MAX_DECODED_BYTES, MAX_PDF_TEXT_CHARS, decodedByteLength, detectFileKind, extractPdfText, jsonError } from "../shared";

// ─── Structure-only extraction prompt ─────────────────────────────────────────
// Privacy: this endpoint must NEVER echo back, log, or persist any patient content
// from the uploaded sample — only the structural/stylistic shape of the document.
const SYSTEM_PROMPT = `אתה עוזר AI המתמחה בניתוח מבנה מסמכים קליניים (Structural Template Extraction).

המשימה שלך היא לחלץ אך ורק את ה"שלד" הצורני הריק של המסמך המצורף — סדר הכותרות, הסגנון
והאורך של כל סעיף — ולעולם לא תוכן אמיתי מתוכו.

╔══ איסור מוחלט — קרא בעיון ══╗
לעולם, בשום פנים ואופן, אל תכלול בפלט:
- שם פרטי או משפחה של מטופל/ת, מטפלת, גורם מפנה, או כל אדם אחר שמופיע במסמך
- תאריכים ספציפיים, מספרי זהות/תיק, שמות מוסדות/בתי ספר/מרפאות/ארגונים
- כל משפט, פסקה, ציטוט או תיאור מקרה מהתוכן הקליני עצמו
- כל פרט המזהה את המטופל/ת באופן ישיר או עקיף

מותר ורצוי לכלול אך ורק כותרות-סעיפים גנריות (labels ריקים), לדוגמה עבור מכתב בקשת
הארכת טיפול טיפוסי:
"לכבוד" • "הנידון" • "סיבת ותאריך ההפניה" • "תמות מרכזיות שעוסקים בהם בטיפול" •
"סיבה לבקשת הארכה" • "בכבוד רב, שם המטפלת וחתימה"
— אלה כותרות-על גנריות בלבד, לא התוכן שממלא אותן במסמך המקורי.

אם כותרת בפועל במסמך מכילה פרט מזהה (למשל "לכבוד ד״ר כהן, מרפאת X"), הפכי אותה לכותרת
הגנרית המקבילה בלבד ("לכבוד") — בלי השם או הפרט המזהה.

חלץ:
- כותרות הסעיפים בלבד, לפי הסדר המדויק שבו הן מופיעות במסמך (labels גנריים, לא תוכן)
- טון/סגנון הכתיבה (רשמי, קליני, תמציתי, נרטיבי וכו')
- אורך משוער לכל סעיף (קצר/בינוני/ארוך)

פורמט הפלט — JSON בלבד, ללא כל טקסט נוסף:
{
  "sections": [{ "heading": "...", "styleNote": "...", "lengthHint": "..." }],
  "toneNote": "..."
}`;

const MOCK_STRUCTURE = {
  sections: [
    { heading: "לכבוד", styleNote: "פנייה רשמית לגורם מפנה", lengthHint: "קצר" },
    { heading: "הנידון", styleNote: "שורת נושא קצרה", lengthHint: "קצר" },
    { heading: "סיבת ותאריך ההפניה", styleNote: "משפט או שניים, לשון רשמית", lengthHint: "קצר" },
    { heading: "תמות מרכזיות שעוסקים בהם בטיפול", styleNote: "בולטים קצרים", lengthHint: "בינוני" },
    { heading: "סיבה לבקשת הארכה", styleNote: "פסקה קצרה, לשון קלינית רשמית", lengthHint: "בינוני" },
    { heading: "בכבוד רב, שם המטפלת וחתימה", styleNote: "סגירה רשמית", lengthHint: "קצר" },
  ],
  toneNote: "קליני רשמי, גוף שלישי",
};

// Defensive backstop: structural headings/notes should always be short generic
// labels, never full sentences — if the model ever echoes real document
// content despite the prompt, truncating anomalously long fields limits the
// blast radius instead of silently forwarding it into the saved template.
const MAX_HEADING_CHARS = 60;
const MAX_NOTE_CHARS = 140;
const MAX_TONE_CHARS = 200;

function sanitizeStructure(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return { sections: [], toneNote: "" };
  const obj = raw as Record<string, unknown>;
  const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
  const sections = rawSections
    .map((s) => {
      const sec = (s ?? {}) as Record<string, unknown>;
      return {
        heading: String(sec.heading ?? "").slice(0, MAX_HEADING_CHARS).trim(),
        styleNote: String(sec.styleNote ?? "").slice(0, MAX_NOTE_CHARS).trim(),
        lengthHint: String(sec.lengthHint ?? "").slice(0, 20).trim(),
      };
    })
    .filter((s) => s.heading);
  return { sections, toneNote: String(obj.toneNote ?? "").slice(0, MAX_TONE_CHARS).trim() };
}

async function callOpenAI(apiKey: string, userContent: unknown) {
  return fetch("https://api.openai.com/v1/chat/completions", {
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

  const decodedBytes = decodedByteLength(body.sampleBase64);
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

  const kind = detectFileKind(body.sampleMime, body.sampleName);
  if (kind === "unsupported") {
    return jsonError(415, "UNSUPPORTED_TYPE", "סוג קובץ לא נתמך. נא להעלות תמונה (JPG/PNG) או PDF.");
  }

  try {
    let userContent: unknown;

    if (kind === "pdf") {
      let pdfText = "";
      try {
        pdfText = await extractPdfText(body.sampleBase64);
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
זכור: כותרות-סעיפים גנריות בלבד — לעולם לא שמות, תאריכים או תוכן קליני מתוך הטקסט.

═══ טקסט המסמך ═══
${pdfText.slice(0, MAX_PDF_TEXT_CHARS)}
═══ סוף הטקסט ═══`;

      userContent = instruction;
    } else {
      const instruction = `סוג הדוח המבוקש: ${body.reportType || "לא צוין"}.
נתח את קובץ הדוגמה המצורף וחלץ ממנו אך ורק את המבנה הצורני שלו, כמפורט בהנחיות המערכת.
זכור: כותרות-סעיפים גנריות בלבד — לעולם לא שמות, תאריכים או תוכן קליני מתוך המסמך.`;

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

    return NextResponse.json({ structure: sanitizeStructure(parsed) });
  } catch (err) {
    console.error("[report-builder/extract-structure] unexpected error", {
      name: body.sampleName,
      mime: body.sampleMime,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });
    return jsonError(500, "UNEXPECTED_ERROR", "שגיאה לא צפויה בזיהוי מבנה הדוגמה. נסי שוב.");
  }
}
