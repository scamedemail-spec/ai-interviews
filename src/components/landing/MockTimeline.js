// MockTimeline — the visual "hook" on the landing page. It's a faked debrief timeline
// that shows what the real product produces: colored tell markers placed along a
// conversation, with a sweeping playhead. Pure CSS/markup, no real data.

import { CATEGORY_COLORS, TELL_CATEGORIES } from "@/lib/biometrics/tellTypes";

// A few hand-placed markers (percent across the timeline + category + label).
const MOCK_MARKERS = [
  { at: 12, cat: TELL_CATEGORIES.FILLER, label: "“um, I was thinking…”" },
  { at: 27, cat: TELL_CATEGORIES.VOCAL, label: "pitch +18%" },
  { at: 38, cat: TELL_CATEGORIES.GAZE, label: "gaze dropped 1.4s" },
  { at: 52, cat: TELL_CATEGORIES.POSTURAL, label: "leaned back" },
  { at: 64, cat: TELL_CATEGORIES.GAZE, label: "eyes darted" },
  { at: 79, cat: TELL_CATEGORIES.FILLER, label: "“I guess that works”" },
  { at: 91, cat: TELL_CATEGORIES.VOCAL, label: "voice dropped" },
];

export default function MockTimeline() {
  return (
    <div className="relative rounded-xl border border-ink-700 bg-ink-900/80 p-5 shadow-2xl">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-widest text-ink-400">
        <span>Session debrief — salary negotiation</span>
        <span className="text-accent">Confidence 6 / 10</span>
      </div>

      {/* The timeline track */}
      <div className="relative h-28">
        {/* Baseline axis */}
        <div className="absolute bottom-8 left-0 right-0 h-px bg-ink-700" />

        {/* Sweeping playhead */}
        <div className="absolute bottom-8 top-0 w-px bg-accent/70 animate-sweep" />

        {/* Markers */}
        {MOCK_MARKERS.map((m, i) => {
          const color = CATEGORY_COLORS[m.cat];
          return (
            <div
              key={i}
              className="absolute flex flex-col items-center"
              style={{ left: `${m.at}%`, bottom: "2rem" }}
            >
              {/* vertical stem */}
              <div
                className="mb-1 w-px"
                style={{ height: 36 + (i % 3) * 14, backgroundColor: color.hex }}
              />
              {/* dot */}
              <div
                className="h-3 w-3 rounded-full ring-2 ring-ink-900"
                style={{ backgroundColor: color.hex }}
              />
            </div>
          );
        })}

        {/* A couple of floating labels for flavor */}
        <div className="absolute left-[27%] top-0 -translate-x-1/2 rounded bg-ink-800 px-2 py-1 text-[10px] text-tell-vocal border border-ink-700">
          pitch +18%
        </div>
        <div className="absolute left-[38%] top-10 -translate-x-1/2 rounded bg-ink-800 px-2 py-1 text-[10px] text-tell-gaze border border-ink-700">
          gaze dropped 1.4s
        </div>
      </div>

      {/* Transcript strip along the bottom */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-ink-400">
        <span>“…I was hoping for around ninety-five.”</span>
        <span className="text-center">“That's above our band.”</span>
        <span className="text-right">“I guess that works.”</span>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
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
    </div>
  );
}
