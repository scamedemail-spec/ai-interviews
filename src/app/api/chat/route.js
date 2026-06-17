// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
//
// The live in-character opponent turn. This is called every time the user finishes
// speaking/typing. It receives the conversation so far AND the biometric tells detected
// since the last turn, and returns what the opponent says next.
//
// Input (JSON body):
//   {
//     config,                  // the user's setup
//     persona,                 // the opponent persona
//     transcript: [{role,text,timestamp}],   // full conversation so far
//     tellsSinceLastTurn: [ ...tell objects ] // filtered tells to exploit
//   }
// Output (JSON): { reply: "<what the opponent says>" }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { callClaude, MissingApiKeyError } from "@/lib/anthropic";
import { buildOpponentSystemPrompt, formatTellsForModel } from "@/lib/prompts";

export async function POST(request) {
  try {
    const body = await request.json();
    const { config, persona, transcript, tellsSinceLastTurn } = body;

    if (!config) {
      return NextResponse.json({ error: "Missing session config." }, { status: 400 });
    }

    // Build the conversation as Claude messages. Our "opponent" is the assistant,
    // the human user is "user".
    const messages = (transcript || []).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    // Attach the tells to the LAST user message (or as a fresh user turn) so the model
    // sees them right before deciding how to respond. The tells are wrapped in a clearly
    // labeled JSON block that the system prompt explains how to use.
    const tellBlock = formatTellsForModel(tellsSinceLastTurn);
    if (tellBlock) {
      if (messages.length > 0 && messages[messages.length - 1].role === "user") {
        messages[messages.length - 1].content += tellBlock;
      } else {
        messages.push({ role: "user", content: tellBlock.trim() });
      }
    }

    // If there is no conversation yet, seed with a neutral opener so the model has a turn.
    if (messages.length === 0) {
      messages.push({ role: "user", content: "(The conversation is beginning.)" });
    }

    const reply = await callClaude({
      system: buildOpponentSystemPrompt({ config, persona }),
      messages,
      maxTokens: 400,
      temperature: 0.85,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    console.error("/api/chat error:", err);
    return NextResponse.json(
      { error: "The opponent could not respond. " + err.message },
      { status: 500 }
    );
  }
}
