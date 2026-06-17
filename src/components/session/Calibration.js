"use client";

// Calibration — presentational UI for the 30-second baseline step. The parent
// (session page) owns the timing and the biometrics engine; this component just shows the
// rotating prompts, a progress bar, and the "Baseline locked" finish state.

export default function Calibration({
  progress, // 0..1
  currentPrompt, // string shown to the user to get them talking naturally
  done, // boolean — baseline captured
  onBegin, // called when the user clicks "Begin session"
}) {
  const pct = Math.round(progress * 100);

  return (
    <div className="mx-auto max-w-md text-center">
      {!done ? (
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            Calibrating your baseline
          </div>
          <h2 className="text-xl font-semibold text-ink-200">Just talk naturally</h2>
          <p className="mt-2 text-sm text-ink-400">
            We're learning your personal normal — where your eyes rest, your blink rate,
            your pitch and posture. Every tell later is measured against this.
          </p>

          {/* Rotating casual prompt */}
          <div className="my-8 rounded-xl border border-ink-700 bg-ink-900/70 px-6 py-8">
            <p className="text-lg text-ink-200">“{currentPrompt}”</p>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-ink-400">{pct}%</div>
        </>
      ) : (
        <>
          <div className="mb-3 text-4xl">🔒</div>
          <h2 className="text-2xl font-bold text-ink-200">Baseline locked.</h2>
          <p className="mt-2 text-sm text-ink-400">
            Ready to begin. Speak naturally — the opponent is listening, and watching.
          </p>
          <button
            onClick={onBegin}
            className="mt-8 rounded-lg bg-accent px-8 py-3 text-base font-semibold text-ink-950 hover:bg-accent-soft"
          >
            Begin session →
          </button>
        </>
      )}
    </div>
  );
}
