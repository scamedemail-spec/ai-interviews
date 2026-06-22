// ─────────────────────────────────────────────────────────────────────────────
// anthropic.js  (SERVER-SIDE ONLY)
//
// Drop-in replacement that routes all LLM calls through Groq's free-tier
// OpenAI-compatible API instead of Anthropic. All exports keep their original
// names so every route file (persona, chat, debrief) works unchanged.
//
// Required env var: GROQ_API_KEY
// Free key: https://console.groq.com/keys
// ─────────────────────────────────────────────────────────────────────────────

// Best free Groq model — fast, smart, handles roleplay well.
const DEFAULT_MODEL =
  process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const GROQ_BASE = "https://api.groq.com/openai/v1";

// A small custom error so routes can detect "no key configured" and return a
// friendly 500 instead of a confusing stack trace.
export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "GROQ_API_KEY is not set. Add it in Vercel → Settings → Environment Variables."
    );
    this.name = "MissingApiKeyError";
  }
}

function getApiKey() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new MissingApiKeyError();
  }
  return apiKey;
}

/**
 * Call Groq and return the plain text of the assistant's reply.
 *
 * @param {Object} options
 * @param {string} options.system        - System prompt
 * @param {Array}  options.messages      - [{role:"user"|"assistant", content}]
 * @param {number} [options.maxTokens]   - Defaults to 1024
 * @param {number} [options.temperature] - Defaults to 0.8
 * @returns {Promise<string>}
 */
export async function callClaude({
  system,
  messages,
  maxTokens = 1024,
  temperature = 0.8,
}) {
  const apiKey = getApiKey();

  // Groq uses the OpenAI format: system role is the first message in the array
  const fullMessages = [
    { role: "system", content: system },
    ...messages,
  ];

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: fullMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/**
 * Same as callClaude, but parses the reply as JSON.
 * @returns {Promise<any>}
 */
export async function callClaudeForJson(options) {
  const raw = await callClaude(options);

  // Strip code fences if the model wrapped the JSON
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      "Groq did not return valid JSON. Raw reply was:\n" + raw.slice(0, 500)
    );
  }
}
