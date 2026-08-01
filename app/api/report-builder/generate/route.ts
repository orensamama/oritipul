import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `אתה עוזר AI מקצועי לניסוח דוחות טיפוליים מותאמים אישית.
תקבל: (1) מבנה צורני שנלמד ממסמך דוגמה (כותרות סעיפים, סגנון, טון), (2) סוג הדוח המבוקש,
(3) הנחיות חופשיות מהמטפלת, (4) תוכן/תמלול/תמות מהפגישה או מהתקופה הנוכחית.

תפקידך להלביש את התוכן הנוכחי בתוך המבנה שנלמד, בהתאם להנחיות ולסגנון שהוגדר.

══ כללי אנונימיזציה (חובה מוחלטת) ══
- שם המטופל/ת → [מטופל/ת] (לעולם אל תשתמשי בשם אמיתי אם הוזכר בתוכן)
- בני משפחה → [אם], [אב], [אח], [אחות], [בן/בת זוג], [ילד/ה], [סבא/סבתא]
- אנשים אחרים → [שם]

══ פורמט הפלט — JSON בלבד, ללא כל טקסט נוסף ══
{
  "sections": [{ "heading": "...", "content": "..." }]
}
השתמשי בכותרות הסעיפים ובסדר שנלמד מהמבנה (או התאימי אותם באופן סביר לסוג הדוח אם חסר מידע).
כל תוכן סעיף מנוסח בעברית קלינית מקצועית, בגוף שלישי.`;

const MOCK_SECTIONS = [
  {
    heading: "סיכום תקופתי",
    content: `בתקופה הנסקרת עבדה [מטופל/ת] על נושאים מרכזיים שעלו בפגישות, תוך התקדמות הדרגתית ביכולת הזיהוי וההתמודדות עם קשיים רגשיים. ניכר שיפור במידת המודעות העצמית ובתחושת המסוגלות.`,
  },
  {
    heading: "התקדמות ביחס ליעדים",
    content: `• יעד ראשון — שיפור ניכר, עם יישום מוצלח של כלים שנלמדו בפגישות\n• יעד שני — שיפור חלקי, נדרשת המשך עבודה ממוקדת`,
  },
  {
    heading: "תמות מרכזיות",
    content: `• חרדת נטישה וקשיים בהצבת גבולות\n• דימוי עצמי ומסוגלות — הולך ומתחזק`,
  },
  {
    heading: "המלצות להמשך",
    content: `• המשך עבודה ממוקדת על הנושאים שעלו\n• לשקול תדירות פגישות מותאמת לשלב הטיפולי הנוכחי`,
  },
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const body = (await req.json()) as {
      structure?: unknown;
      reportType?: string;
      guidelines?: string;
      content?: string;
    };

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 1800));
      return NextResponse.json({ sections: MOCK_SECTIONS });
    }

    const instruction = `סוג הדוח: ${body.reportType || "דוח כללי"}.

מבנה שנלמד ממסמך הדוגמה:
${JSON.stringify(body.structure ?? {}, null, 2)}

הנחיות ודגשים מהמטפלת:
${body.guidelines || "אין הנחיות מיוחדות — כתבי בסגנון קליני מקצועי סטנדרטי."}

תוכן/תמלול/תמות מהפגישה או מהתקופה הנוכחית:
${body.content || "לא סופק תוכן נוסף — התבססי על הנחיות המטפלת בלבד."}`;

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
          { role: "user", content: instruction },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
