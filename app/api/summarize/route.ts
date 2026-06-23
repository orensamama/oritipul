import { NextRequest, NextResponse } from "next/server";

// ─── Anonymization + summarization prompt ─────────────────────────────────────
const SYSTEM_PROMPT = `אתה עוזר AI מקצועי לסיכום פגישות טיפוליות. תפקידך לנתח תמלול של פגישה ולהפיק סיכום מובנה.

כללי אנונימיזציה (חובה):
- אם מופיע שם פרטי של מטופל/ת בטקסט, החלף אותו ב-[מטופל/ת]
- שמות של בני משפחה (אחות, אח, אבא, אמא וכו') — השאר את הקשר המשפחתי אך אל תזכיר שמות פרטיים
- אנשים אחרים הנזכרים (חברה, קולגה וכו') — אל תזכיר שמות פרטיים

פורמט הפלט — JSON בלבד, ללא כל טקסט נוסף לפני או אחרי:
{
  "main": "...",
  "themes": "...",
  "next": "..."
}

הנחיות לכל שדה:
- main: תיאור קצר של עיקרי הפגישה, נכתב בגוף שלישי, 3-5 משפטים
- themes: תמות מרכזיות שעלו, כל תמה בשורה חדשה עם •
- next: נקודות לטיפול בפגישה הבאה, כל נקודה בשורה חדשה עם •`;

// ─── Mock responses ───────────────────────────────────────────────────────────
const MOCK_TEXT_SUMMARY = {
  main: `[מטופל/ת] הגיעה לפגישה ודיווחה על קשיים בסביבת העבודה ותחושת חוסר שייכות לצוות. עלה נושא מרכזי של קשיים בהצבת גבולות — הן בעבודה והן מול בני המשפחה. [מטופל/ת] הביעה מודעות לדפוס זה ורצון לשנות אותו. הרגש שעלה בפגישה היה עצבות בעצימות בינונית.`,
  themes: `• קשיים בהצבת גבולות — מול בני משפחה ועמיתים לעבודה\n• תחושת חוסר שייכות בסביבה המקצועית\n• דפוסים מוקדמים הקשורים לדמות האב\n• מודעות עצמית גוברת ורצון לשינוי`,
  next: `• לעבוד על מיומנויות הצבת גבולות — תרגול מעשי\n• לבחון את הדפוס עם דמות האב וקשרו להווה\n• תרגיל בית: לרשום שלוש סיטואציות שבהן [מטופל/ת] הצליחה לומר "לא"\n• לעקוב אחר תחושת השייכות בעבודה בפגישה הבאה`,
};

const MOCK_IMAGE_SUMMARY = {
  main: `הערות מהמחברת עובדו בהצלחה. [מטופל/ת] תיארה תחושות של עייפות רגשית ועומס. עלה קושי בניהול זמן ובסדרי עדיפויות. [מטופל/ת] ציינה שיפור קל בדפוסי השינה לעומת הפגישה הקודמת.`,
  themes: `• עייפות רגשית ותחושת עומס\n• קשיים בניהול זמן וסדרי עדיפויות\n• שיפור בשינה — נקודת חוזק לחיזוק\n• רצון לשינוי — מוטיבציה פנימית קיימת`,
  next: `• לחקור את מקורות העומס הרגשי\n• לבנות יחד תוכנית קטנה לניהול זמן\n• להמשיך לחזק את השיפור בשינה\n• תרגיל בית: 10 דקות ביומן יומי`,
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const body = await req.json() as {
      text?: string;
      imageBase64?: string;
      mimeType?: string;
      style?: string;
    };

    // Simulation mode — no API key
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 1500));
      const mock = body.imageBase64 ? MOCK_IMAGE_SUMMARY : MOCK_TEXT_SUMMARY;
      return NextResponse.json(mock);
    }

    // Build messages for GPT-4o
    const userContent: object[] = [];

    if (body.imageBase64) {
      userContent.push({
        type: "text",
        text: `קרא את הכתוב בתמונה זו (הערות מחברת טיפולית) וסכם לפי ההנחיות. סגנון: ${body.style ?? "קליני מורחב"}.`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${body.mimeType ?? "image/jpeg"};base64,${body.imageBase64}` },
      });
    } else {
      userContent.push({
        type: "text",
        text: `סכם את הפגישה הטיפולית הבאה. סגנון: ${body.style ?? "קליני מורחב"}.\n\nתמלול:\n${body.text}`,
      });
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
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
