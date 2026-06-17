// ScoutingReport — the card that shows the AI-generated opponent before calibration.
// Looks like an intel/scouting dossier to match the "sports analytics" vibe.

import Card from "@/components/ui/Card";

export default function ScoutingReport({ persona }) {
  if (!persona) return null;

  return (
    <Card className="overflow-hidden">
      {/* Header band */}
      <div className="border-b border-ink-700 bg-ink-900/60 px-6 py-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-accent">
          Scouting report
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <h3 className="text-xl font-bold text-ink-200">{persona.name}</h3>
          <span className="text-sm text-ink-400">{persona.role}</span>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        <p className="text-sm leading-relaxed text-ink-200">{persona.personality}</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-400">
              Priorities
            </div>
            <ul className="space-y-1.5 text-sm text-ink-200">
              {(persona.priorities || []).map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent">▸</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-400">
              Pressure points they'll use
            </div>
            <ul className="space-y-1.5 text-sm text-ink-200">
              {(persona.pressurePoints || []).map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-tell-gaze">▸</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {persona.openingLine && (
          <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-4">
            <div className="mb-1 text-xs uppercase tracking-widest text-ink-400">
              They'll open with
            </div>
            <p className="text-sm italic text-ink-200">“{persona.openingLine}”</p>
          </div>
        )}
      </div>
    </Card>
  );
}
