"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Session History Page  ( /history )
//
// Lists past sessions (newest first) with date, scenario type, score, and key tells.
// Each row links to its saved debrief. If there are 3+ sessions, we show a line chart of
// scores over time. All data comes from localStorage (lib/storage.js) — no accounts.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllSessions, deleteSession } from "@/lib/storage";
import { summarizeTells } from "@/lib/scoring";
import { getLabelForType } from "@/lib/biometrics/tellTypes";
import ScoreChart from "@/components/history/ScoreChart";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const SCENARIO_LABELS = {
  job_interview: "Job Interview",
  salary_negotiation: "Salary Negotiation",
  sales_call: "Sales Call",
  difficult_conversation: "Difficult Conversation",
  custom: "Custom",
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // localStorage is only available in the browser, so read it after mount.
  useEffect(() => {
    setSessions(getAllSessions());
    setLoaded(true);
  }, []);

  function handleDelete(id) {
    deleteSession(id);
    setSessions(getAllSessions());
  }

  // Build chart points oldest → newest.
  const chartPoints = [...sessions]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((s) => ({
      score: s.score,
      label: new Date(s.createdAt).toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
      }),
    }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-ink-200">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> TELL
        </Link>
        <Button href="/setup" variant="secondary">
          New session
        </Button>
      </div>

      <h1 className="text-2xl font-bold text-ink-200">Session history</h1>
      <p className="mt-1 text-sm text-ink-400">
        Saved on this device only. Track how your composure trends over time.
      </p>

      {/* Score trend chart */}
      {sessions.length >= 3 && (
        <Card className="mt-6 p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
            Confidence over time
          </div>
          <ScoreChart points={chartPoints} />
        </Card>
      )}

      {/* List */}
      <div className="mt-6 space-y-3">
        {loaded && sessions.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-ink-400">No sessions yet.</p>
            <Button href="/setup" className="mt-4">
              Run your first session
            </Button>
          </Card>
        )}

        {sessions.map((s) => {
          const { byType } = summarizeTells(s.tells);
          const keyTells = Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type, count]) => `${count}× ${getLabelForType(type)}`);

          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/debrief?id=${s.id}`} className="group flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-ink-200 group-hover:text-accent">
                      {SCENARIO_LABELS[s.scenarioType] || "Session"}
                    </span>
                    <span className="text-xs text-ink-400">
                      {new Date(s.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-ink-400">{s.context}</p>
                  {keyTells.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {keyTells.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-ink-700 bg-ink-900/60 px-2.5 py-0.5 text-[11px] text-ink-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>

                {/* Score badge */}
                <div className="shrink-0 text-right">
                  <div
                    className="text-2xl font-bold"
                    style={{
                      color:
                        s.score >= 7 ? "#3ddc84" : s.score >= 4 ? "#ffb020" : "#ff4d4d",
                    }}
                  >
                    {s.score}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-ink-400">
                    / 10
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="mt-2 text-[11px] text-ink-600 hover:text-tell-gaze"
                  >
                    delete
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
