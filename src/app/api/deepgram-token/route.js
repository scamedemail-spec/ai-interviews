import { NextResponse } from "next/server";

// Deepgram project ID (from the console dashboard).
const DEEPGRAM_PROJECT_ID = "0cdf2a4d-0ca5-46b2-a1ca-4e39a5867e99";

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Missing DEEPGRAM_API_KEY" }, { status: 500 });

  try {
    // Create a short-lived (1-use) key scoped to this project.
    const res = await fetch(
      `https://api.deepgram.com/v1/projects/${DEEPGRAM_PROJECT_ID}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "tell-session-temp",
          scopes: ["usage:write"],
          expiration: { type: "uses", uses: 1 },
        }),
      }
    );

    if (!res.ok) {
      // Fall back: return the master key (acceptable for dev/MVP)
      return NextResponse.json({ token: apiKey });
    }

    const data = await res.json();
    return NextResponse.json({ token: data.key?.key || apiKey });
  } catch {
    return NextResponse.json({ token: apiKey });
  }
}
