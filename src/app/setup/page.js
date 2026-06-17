"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Session Setup Page  ( /setup )
//
// The user describes their real situation. On submit we generate the opponent persona
// (the "scouting report") via /api/persona, show it, and then let them proceed to
// calibration. All form state is held here and pushed into SessionContext.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import ScoutingReport from "@/components/setup/ScoutingReport";
import { useSession } from "@/context/SessionContext";

// Dropdown options for the scenario type.
const SCENARIOS = [
  { value: "job_interview", label: "Job Interview" },
  { value: "salary_negotiation", label: "Salary Negotiation" },
  { value: "sales_call", label: "Sales Call" },
  { value: "difficult_conversation", label: "Difficult Conversation" },
  { value: "custom", label: "Custom" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy", note: "Accommodating. Mild pushback." },
  { value: "medium", label: "Medium", note: "Realistic pushback." },
  { value: "hard", label: "Hard", note: "Plays dirty. Exploits everything." },
];

export default function SetupPage() {
  const router = useRouter();
  const { startNewSession, setPersona, session } = useSession();

  // Local form state.
  const [scenarioType, setScenarioType] = useState("salary_negotiation");
  const [context, setContext] = useState("");
  const [fear, setFear] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const persona = session.persona;

  // Generate the opponent.
  async function handleGenerate(event) {
    event.preventDefault();
    setError("");

    if (context.trim().length < 10) {
      setError("Please describe your situation in a sentence or two.");
      return;
    }

    const config = { scenarioType, context: context.trim(), fear: fear.trim(), difficulty };
    startNewSession(config); // store config in context immediately
    setLoading(true);

    try {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate opponent.");
      setPersona(data.persona);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function proceedToCalibration() {
    router.push("/session");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-ink-200">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> TELL
        </Link>
        <Link href="/history" className="text-sm text-ink-400 hover:text-ink-200">
          History
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-ink-200">Set up your session</h1>
      <p className="mt-1 text-sm text-ink-400">
        The more real and specific you are, the sharper your opponent will be.
      </p>

      <form onSubmit={handleGenerate} className="mt-8 space-y-6">
        {/* Scenario type */}
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-200">Scenario type</label>
          <select
            value={scenarioType}
            onChange={(e) => setScenarioType(e.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-ink-200 outline-none focus:border-accent"
          >
            {SCENARIOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Context */}
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-200">
            Your situation
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            placeholder="I have a final-round interview for a PM role at Stripe. The interviewer is the VP of Product. I want to negotiate the base salary up from their likely offer of $85K to $95K."
            className="w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-200 placeholder:text-ink-600 outline-none focus:border-accent"
          />
        </div>

        {/* Fear */}
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-200">
            What you're afraid of{" "}
            <span className="font-normal text-ink-400">(optional, but powerful)</span>
          </label>
          <textarea
            value={fear}
            onChange={(e) => setFear(e.target.value)}
            rows={2}
            placeholder="That they'll rescind the offer if I push too hard."
            className="w-full resize-none rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-200 placeholder:text-ink-600 outline-none focus:border-accent"
          />
        </div>

        {/* Difficulty */}
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-200">Difficulty</label>
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent/10"
                      : "border-ink-700 bg-ink-900 hover:border-ink-600"
                  }`}
                >
                  <div
                    className={`text-sm font-semibold ${
                      active ? "text-accent" : "text-ink-200"
                    }`}
                  >
                    {d.label}
                  </div>
                  <div className="mt-1 text-xs text-ink-400">{d.note}</div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-tell-gaze/40 bg-tell-gaze/10 px-4 py-3 text-sm text-tell-gaze">
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full py-3">
          {loading ? (
            <>
              <Spinner /> Building your opponent…
            </>
          ) : persona ? (
            "Regenerate opponent"
          ) : (
            "Generate opponent"
          )}
        </Button>
      </form>

      {/* Scouting report + proceed */}
      {persona && (
        <div className="mt-10 animate-fadeInUp">
          <ScoutingReport persona={persona} />
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-ink-400">
              Next: a 30-second calibration so we learn your personal baseline.
            </p>
            <Button onClick={proceedToCalibration} className="px-6 py-3">
              Continue to calibration →
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
