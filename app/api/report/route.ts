import { NextRequest, NextResponse } from "next/server";

// ─── System prompt ────────────────────────────────────────────────────────────
const REPORT_SYSTEM_PROMPT = `אתה עוזר AI מקצועי לניסוח דוחות טיפוליים תקופתיים.
תפקידך לקרוא דוח טיפולי קודם (שיועבר כתמונה או טקסט) ולשלב בו עדכונים חדשים כדי לייצר דוח תקופתי מעודכן ומנוסח קלינית.

כללי אנונימיזציה (חובה):
- החלף כל שם פרטי של מטופל/ת ב-[מטופל/ת]
- שמות של בני משפחה — השאר את הקשר המשפחתי בלבד (אמא, אח וכו') ללא שמות פרטיים
- שמות של אנשים אחרים — החלף ב-[שם]

פורמט הפלט — JSON בלבד, ללא טקסט נוסף:
{
  "periodSummary": "...",
  "progress": "...",
  "themes": "...",
  "recommendations": "..."
}

הנחיות לכל שדה:
- periodSummary: סיכום תקופתי — תיאור מקיף של מהלך הטיפול בתקופה הנסקרת (3-5 משפטים)
- progress: התקדמות ויעדים — תיאור ההתקדמות ביחס ליעדים שהוגדרו בדוח הקודם
- themes: תמות עיקריות — תמות מרכזיות שנבחנו בתקופה זו, כל תמה בשורה עם •
- recommendations: המלצות להמשך — המלצות לתקופה הבאה, כל המלצה בשורה עם •`;

// ─── Mock report ──────────────────────────────────────────────────────────────
const MOCK_REPORT = {
  periodSummary: `בתקופה הנסקרת (3 חודשים אחרונים) עבדה [מטופל/ת] על דפוסי הקשר הבין-אישיים הקשורים לחרדת נטישה ולקושי בהצבת גבולות. ניכרת התקדמות הדרגתית ביכולת הזיהוי של טריגרים לחרדה. [מטופל/ת] הצליחה ליישם כמה מהכלים שנלמדו בפגישות בסיטואציות יומיומיות. מערכת הקשר הטיפולי מתפתחת ומעמיקה.`,
  progress: `• יעד 1 — הצבת גבולות: שיפור ניכר, [מטופל/ת] דיווחה על שלוש סיטואציות שבהן הצליחה לסרב בעדינות\n• יעד 2 — ניהול חרדה: שיפור חלקי, הכלים עובדים בעצימות נמוכה; עדיין קשה בעצימות גבוהה\n• יעד 3 — שינה: שיפור יציב — ממוצע של 6.5 שעות לעומת 5 שעות בתחילת הטיפול`,
  themes: `• חרדת נטישה — מקושרת לדפוסי ילדות עם דמות האם\n• קושי בהצבת גבולות — עיקר העבודה הטיפולית בתקופה זו\n• דימוי עצמי ומסוגלות — הולך ומתחזק\n• [מטופל/ת] ודמות האב — נושא שצץ לראשונה בשלושת החודשים האחרונים, דורש המשך בחינה`,
  recommendations: `• להמשיך לעבוד על הגבולות, עם דגש על סיטואציות בעצימות גבוהה\n• להעמיק את בחינת הקשר עם דמות האב ותרומתו לדפוסים הנוכחיים\n• לשקול הצגת טכניקת EMDR עבור חוויות ילדות ספציפיות\n• להמשיך ולחזק את הכלים לוויסות רגשי\n• מומלץ להיפגש פעם בשבועיים בשלב הבא`,
};

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const body = await req.json() as {
      oldReportBase64?: string;
      oldReportMime?: string;
      updates?: string;
      style?: string;
    };

    // Simulation mode
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json(MOCK_REPORT);
    }

    // Build user message content
    const userContent: object[] = [];

    const instruction = `על פי הדוח הקודם והעדכונים שסופקו, כתוב דוח תקופתי מעודכן.
סגנון: ${body.style ?? "קליני מורחב"}.
${body.updates ? `\nעדכונים חדשים מהמטפלת:\n${body.updates}` : ""}`;

    if (body.oldReportBase64) {
      userContent.push({ type: "text", text: instruction });
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${body.oldReportMime ?? "image/jpeg"};base64,${body.oldReportBase64}`,
        },
      });
    } else {
      userContent.push({ type: "text", text: instruction });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: REPORT_SYSTEM_PROMPT },
          { role: "user",   content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
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
