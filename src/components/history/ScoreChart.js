// ScoreChart — a tiny hand-rolled SVG line chart of session scores over time (oldest →
// newest). No charting library, to keep dependencies minimal. Expects an array of points
// like [{ score, label }] already ordered oldest-first.

export default function ScoreChart({ points }) {
  if (!points || points.length < 2) return null;

  const width = 640;
  const height = 180;
  const padX = 36;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  // X positions spread evenly; Y maps score 1..10 to the plot height (10 at top).
  const stepX = innerW / (points.length - 1);
  const xy = points.map((p, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (p.score - 1) / 9) * innerH;
    return { x, y, ...p };
  });

  // Build the polyline path string.
  const path = xy.map((pt) => `${pt.x},${pt.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Horizontal gridlines at scores 2,4,6,8,10 */}
      {[10, 8, 6, 4, 2].map((s) => {
        const y = padY + (1 - (s - 1) / 9) * innerH;
        return (
          <g key={s}>
            <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#222734" strokeWidth="1" />
            <text x={8} y={y + 4} fontSize="10" fill="#7b8294">
              {s}
            </text>
          </g>
        );
      })}

      {/* The score line */}
      <polyline
        points={path}
        fill="none"
        stroke="#ffb020"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + labels */}
      {xy.map((pt, i) => (
        <g key={i}>
          <circle cx={pt.x} cy={pt.y} r="4" fill="#ffb020" stroke="#08090c" strokeWidth="2" />
          <text x={pt.x} y={height - 4} fontSize="9" fill="#7b8294" textAnchor="middle">
            {pt.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
