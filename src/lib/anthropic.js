// ─────────────────────────────────────────────────────────────────────────────
// anthropic.js  (SERVER-SIDE ONLY)
//
// This is the single place where we talk to the Claude API. All three API routes
// (persona, chat, debrief) call `callClaude()` from here, so the model name, the API
// key check, and the error format live in exactly one spot.
//
// IMPORTANT: This file must never be imported by client components — it reads the secret
// API key from process.env, which only exists on the server. Next.js API routes run on
// the server, so importing it there is safe.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";

// The default model, per the product spec. Can be overridden with an env var if needed.
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// A small custom error so routes can detect "no key configured" and return a friendly 500
// instead of a confusing stack trace.
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and paste your key."
    );
    this.name = "MissingApiKeyError";
  }
}

// Build the client lazily so the app can still boot (landing page, setup form, etc.)
// even when no key is present yet. We only require the key at the moment of an actual call.
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new MissingApiKeyError();
  }
  return new Anthropic({ apiKey });
}

/**
 * Send a request to Claude and return the plain text of its reply.
 *
 * @param {Object}   options
 * @param {string}   options.system        - The system prompt (the AI's instructions).
 * @param {Array}    options.messages      - Array of { role: "user"|"assistant", content: string }.
 * @param {number}   [options.maxTokens]   - Max tokens in the reply. Defaults to 1024.
 * @param {number}   [options.temperature] - Creativity 0..1. Defaults to 0.8 for character work.
 * @returns {Promise<string>} The assistant's text reply.
 */
export async function callClaude({
  system,
  messages,
  maxTokens = 1024,
  temperature = 0.8,
}) {
  const client = getClient();

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  });

  // The SDK returns content as an array of blocks. For our text-only use we just
  // concatenate any text blocks together.
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return text;
}

/**
 * Same as callClaude, but expects the model to return JSON and parses it for us.
 * We ask the model for JSON in the prompt; here we defensively strip code fences and
 * parse. If parsing fails we throw so the route can report it.
 *
 * @returns {Promise<any>} The parsed JSON object.
 */
export async function callClaudeForJson(options) {
  const raw = await callClaude(options);

  // Models sometimes wrap JSON in ```json ... ``` fences. Strip those if present.
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      "Claude did not return valid JSON. Raw reply was:\n" + raw.slice(0, 500)
    );
  }
}

export { DEFAULT_MODEL };
