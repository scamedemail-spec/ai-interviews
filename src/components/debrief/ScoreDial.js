// ScoreDial — the big 1-10 confidence score, drawn as an SVG ring so it feels like a
// dashboard gauge. Green-ish at high scores, amber in the middle, red when low.

export default function ScoreDial({ score }) {
  const clamped = Math.max(1, Math.min(10, score || 1));
  const fraction = clamped / 10;

  // SVG ring geometry.
  const size = 140;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * fraction;

  // Color by score band.
  const color = clamped >= 7 ? "#3ddc84" : clamped >= 4 ? "#ffb020" : "#ff4d4d";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#222734"
          strokeWidth={stroke}
        />
        {/* Value arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      {/* Center label (overlaps the svg) */}
      <div className="-mt-[100px] mb-[40px] text-center">
        <div className="text-4xl font-bold text-ink-200" style={{ color }}>
          {clamped}
        </div>
        <div className="text-xs uppercase tracking-widest text-ink-400">/ 10</div>
      </div>
    </div>
  );
}
