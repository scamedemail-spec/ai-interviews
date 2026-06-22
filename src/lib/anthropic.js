const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_BASE = "https://api.groq.com/openai/v1";

export class MissingApiKeyError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
    this.name = "MissingApiKeyError";
  }
}

function getApiKey() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") throw new MissingApiKeyError();
  return apiKey;
}

export async function callClaude({ system, messages, maxTokens = 1024, temperature = 0.8 }) {
  const apiKey = getApiKey();
  const fullMessages = [{ role: "system", content: system }, ...messages];
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: DEFAULT_MODEL, messages: fullMessages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

export async function callClaudeForJson(options) {
  const raw = await callClaude(options);
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error("Groq did not return valid JSON. Raw reply was:\n" + raw.slice(0, 500));
  }
}
