"use client";

import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Button — one styled button used everywhere, so the look stays consistent.
//
// Props:
//   variant: "primary" (amber) | "secondary" (outlined) | "ghost" (subtle)
//   href:    if provided, renders a Next.js <Link> instead of a <button>
//   ...rest: onClick, type, disabled, etc.
// ─────────────────────────────────────────────────────────────────────────────

const VARIANTS = {
  primary:
    "bg-accent text-ink-950 hover:bg-accent-soft font-semibold shadow-[0_0_24px_rgba(255,176,32,0.25)]",
  secondary:
    "border border-ink-600 text-ink-200 hover:border-accent hover:text-accent bg-transparent",
  ghost: "text-ink-400 hover:text-ink-200 bg-transparent",
};

export default function Button({
  children,
  variant = "primary",
  href,
  className = "",
  ...rest
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
