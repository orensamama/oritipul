import { NextRequest, NextResponse } from "next/server";
import { MAX_DECODED_BYTES, MAX_PDF_TEXT_CHARS, decodedByteLength, detectFileKind, extractPdfText, jsonError } from "../shared";

// ─── Content extraction prompt (current patient) ──────────────────────────────
// Unlike extract-structure, this endpoint DOES extract real clinical content —
// it exists to turn a photo/PDF of session notes into text for the "content"
// field — but every identifying detail must still be anonymized before return.
const SYSTEM_PROMPT = `אתה עוזר AI לחילוץ תוכן מתרשומות טיפוליות (כתב יד, הקלדה, תמונה או PDF)
עבור המטופל/ת הנוכחי/ת.

קרא בעיון את המסמך המצורף וחלץ ממנו את כל המידע הקליני הרלוונטי: תמות מרכזיות, אירועים,
התקדמות, סיבות (למשל סיבה לבקשת הארכה), ופרטים משמעותיים אחרים — בצורה מסודרת, ברורה
וקריאה בעברית, שתשמש כתוכן גולמי להזנה לדוח טיפולי.

══ כללי אנונימיזציה (חובה מוחלטת) ══
- שם המטופל/ת → [מטופל/ת]
- בני משפחה → [אם], [אב], [אח], [אחות], [בן/בת זוג], [ילד/ה], [סבא/סבתא]
- אנשים אחרים (מטפלים, מורים, רופאים וכו') → [שם] או תפקידם הגנרי בלבד
- לעולם אל תכללי שם פרטי אמיתי, מספר זהות, או שם מוסד מזהה בפלט

אל תמציאי מידע שלא מופיע במסמך. אם המסמך קצר או חלקי, חלצי את מה שקיים בלבד.

פורמט הפלט — JSON בלבד, ללא כל טקסט נוסף:
{ "text": "..." }`;

const MOCK_CONTENT = {
  text: `[מטופל/ת] דיווח/ה על שיפור בתפקוד היומיומי ובניהול החרדה. עלו תמות של קושי בהצבת גבולות מול הסביבה הקרובה, לצד תחושת התקדמות ביחס למטרות הטיפול שהוגדרו בתחילת התהליך. מבוקשת הארכת טיפול לתקופה נוספת לצורך המשך עבודה על הנושאים הללו.`,
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  let body: { fileBase64?: string; fileMime?: string; fileName?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error("[report-builder/extract-content] invalid request body", err);
    return jsonError(400, "BAD_REQUEST", "בקשה לא תקינה.");
  }

  if (!body.fileBase64) {
    return jsonError(400, "NO_FILE", "לא סופק קובץ.");
  }

  const decodedBytes = decodedByteLength(body.fileBase64);
  if (decodedBytes > MAX_DECODED_BYTES) {
    return jsonError(
      413,
      "FILE_TOO_LARGE",
      `הקובץ גדול מדי (כ-${Math.round(decodedBytes / (1024 * 1024))}MB). נא להעלות קובץ עד 8MB, או לצלם/לסרוק ברזולוציה נמוכה יותר.`
    );
  }

  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json(MOCK_CONTENT);
  }

  const kind = detectFileKind(body.fileMime, body.fileName);
  if (kind === "unsupported") {
    return jsonError(415, "UNSUPPORTED_TYPE", "סוג קובץ לא נתמך. נא להעלות תמונה (JPG/PNG) או PDF.");
  }

  try {
    let userContent: unknown;

    if (kind === "pdf") {
      let pdfText = "";
      try {
        pdfText = await extractPdfText(body.fileBase64);
      } catch (pdfErr) {
        console.error("[report-builder/extract-content] PDF parsing failed", {
          name: body.fileName,
          error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        });
        return jsonError(
          422,
          "PDF_PARSE_FAILED",
          "לא הצלחנו לקרוא את קובץ ה-PDF. ייתכן שהוא פגום — נסי להעלות אותו כתמונה/סריקה (JPG/PNG) במקום."
        );
      }

      if (pdfText.replace(/\s/g, "").length < 20) {
        return jsonError(
          422,
          "PDF_NO_TEXT",
          "קובץ ה-PDF שהועלה נראה כסריקה ללא טקסט הניתן לחילוץ. נא להעלות אותו כתמונה/סריקה (JPG/PNG) במקום."
        );
      }

      userContent = `להלן טקסט שחולץ מקובץ PDF. חלצי ממנו את התוכן הקליני הרלוונטי לפי ההנחיות, עם אנונימיזציה מלאה.

═══ טקסט המסמך ═══
${pdfText.slice(0, MAX_PDF_TEXT_CHARS)}
═══ סוף הטקסט ═══`;
    } else {
      userContent = [
        {
          type: "text",
          text: "התמונה המצורפת מכילה תרשומות טיפוליות (ייתכן כתב יד). חלצי ממנה את התוכן הקליני הרלוונטי לפי ההנחיות, עם אנונימיזציה מלאה.",
        },
        {
          type: "image_url",
          image_url: { url: `data:${body.fileMime ?? "image/jpeg"};base64,${body.fileBase64}`, detail: "high" },
        },
      ];
    }

    // Privacy: the file's base64/text payload lives only in this request's
    // memory — it is never written to disk/DB and goes out of scope on return.
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
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
          temperature: 0.2,
          max_tokens: 1200,
        }),
      });
    } catch (networkErr) {
      console.error("[report-builder/extract-content] OpenAI request failed", networkErr);
      return jsonError(502, "OPENAI_UNREACHABLE", "שגיאת תקשורת עם מנוע ה-AI. נסי שוב בעוד רגע.");
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("[report-builder/extract-content] OpenAI returned an error", {
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
      console.error("[report-builder/extract-content] empty completion", JSON.stringify(data).slice(0, 1000));
      return jsonError(502, "EMPTY_RESPONSE", "מנוע ה-AI לא החזיר תוצאה. נסי שוב.");
    }

    let parsed: { text?: string };
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error("[report-builder/extract-content] failed to parse model JSON", {
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        rawContent: rawContent.slice(0, 1000),
      });
      return jsonError(502, "INVALID_JSON", "מנוע ה-AI החזיר פלט לא תקין. נסי שוב.");
    }

    return NextResponse.json({ text: parsed.text ?? "" });
  } catch (err) {
    console.error("[report-builder/extract-content] unexpected error", {
      name: body.fileName,
      mime: body.fileMime,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });
    return jsonError(500, "UNEXPECTED_ERROR", "שגיאה לא צפויה בחילוץ התוכן. נסי שוב.");
  }
}
