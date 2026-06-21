import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing HUME_API_KEY" }, { status: 500 });
  return NextResponse.json({ apiKey });
}
