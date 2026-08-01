import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const body = (await req.json()) as {
      sampleBase64?: string;
      sampleMime?: string;
      reportType?: string;
    };

    if (!body.sampleBase64) {
      return NextResponse.json({ error: "לא סופק קובץ דוגמה" }, { status: 400 });
    }

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 1200));
      return NextResponse.json({ structure: MOCK_STRUCTURE });
    }

    const instruction = `סוג הדוח המבוקש: ${body.reportType || "לא צוין"}.
נתח את קובץ הדוגמה המצורף וחלץ ממנו אך ורק את המבנה הצורני שלו, כמפורט בהנחיות המערכת.`;

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
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              {
                type: "image_url",
                image_url: { url: `data:${body.sampleMime ?? "image/jpeg"};base64,${body.sampleBase64}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    // The sample's base64 payload lived only in this request's memory — it is
    // never written to disk/DB and goes out of scope as soon as this handler returns.
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({ structure: parsed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
