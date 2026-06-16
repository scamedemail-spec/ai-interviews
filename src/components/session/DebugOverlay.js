"use client";

// DebugOverlay — a developer view of the raw, live biometric numbers. Per the build plan
// this is visible during development (build step 4) and hidden by default in the polished
// experience (step 9). Toggle it with the "debug" button in the session HUD.

export default function DebugOverlay({ metrics }) {
  if (!metrics) {
    return (
      <div className="rounded-lg border border-ink-700 bg-ink-900/80 p-3 font-mono text-[11px] text-ink-400">
        waiting for signal…
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-900/80 p-3 font-mono text-[11px] text-ink-200">
      <Row label="FACE" data={metrics.face} empty="no face" />
      <Row label="POSE" data={metrics.pose} empty="no body" />
      <Row label="HAND" data={metrics.hand} empty="no hands" />
      <Row label="VOICE" data={metrics.voice} empty="—" />
    </div>
  );
}

function Row({ label, data, empty }) {
  return (
    <div>
      <span className="text-accent">{label}</span>{" "}
      {data ? (
        <span>
          {Object.entries(data)
            .map(([k, v]) => `${k}:${typeof v === "boolean" ? (v ? "Y" : "n") : v}`)
            .join("  ")}
        </span>
      ) : (
        <span className="text-ink-600">{empty}</span>
      )}
    </div>
  );
}
