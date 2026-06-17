"use client";

// SessionHud — the top bar during a live session: a recording indicator, the running
// timer, a debug toggle (dev tool), and the End Session button.

export default function SessionHud({
  elapsedLabel,
  showDebug,
  onToggleDebug,
  onEnd,
  tellCount,
  voiceOn,
  onToggleVoice,
  voiceSupported,
}) {
  return (
    <div className="flex items-center justify-between border-b border-ink-800 px-2 pb-3">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-ink-200">
          <span className="h-2 w-2 rounded-full bg-tell-gaze animate-pulseDot" />
          REC
        </span>
        <span className="font-mono text-sm text-ink-200">{elapsedLabel}</span>
        <span className="text-xs text-ink-400">· {tellCount} tells logged</span>
      </div>

      <div className="flex items-center gap-2">
        {voiceSupported && (
          <button
            onClick={onToggleVoice}
            title={voiceOn ? "Mute opponent voice" : "Unmute opponent voice"}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              voiceOn
                ? "border-accent text-accent"
                : "border-ink-700 text-ink-400 hover:text-ink-200"
            }`}
          >
            {voiceOn ? "🔊 Voice on" : "🔈 Voice off"}
          </button>
        )}
        <button
          onClick={onToggleDebug}
          className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
            showDebug
              ? "border-accent text-accent"
              : "border-ink-700 text-ink-400 hover:text-ink-200"
          }`}
        >
          {showDebug ? "Hide signals" : "Debug signals"}
        </button>
        <button
          onClick={onEnd}
          className="rounded-md bg-tell-gaze/90 px-4 py-1.5 text-xs font-semibold text-white hover:bg-tell-gaze"
        >
          End session
        </button>
      </div>
    </div>
  );
}
