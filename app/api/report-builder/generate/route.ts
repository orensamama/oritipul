import { NextRequest, NextResponse } from "next/server";
import type { ReportTemplateKey } from "../../../lib/types";
import { sanitizeJsonStrings } from "../../../lib/anonymize";

const TEMPLATE_LABELS: Record<ReportTemplateKey, string> = {
  extension:    "דוח לבקשת הארכה/הערכה",
  periodic:     "סיכום טיפול תקופתי",
  psychiatrist: "דוח לפסיכיאטר/רופא",
  final:        "דוח סיכום סופי",
};

// The extension-request template has a hard, non-negotiable structure — every
// other template gets guidance, not a rigid section list, since real intake
// paperwork varies by clinic. The closing "סיום" section for the extension
// template is deliberately NOT requested from the model here — it's appended
// deterministically from the therapist's saved profile after the AI call, so
// the signature block can never be hallucinated.
const EXTENSION_STRUCTURE = `עבור סוג דוח זה (בקשת הארכה/הערכה), חובה לבנות את הדוח בדיוק לפי חמשת הסעיפים הבאים,
בסדר הזה, ולא לכלול סעיף חתימה/סיום — הוא יתווסף אוטומטית בנפרד:

1. heading: "הנדון"
   תוכן: משפט אחד — "בקשת הערכה/הארכה לטיפול עבור [מטופל/ת], ת.ז. [לא צוין]" (או מספר הזהות
   אם צוין במפורש בחומר, אחרת "[לא צוין]").

2. heading: "רקע ונתוני טיפול"
   תוכן: פסקה רציפה בגוף ראשון הכוללת: גיל, מצב משפחתי, מגורים, סיבת הפנייה, תאריך תחילת
   הטיפול, כמות המפגשים שהתקיימו, סדירות ההגעה, ומידת ההיענות והשיתוף של [מטופל/ת].
   כל פרט שאינו קיים בחומר שסופק — כתבי "[לא צוין]" באותו המקום, ואל תמציאי ערך.

3. heading: "תמות ונושאים מרכזיים"
   תוכן: סריקה וסינתזה בגוף ראשון של התמות הרוחביות והעבודה הטיפולית, מבוססת אך ורק על
   התוכן וההיסטוריה שסופקו.

4. heading: "המצב הנוכחי"
   תוכן: תיאור בגוף ראשון של המצב הרגשי/תפקודי במפגשים האחרונים, כוחות, גורמי תמיכה או
   טיפולים משלימים — רק אם עולים מהחומר; אחרת "[לא צוין]".

5. heading: "סיכום והמלצה קלינית"
   תוכן: חיבור קליני בגוף ראשון בין מורכבות התכנים והמצב הנוכחי לבין היכולת של [מטופל/ת]
   להסתייע בטיפול, ומשם המלצה מפורשת וברורה להארכת הטיפול.`;

const OTHER_TEMPLATE_GUIDANCE: Record<Exclude<ReportTemplateKey, "extension">, string> = {
  periodic: `עבור סוג דוח זה (סיכום טיפול תקופתי), בני מבנה הכולל: תאריכים רלוונטים (תחילת טיפול,
התקופה הנסקרת), תדירות המפגשים, סיבת הפנייה, תיאור מהלך הטיפול, וסיכום. השתמשי במבנה
שנלמד מהדוגמה (אם סופק) כבסיס לכותרות הסעיפים; אחרת התאימי כותרות סבירות לפי הרשימה הזו.`,
  psychiatrist: `עבור סוג דוח זה (דוח לפסיכיאטר/רופא), בני מבנה המתמקד בפירוט קליני מדויק: תסמינים,
מהלך והתקדמות, תפקוד יומיומי (שינה, תזונה, עבודה/לימודים, מערכות יחסים), והתייחסות לאבחנה
או להשערה אבחנתית אם עלתה בחומר. שפה קלינית תמציתית ומדויקת. השתמשי במבנה שנלמד מהדוגמה
(אם סופק) כבסיס לכותרות הסעיפים; אחרת התאימי כותרות סבירות לפי הרשימה הזו.`,
  final: `עבור סוג דוח זה (דוח סיכום סופי), בני מבנה המתאר את תהליך הטיפול מתחילתו ועד סופו וסיבת
הסיום (למשל: השגת יעדים, החלטה משותפת, הפניה להמשך טיפול אחר). חשוב: לעולם אל תכללי
המלצות להמשך טיפול — זהו דוח סיום, לא דוח המשך. השתמשי במבנה שנלמד מהדוגמה (אם סופק)
כבסיס לכותרות הסעיפים; אחרת התאימי כותרות סבירות לפי התיאור הזה.`,
};

