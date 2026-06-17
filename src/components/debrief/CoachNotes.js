// CoachNotes — the Claude-generated holistic coaching paragraph. Falls back to a gentle
// placeholder when no AI text is available (e.g. no API key configured yet).

export default function CoachNotes({ notes, achievedGoal }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-accent">
          AI coach notes
        </div>
        {achievedGoal && (
          <span className="rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 text-xs text-ink-200">
            Goal: {achievedGoal}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-ink-200">
        {notes ||
          "Add your Claude API key (.env.local) to unlock full coaching: what went well, the 2–3 biggest things to fix, and a concrete drill for your next session."}
      </p>
    </div>
  );
}
