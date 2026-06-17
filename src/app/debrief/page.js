"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Debrief Page  ( /debrief  and  /debrief?id=<savedId> )
//
// The "money screen." Two modes:
//   - FRESH: arrived straight from a session → compute the debrief (local score + AI coach
//     notes via /api/debrief), save it to history (localStorage), then show it.
//   - REVIEW: arrived from history with ?id=... → load that saved session read-only.
//
// We wrap the inner component in <Suspense> because it reads the URL search params.
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/context/SessionContext";
import { computeLocalScore } from "@/lib/scoring";
import { saveSession, getSessionById } from "@/lib/storage";
import ScoreDial from "@/components/debrief/ScoreDial";
import TellSummary from "@/components/debrief/TellSummary";
import TellTimeline from "@/components/debrief/TellTimeline";
import CoachNotes from "@/components/debrief/CoachNotes";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

// Parse "M:SS" → seconds (for working out the session length from the transcript).
function toSeconds(stamp) {
  if (!stamp) return 0;
  const [m, s] = String(stamp).split(":").map((n) => parseInt(n, 10));
  return (m || 0) * 60 + (s || 0);
}

export default function DebriefPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-ink-400">
          <Spinner />
        </div>
      }
    >
      <DebriefInner />
    </Suspense>
  );
}

function DebriefInner() {
  const searchParams = useSearchParams();
  const reviewId = searchParams.get("id");
  const { session, resetKeepConfig } = useSession();

  const [view, setView] = useState(null); // the normalized data we render
  const [computing, setComputing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const computedRef = useRef(false); // guard against double-compute (React strict mode)

  useEffect(() => {
    // REVIEW MODE — load a saved session from history.
    if (reviewId) {
      const saved = getSessionById(reviewId);
      if (!saved) {
        setNotFound(true);
      } else {
        setView(normalizeFromSaved(saved));
      }
      return;
    }

    // FRESH MODE — we just finished a session held in context.
    if (computedRef.current) return; // only once
    if (!session.config || session.transcript.length === 0) {
      setNotFound(true);
      return;
    }
    computedRef.current = true;
    computeAndSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId]);

  async function computeAndSave() {
    setComputing(true);

    const { config, persona, transcript, tells } = session;
    const durationSeconds =
      transcript.length > 0 ? toSeconds(transcript[transcript.length - 1].timestamp) : 0;

    // Always compute a transparent local score so the page works without an API key.
    const localScore = computeLocalScore(tells, durationSeconds);

    // Try to get richer AI analysis. If it fails (no key, etc.), we degrade gracefully.
    let ai = null;
    try {
      const res = await fetch("/api/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, persona, transcript, tells }),
      });
      const data = await res.json();
      if (res.ok) ai = data.result;
    } catch (err) {
      // ignore — we'll use the local fallback
    }

    const record = {
      scenarioType: config.scenarioType,
      difficulty: config.difficulty,
      context: config.context,
      fear: config.fear,
      persona,
      transcript,
      tells,
      durationSeconds,
      score: ai && typeof ai.score === "number" ? ai.score : localScore,
      achievedGoal: ai?.achievedGoal || null,
      summary: ai?.summary || null,
      coachNotes: ai?.coachNotes || null,
    };

    // Persist to history (localStorage) and render.
    const saved = saveSession(record);
    setView(normalizeFromSaved(saved));
    setComputing(false);
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <p className="text-ink-400">No debrief to show.</p>
        <Button href="/setup">Start a session</Button>
      </main>
    );
  }

  if (computing || !view) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <Spinner className="h-6 w-6" />
        <p className="text-sm text-ink-200">Reviewing the film…</p>
        <p className="text-xs text-ink-400">Scoring your tells and writing coach notes.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-ink-200">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> TELL
        </Link>
        <Link href="/history" className="text-sm text-ink-400 hover:text-ink-200">
          History
        </Link>
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
        Session debrief
      </div>
      <h1 className="text-2xl font-bold text-ink-200">Game film</h1>
      <p className="mt-1 text-sm text-ink-400">{view.context}</p>

      {/* Score + summary */}
      <div className="mt-8 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
        <ScoreDial score={view.score} />
        <TellSummary tells={view.tells} aiSummary={view.summary} />
      </div>

      {/* Coach notes */}
      <div className="mt-8">
        <CoachNotes notes={view.coachNotes} achievedGoal={view.achievedGoal} />
      </div>

      {/* Timeline */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-ink-200">Tell timeline</h2>
        <TellTimeline tells={view.tells} transcript={view.transcript} />
      </div>

      {/* Actions */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        {!reviewId && (
          <Button
            href="/session"
            onClick={() => resetKeepConfig()}
            className="px-6 py-3"
          >
            Try again (same scenario) →
          </Button>
        )}
        <Button href="/setup" variant="secondary" className="px-6 py-3">
          New scenario
        </Button>
        <Button href="/history" variant="ghost">
          View history
        </Button>
      </div>
    </main>
  );
}

// Turn a saved record (or freshly built one) into the flat shape the page renders.
function normalizeFromSaved(saved) {
  return {
    context: saved.context,
    score: saved.score,
    tells: saved.tells || [],
    transcript: saved.transcript || [],
    summary: saved.summary,
    coachNotes: saved.coachNotes,
    achievedGoal: saved.achievedGoal,
  };
}