function buildSystemPrompt(template: ReportTemplateKey, isIteration: boolean) {
  const templateBlock = template === "extension" ? EXTENSION_STRUCTURE : OTHER_TEMPLATE_GUIDANCE[template];

  return `אתה עוזר AI מקצועי לניסוח דוחות טיפוליים מותאמים אישית, בזרימת עבודה איטרטיבית
(טיוטה → הבהרות → עדכון), ולא במענה חד-פעמי.

תקבל: (1) מבנה צורני שנלמד ממסמך דוגמה (אם סופק), (2) סוג הדוח, (3) הנחיות חופשיות
מהמטפלת, (4) תוכן/תמלול/תמות מהפגישה או מהתקופה הנוכחית, (5) היסטוריית טיפול / גיליון
רפואי / סיכומים קודמים (אם סופקו)${isIteration ? ", (6) טיוטה קודמת שכתבת ותשובות המטפלת להבהרות שביקשת" : ""}.

╔══ כלל מכריע 1 — גוף ראשון בלבד ══╗
כל תוכן סעיף חייב להיכתב בגוף ראשון, מנקודת המבט של המטפלת עצמה — לדוגמה: "עבדתי עם
[מטופל/ת] על...", "זיהיתי התקדמות...", "אני ממליצה על הארכה מהסיבות הבאות...". אסור
בהחלט להשתמש בגוף שלישי (למשל "המטפלת עבדה", "המטפלת מבקשת") — בכל סעיף, ללא יוצא
מן הכלל.

╔══ כלל מכריע 2 — אפס הזיות ══╗
חל איסור מוחלט על השלמה בדיונית, ניחוש תמות, או המצאת נתונים, תאריכים, מספרים או אירועים
שלא הופיעו בפועל בתוכן, בהיסטוריה או בהנחיות שסופקו. כל תוכן הדוח חייב להיות מבוסס אך
ורק על מה שסופק בפועל. אם נתון ספציפי הדרוש למבנה הדוח (למשל תאריך תחילת טיפול, גיל,
כמות מפגשים) אינו קיים בחומר שסופק — כתבי במפורש "[לא צוין]" באותו המקום בתוכן הסעיף,
ובנוסף הוסיפי שאלת הבהרה מתאימה למערך clarifications (למשל: "לא צוין תאריך תחילת הטיפול
— נא לציין."). לעולם אל תמציאי ערך במקום לכתוב "[לא צוין]".

╔══ כלל ברזל — איסור מוחלט על שמות ══╗
חל איסור מוחלט לכלול שמות פרטיים, שמות משפחה או פרטים מזהים של מטופלים/משתתפים בטקסט
הנוצר! יש להשתמש אך ורק במונח הניטרלי "[מטופל/ת]" (או "[המטופל/ת]"/"[הפונה]") בכל
מקום שבו מוזכר המטופל/ת — גם אם השם הופיע בבירור בתוכן, בהיסטוריה, או בטיוטה הקודמת.
כלל זה חל על כל סעיף בדוח, ללא יוצא מן הכלל.

══ כללי אנונימיזציה (חובה מוחלטת) ══
- שם המטופל/ת → [מטופל/ת] (לעולם אל תשתמשי בשם אמיתי אם הוזכר בתוכן או בהיסטוריה)
- בני משפחה → [אם], [אב], [אח], [אחות], [בן/בת זוג], [ילד/ה], [סבא/סבתא]
- אנשים אחרים → [שם]

══ מבנה הדוח — ${TEMPLATE_LABELS[template]} ══
${templateBlock}

${isIteration ? `══ עדכון טיוטה קיימת ══
סופקה טיוטה קודמת ותשובות המטפלת לשאלות ההבהרה. עדכני את הטיוטה בהתאם לתשובות החדשות —
שמרי על כל תוכן קיים שלא נגעו בו התשובות, ועדכני/השלימי רק את מה שהתשובות מתייחסות אליו
(כולל החלפת "[לא צוין]" בערך שסופק עכשיו, אם ניתן). במערך clarifications שבפלט, הסירי כל
שאלה שנענתה במלואה, והשאירי/הוסיפי שאלות רק עבור מידע שעדיין חסר וקריטי לדוח. אם כל
המידע הדרוש כעת קיים, החזירי מערך clarifications ריק.

` : ""}══ פורמט הפלט — JSON בלבד, ללא כל טקסט נוסף ══
{
  "sections": [{ "heading": "...", "content": "..." }],
  "clarifications": ["..."]
}
כל תוכן סעיף מנוסח בעברית קלינית מקצועית, בגוף ראשון בלבד. clarifications היא רשימת
שאלות/נתונים חסרים בעברית, ברורות ומעשיות למטפלת (מערך ריק אם אין דבר החסר).`;
}

