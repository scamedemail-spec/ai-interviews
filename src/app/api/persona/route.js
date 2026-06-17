// ─────────────────────────────────────────────────────────────────────────────
// POST /api/persona
//
// Input  (JSON body): { config: { scenarioType, context, fear, difficulty } }
// Output (JSON):      { persona: { name, role, personality, priorities[], pressurePoints[], openingLine } }
//
// Generates the opponent "scouting report" the setup page shows before calibration.
// Runs server-side so the API key stays secret.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { callClaudeForJson, MissingApiKeyError } from "@/lib/anthropic";
import { buildPersonaPrompt, buildPersonaUserMessage } from "@/lib/prompts";

export async function POST(request) {
  try {
    const body = await request.json();
    const config = body.config;

    if (!config || !config.context) {
      return NextResponse.json(
        { error: "Missing scenario context." },
        { status: 400 }
      );
    }

    const persona = await callClaudeForJson({
      system: buildPersonaPrompt(),
      messages: [{ role: "user", content: buildPersonaUserMessage(config) }],
      maxTokens: 700,
      temperature: 0.9,
    });

    return NextResponse.json({ persona });
  } catch (err) {
    // Friendly message when the key simply isn't set yet.
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("/api/persona error:", err);
    return NextResponse.json(
      { error: "Could not generate the opponent. " + err.message },
      { status: 500 }
    );
  }
}
