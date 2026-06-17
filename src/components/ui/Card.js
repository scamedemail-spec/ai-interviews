// Card — a simple dark panel with a subtle border. Used for grouping content.
export default function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-ink-700 bg-ink-800/60 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}