type MockPayload = { sections: { heading: string; content: string }[]; clarifications: string[] };

const MOCK_DATA: Record<ReportTemplateKey, MockPayload> = {
  extension: {
    sections: [
      { heading: "הנדון", content: "בקשת הערכה/הארכה לטיפול עבור [מטופל/ת], ת.ז. [לא צוין]." },
      { heading: "רקע ונתוני טיפול", content: "[מטופל/ת] בגיל [לא צוין], מצב משפחתי [לא צוין], מתגורר/ת [לא צוין]. הופנה/תה לטיפול עקב חרדת נטישה וקושי בהצבת גבולות. תאריך תחילת הטיפול: [לא צוין]. עד כה התקיימו [לא צוין] מפגשים, בסדירות שבועית, עם היענות ושיתוף פעולה גבוהים לאורך התהליך." },
      { heading: "תמות ונושאים מרכזיים", content: "לאורך הטיפול עבדתי עם [מטופל/ת] על מספר תמות מרכזיות: חרדת נטישה הקשורה לדפוסי התקשרות מוקדמים, קושי מתמשך בהצבת גבולות במערכות יחסים, ותהליך מתמשך של חיזוק הדימוי העצמי והמסוגלות." },
      { heading: "המצב הנוכחי", content: "במפגשים האחרונים אני מזהה שיפור במודעות העצמית וביכולת הזיהוי של דפוסים בזמן אמת. [מטופל/ת] מפגין/ה כוחות אישיים ניכרים, לצד מוטיבציה גבוהה להמשך התהליך. [לא צוין] לגבי גורמי תמיכה או טיפולים משלימים נוספים." },
      { heading: "סיכום והמלצה קלינית", content: "לאור מורכבות התכנים שעלו והעבודה המתמשכת הנדרשת על דפוסים עמוקים, ולאור המצב הנוכחי המשקף התקדמות אך גם צורך בהמשך ליווי, אני ממליצה באופן מפורש על הארכת הטיפול לתקופה נוספת." },
    ],
    clarifications: [
      "לא צוין תאריך תחילת הטיפול — נא לציין.",
      "לא צוינו גיל המטופל/ת ומצבו/ה המשפחתי — נא להוסיף.",
      "לא צוין מספר המפגשים שהתקיימו עד כה — נא לציין.",
    ],
  },
  periodic: {
    sections: [
      { heading: "תאריכים ותדירות", content: "הטיפול עם [מטופל/ת] החל בתאריך [לא צוין], והתקיים בתדירות שבועית לאורך התקופה הנסקרת." },
      { heading: "סיבת פנייה", content: "[מטופל/ת] פנה/תה לטיפול עקב חרדת נטישה וקשיים בהצבת גבולות במערכות יחסים." },
      { heading: "מהלך הטיפול", content: "עבדתי עם [מטופל/ת] על זיהוי דפוסי חרדה, חיזוק יכולת ההצבה של גבולות, וחיזוק הדימוי העצמי. זיהיתי התקדמות הדרגתית לאורך התקופה." },
      { heading: "סיכום", content: "אני רואה שיפור במודעות העצמית ובתפקוד היומיומי של [מטופל/ת], ומעריכה שהתהליך הטיפולי ממשיך להתקדם בכיוון חיובי." },
    ],
    clarifications: ["לא צוין תאריך תחילת הטיפול — נא לציין.", "לא צוינה התקופה המדויקת הנסקרת בדוח — נא לציין."],
  },
  psychiatrist: {
    sections: [
      { heading: "תסמינים ומהלך", content: "[מטופל/ת] מציג/ה תסמיני חרדה בעצימות קלה עד בינונית, לצד קשיים בוויסות רגשי בסיטואציות בין-אישיות. [לא צוין] לגבי היסטוריה תרופתית קודמת." },
      { heading: "תפקוד יומיומי", content: "מבחינת שינה, [מטופל/ת] דיווח/ה על שיפור מסוים. [לא צוין] לגבי תפקוד בעבודה/לימודים באופן מפורט." },
      { heading: "התייחסות אבחנתית", content: "התמונה הקלינית מתיישבת עם מאפיינים של חרדת נטישה; [לא צוין] אבחנה פורמלית קודמת." },
    ],
    clarifications: ["לא צוינה היסטוריה תרופתית — נא לציין אם רלוונטי.", "לא צוין תפקוד מפורט בעבודה/לימודים — נא להוסיף."],
  },
  final: {
    sections: [
      { heading: "תהליך הטיפול", content: "עבדתי עם [מטופל/ת] לאורך תקופה של [לא צוין], בה התמקדנו בחרדת נטישה ובהצבת גבולות." },
      { heading: "סיבת הסיום", content: "[לא צוין] הסיבה המדויקת לסיום הטיפול." },
      { heading: "סיכום התהליך", content: "לאורך התהליך זיהיתי התקדמות משמעותית ביכולת הוויסות הרגשי ובדימוי העצמי של [מטופל/ת]." },
    ],
    clarifications: ["לא צוינה סיבת סיום הטיפול — נא לציין (השגת יעדים / החלטה משותפת / הפניה להמשך טיפול אחר וכו')."],
  },
};

