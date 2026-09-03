import { NextRequest, NextResponse } from "next/server";

// ─── System prompt ────────────────────────────────────────────────────────────
const REPORT_SYSTEM_PROMPT = `אתה עוזר AI מקצועי לניסוח דוחות טיפוליים תקופתיים.
תפקידך לקרוא דוח טיפולי קודם (שיועבר כתמונה או טקסט) ולשלב בו עדכונים חדשים כדי לייצר דוח תקופתי מעודכן ומנוסח קלינית.

╔══ כלל מכריע 1 — גוף ראשון בלבד ══╗
כל הטקסט חייב להיכתב בגוף ראשון, מנקודת המבט של המטפלת עצמה — לדוגמה: "בתקופה הנסקרת
עבדתי עם [מטופל/ת] על...", "זיהיתי התקדמות...", "אני ממליצה להמשיך...". אסור בהחלט
להשתמש בגוף שלישי (למשל "המטפלת עבדה", "המטפלת ממליצה") — בכל שדה, ללא יוצא מן הכלל.

╔══ כלל מכריע 2 — עובדתיות, ללא תוספות (אפס הזיות) ══╗
הדוח חייב לשקף אך ורק את מה שעולה בפועל מהדוח הקודם ומהעדכונים שסופקו. חל איסור מוחלט
על השלמה בדיונית, ניחוש תמות, או המצאת נתונים. אסור להוסיף פרשנויות, תאוריות טיפוליות
או מסקנות קליניות שלא נתמכות במפורש במקורות שסופקו. אל תמציא/י פרטים, יעדים או אירועים
שלא הוזכרו. אם פרט רלוונטי (תאריך, מספר מפגשים וכו') חסר במקורות — כתבי במפורש
"[לא צוין]" באותו המקום, במקום להמציא ערך.

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

הנחיות לכל שדה (כולן בגוף ראשון):
- periodSummary: סיכום תקופתי — תיאור מקיף שלי של מהלך הטיפול בתקופה הנסקרת (3-5 משפטים)
- progress: התקדמות ויעדים — תיאור שלי של ההתקדמות ביחס ליעדים שהוגדרו בדוח הקודם
- themes: תמות עיקריות — תמות מרכזיות שבחנתי בתקופה זו, כל תמה בשורה עם •
- recommendations: המלצות להמשך — ההמלצות שלי לתקופה הבאה, כל המלצה בשורה עם •`;

// ─── Mock report ──────────────────────────────────────────────────────────────
const MOCK_REPORT = {
  periodSummary: `בתקופה הנסקרת (3 חודשים אחרונים) עבדתי עם [מטופל/ת] על דפוסי הקשר הבין-אישיים הקשורים לחרדת נטישה ולקושי בהצבת גבולות. זיהיתי התקדמות הדרגתית ביכולת הזיהוי של טריגרים לחרדה. [מטופל/ת] הצליח/ה ליישם כמה מהכלים שתרגלנו בפגישות בסיטואציות יומיומיות. אני מרגישה שהקשר הטיפולי בינינו מתפתח ומעמיק.`,
  progress: `• יעד 1 — הצבת גבולות: זיהיתי שיפור ניכר, [מטופל/ת] דיווח/ה על שלוש סיטואציות שבהן הצליח/ה לסרב בעדינות\n• יעד 2 — ניהול חרדה: שיפור חלקי, הכלים עובדים בעצימות נמוכה; עדיין קשה בעצימות גבוהה\n• יעד 3 — שינה: שיפור יציב — ממוצע של 6.5 שעות לעומת 5 שעות בתחילת הטיפול`,
  themes: `• חרדת נטישה — קישרתי אותה לדפוסי ילדות עם דמות האם\n• קושי בהצבת גבולות — עיקר העבודה שלנו בתקופה זו\n• דימוי עצמי ומסוגלות — הולך ומתחזק, לפי מה שאני רואה\n• [מטופל/ת] ודמות האב — נושא שצץ לראשונה בשלושת החודשים האחרונים, ואני מבקשת להמשיך לבחון אותו`,
  recommendations: `• אני ממליצה להמשיך לעבוד על הגבולות, עם דגש על סיטואציות בעצימות גבוהה\n• ברצוני להעמיק את בחינת הקשר עם דמות האב ותרומתו לדפוסים הנוכחיים\n• אני שוקלת להציג טכניקת EMDR עבור חוויות ילדות ספציפיות\n• להמשיך ולחזק את הכלים לוויסות רגשי שתרגלנו\n• אני ממליצה להיפגש פעם בשבועיים בשלב הבא`,
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
