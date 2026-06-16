// ─────────────────────────────────────────────────────────────────────────────
// POST /api/debrief
//
// Analyzes a finished session and returns the coach's read.
//
// Input (JSON body): { config, persona, transcript, tells }
// Output (JSON):     { score, achievedGoal, summary, coachNotes }
//
// Note: the client ALSO computes a local fallback score (lib/scoring.js) so the debrief
// page still works without an API key — but when a key is present, Claude's richer
// analysis is preferred.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { callClaudeForJson, MissingApiKeyError } from "@/lib/anthropic";
import { buildDebriefPrompt, buildDebriefUserMessage } from "@/lib/prompts";

export async function POST(request) {
  try {
    const body = await request.json();
    const { config, persona, transcript, tells } = body;

    if (!config || !transcript) {
      return NextResponse.json(
        { error: "Missing session data for debrief." },
        { status: 400 }
      );
    }

    const result = await callClaudeForJson({
      system: buildDebriefPrompt(),
      messages: [
        {
          role: "user",
          content: buildDebriefUserMessage({ config, persona, transcript, tells }),
        },
      ],
      maxTokens: 900,
      temperature: 0.6,
    });

    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("/api/debrief error:", err);
    return NextResponse.json(
      { error: "Could not generate the debrief. " + err.message },
      { status: 500 }
    );
  }
}
