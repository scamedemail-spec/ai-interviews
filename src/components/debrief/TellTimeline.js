"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TellTimeline — the "game film" of the session.
//
// A horizontal timeline of the whole conversation. Each detected tell is a clickable
// marker placed at the moment it happened, color-coded by category. Clicking a marker
// expands a card showing what happened, its severity, and what the opponent did in
// response (the next opponent line after that moment).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import {
  getColorForType,
  getLabelForType,
  getCategoryForType,
  CATEGORY_COLORS,
  TELL_CATEGORIES,
} from "@/lib/biometrics/tellTypes";

// Parse a "M:SS" timestamp into seconds.
function toSeconds(stamp) {
  if (!stamp || typeof stamp !== "string") return 0;
  const [m, s] = stamp.split(":").map((n) => parseInt(n, 10));
  return (m || 0) * 60 + (s || 0);
}

export default function TellTimeline({ tells, transcript }) {
  const [selectedId, setSelectedId] = useState(null);

  // Total duration = the latest timestamp across tells and messages (min 30s for layout).
  const maxSeconds = useMemo(() => {
    let max = 30;
    for (const t of tells || []) max = Math.max(max, toSeconds(t.timestamp));
    for (const m of transcript || []) max = Math.max(max, toSeconds(m.timestamp));
    return max;
  }, [tells, transcript]);

  // Find what the opponent said right after a given tell (its "response").
  function opponentResponseAfter(stamp) {
    const sec = toSeconds(stamp);
    const reply = (transcript || []).find(
      (m) => m.role === "opponent" && toSeconds(m.timestamp) >= sec
    );
    return reply ? reply.text : null;
  }

  const selected = (tells || []).find((t) => t.id === selectedId) || null;

  if (!tells || tells.length === 0) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-8 text-center text-sm text-ink-400">
        No significant tells were detected this session. Either you were remarkably
        composed — or the camera/mic couldn't get a clear read.
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        {Object.values(TELL_CATEGORIES).map((cat) => (
          <span key={cat} className="flex items-center gap-1.5 text-ink-400">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat].hex }}
            />
            {CATEGORY_COLORS[cat].label}
          </span>
        ))}
      </div>

      {/* The timeline track */}
      <div className="relative rounded-xl border border-ink-700 bg-ink-900/50 px-4 pb-6 pt-16">
        {/* Markers lane */}
        <div className="relative h-2">
          {/* Axis line */}
          <div className="absolute left-0 right-0 top-1 h-px bg-ink-700" />

          {tells.map((tell) => {
            const left = (toSeconds(tell.timestamp) / maxSeconds) * 100;
            const color = getColorForType(tell.type);
            const isSelected = tell.id === selectedId;
            // Stem height scales a little with severity so big tells stand taller.
            const stemHeight = 24 + Math.round((tell.severity || 0.5) * 28);
            return (
              <button
                key={tell.id}
                onClick={() => setSelectedId(isSelected ? null : tell.id)}
                className="group absolute -translate-x-1/2"
                style={{ left: `${left}%`, top: 0 }}
                title={`${tell.timestamp} · ${getLabelForType(tell.type)}`}
              >
                {/* stem */}
                <div
                  className="mx-auto w-px"
                  style={{ height: stemHeight, backgroundColor: color.hex }}
                />
                {/* dot */}
                <div
                  className={`mx-auto h-3 w-3 rounded-full ring-2 transition-transform group-hover:scale-125 ${
                    isSelected ? "ring-white scale-125" : "ring-ink-900"
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              </button>
            );
          })}
        </div>

        {/* Time axis labels */}
        <div className="mt-4 flex justify-between text-[10px] text-ink-400">
          <span>0:00</span>
          <span>{`${Math.floor(maxSeconds / 2 / 60)}:${String(
            Math.floor(maxSeconds / 2) % 60
          ).padStart(2, "0")}`}</span>
          <span>{`${Math.floor(maxSeconds / 60)}:${String(maxSeconds % 60).padStart(
            2,
            "0"
          )}`}</span>
        </div>
      </div>

      {/* Selected tell detail card */}
      {selected && (
        <div className="mt-4 animate-fadeInUp rounded-xl border border-ink-700 bg-ink-800 p-5">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: getColorForType(selected.type).hex }}
            />
            <span className="font-semibold text-ink-200">
              {getLabelForType(selected.type)}
            </span>
            <span className="text-xs text-ink-400">at {selected.timestamp}</span>
            <span className="ml-auto text-xs text-ink-400">
              severity {Math.round((selected.severity || 0) * 100)}%
            </span>
          </div>

          {/* Severity bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((selected.severity || 0) * 100)}%`,
                backgroundColor: getColorForType(selected.type).hex,
              }}
            />
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            {selected.context && (
              <Detail label="What was happening">{selected.context}</Detail>
            )}
            {typeof selected.duration === "number" && (
              <Detail label="Duration">{selected.duration}s</Detail>
            )}
            {typeof selected.percentAboveBaseline === "number" && (
              <Detail label="Above your baseline">
                {selected.percentAboveBaseline}%
              </Detail>
            )}
            {Array.isArray(selected.words) && selected.words.length > 0 && (
              <Detail label="Words">{selected.words.join(", ")}</Detail>
            )}
            <Detail label="What the opponent did next">
              {opponentResponseAfter(selected.timestamp) ? (
                <span className="italic text-ink-200">
                  “{opponentResponseAfter(selected.timestamp)}”
                </span>
              ) : (
                <span className="text-ink-400">— end of session —</span>
              )}
            </Detail>
          </dl>
        </div>
      )}

      {/* Full transcript below the timeline */}
      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-400">
          Transcript
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-ink-800 bg-ink-900/40 p-4 text-sm">
          {(transcript || []).map((m, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-10 shrink-0 font-mono text-[11px] text-ink-400">
                {m.timestamp}
              </span>
              <span className={m.role === "user" ? "text-ink-200" : "text-ink-400"}>
                <span className="font-semibold">
                  {m.role === "user" ? "You" : "Them"}:
                </span>{" "}
                {m.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div className="flex gap-3">
      <dt className="w-44 shrink-0 text-ink-400">{label}</dt>
      <dd className="text-ink-200">{children}</dd>
    </div>
  );
}
