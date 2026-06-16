// Spinner — a small amber loading indicator.
export default function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-accent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