function buildSignatureSection(therapistName?: string, therapistTitle?: string, therapistLicense?: string, therapistFramework?: string) {
  const lines = [
    "בכבוד רב,",
    therapistName?.trim() || "[לא צוין]",
    therapistTitle?.trim() || "[לא צוין]",
    therapistLicense?.trim() ? `מס' רישום: ${therapistLicense.trim()}` : "מס' רישום: [לא צוין]",
    therapistFramework?.trim() || "[לא צוין]",
  ];
  return { heading: "סיום", content: lines.join("\n") };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const body = (await req.json()) as {
      structure?: unknown;
      reportTemplate?: ReportTemplateKey;
      guidelines?: string;
      content?: string;
      history?: string;
      therapistName?: string;
      therapistTitle?: string;
      therapistLicense?: string;
      therapistFramework?: string;
      previousDraft?: { heading: string; content: string }[];
      clarificationAnswers?: string;
      knownPatientName?: string;
    };

    const template: ReportTemplateKey = body.reportTemplate && body.reportTemplate in TEMPLATE_LABELS ? body.reportTemplate : "periodic";
    const isIteration = Boolean(body.previousDraft?.length && body.clarificationAnswers?.trim());

    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 1800));
      const mock = MOCK_DATA[template];
      // Simulate resolution: once the therapist answers clarifications in demo
      // mode, show a draft with no outstanding questions so the "approve" step
      // is reachable without a real API key.
      const rawSections = isIteration
        ? mock.sections.map((s) => ({ ...s, content: s.content.replace(/\[לא צוין\]/g, "מולא לפי התשובה שסופקה") }))
        : mock.sections;
      const rawClarifications = isIteration ? [] : mock.clarifications;
      // Server-side anonymization backstop applies even in demo mode, for
      // consistent behavior between simulated and live responses.
      const sections = sanitizeJsonStrings(rawSections, [body.knownPatientName]);
      const clarifications = sanitizeJsonStrings(rawClarifications, [body.knownPatientName]);
      const finalSections = template === "extension"
        ? [...sections, buildSignatureSection(body.therapistName, body.therapistTitle, body.therapistLicense, body.therapistFramework)]
        : sections;
      return NextResponse.json({ sections: finalSections, clarifications });
    }

    const instructionParts = [
      `סוג הדוח: ${TEMPLATE_LABELS[template]}.`,
      "",
      "מבנה שנלמד ממסמך הדוגמה (אם סופק — לא רלוונטי לדוח הארכה, שם המבנה קשיח):",
      JSON.stringify(body.structure ?? {}, null, 2),
      "",
      "הנחיות ודגשים מהמטפלת:",
      body.guidelines || "אין הנחיות מיוחדות — כתבי בסגנון קליני מקצועי סטנדרטי.",
      "",
      "תוכן/תמלול/תמות מהפגישה או מהתקופה הנוכחית:",
      body.content || "לא סופק תוכן נוסף מהתקופה הנוכחית.",
      "",
      "היסטוריית טיפול / גיליון רפואי / סיכומים קודמים:",
      body.history || "לא סופקה היסטוריה נוספת.",
    ];

    if (isIteration) {
      instructionParts.push(
        "",
        "טיוטה קודמת (JSON):",
        JSON.stringify(body.previousDraft, null, 2),
        "",
        "תשובות המטפלת להבהרות:",
        body.clarificationAnswers || ""
      );
    }

    instructionParts.push(
      "",
      "סרקי את כל המקורות שסופקו (תוכן נוכחי + היסטוריה) כדי לחלץ תמות מרכזיות, סיבת הפניה/בקשה",
      "ונקודות התקדמות, בהתאם למה שנדרש לפי המבנה וסוג הדוח. אם מקור מסוים ריק, התבססי על",
      "יתר המקורות ועל הנחיות המטפלת."
    );

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: buildSystemPrompt(template, isIteration) },
          { role: "user", content: instructionParts.join("\n") },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content) as { sections?: unknown; clarifications?: unknown };
    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const rawClarifications = Array.isArray(parsed.clarifications) ? parsed.clarifications.filter((c) => typeof c === "string") : [];

    // Server-side anonymization backstop: never trust the prompt alone. Runs
    // only on OpenAI's response, before the (unsanitized, deterministic)
    // therapist signature block is appended — knownPatientName is never sent
    // to OpenAI, and this scrub never touches the therapist's own name.
    const sections = sanitizeJsonStrings(rawSections, [body.knownPatientName]);
    const clarifications = sanitizeJsonStrings(rawClarifications, [body.knownPatientName]);

    const finalSections = template === "extension"
      ? [...sections, buildSignatureSection(body.therapistName, body.therapistTitle, body.therapistLicense, body.therapistFramework)]
      : sections;

    return NextResponse.json({ sections: finalSections, clarifications });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
