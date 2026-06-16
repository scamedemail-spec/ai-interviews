// TellSummary — aggregated stats. Shows a count per category plus the AI-written summary
// paragraph (or a generated fallback if no AI text is available).

import { summarizeTells } from "@/lib/scoring";
import { CATEGORY_COLORS, TELL_CATEGORIES, getLabelForType } from "@/lib/biometrics/tellTypes";

export default function TellSummary({ tells, aiSummary }) {
  const { byCategory, byType, total } = summarizeTells(tells);

  return (
    <div className="space-y-5">
      {/* Category counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.values(TELL_CATEGORIES).map((cat) => {
          const color = CATEGORY_COLORS[cat];
          return (
            <div
              key={cat}
              className="rounded-xl border border-ink-700 bg-ink-900/50 p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-xs uppercase tracking-wider text-ink-400">
                  {color.label}
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-ink-200">
                {byCategory[cat] || 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI summary paragraph (or fallback) */}
      <div className="rounded-xl border border-ink-700 bg-ink-800/60 p-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
          The read
        </div>
        <p className="text-sm leading-relaxed text-ink-200">
          {aiSummary || buildFallbackSummary(byType, total)}
        </p>
      </div>
    </div>
  );
}

// If we have no AI summary (e.g. no API key), build a plain-language one from the counts.
function buildFallbackSummary(byType, total) {
  if (total === 0) {
    return "No significant tells were detected. Either you stayed very composed, or the camera/mic couldn't get a clean read this session.";
  }
  const parts = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type, count]) => `${count}× ${getLabelForType(type).toLowerCase()}`);
  return `We logged ${total} tells this session. The most frequent were: ${parts.join(
    ", "
  )}. Add your Claude API key to get a full coaching breakdown of what these patterns mean and when they happened.`;
}
