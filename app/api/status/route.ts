import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    demo: !process.env.OPENAI_API_KEY,
  });
}
