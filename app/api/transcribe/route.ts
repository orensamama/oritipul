import { NextRequest, NextResponse } from "next/server";

const MOCK_TRANSCRIPTION = `בפגישה היום דיברנו על הקשיים שלה בעבודה. היא ציינה שהיא מרגישה שלא שייכת לצוות.
עלה נושא של ילדות ודמות האב. היא בכתה קצת כשדיברנו על זה.
היא סיפרה שאחותה מצפה ממנה לעזור לה כל הזמן ושהיא לא יודעת איך לסרב.
בסוף הפגישה היא אמרה שהיא רוצה לנסות להציב גבולות.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  // Simulation mode — no API key configured yet
  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ text: MOCK_TRANSCRIPTION, simulation: true });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const oaiForm = new FormData();
    oaiForm.append("file", file);
    oaiForm.append("model", "whisper-1");
    oaiForm.append("language", "he");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: oaiForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
