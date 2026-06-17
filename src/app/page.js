// ─────────────────────────────────────────────────────────────────────────────
// Landing Page  ( / )
//
// The first thing visitors see. Bold hero, the three-layer explanation, the mock debrief
// timeline as a visual hook, and a clear call to action to start a free practice session.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import Button from "@/components/ui/Button";
import MockTimeline from "@/components/landing/MockTimeline";
import FeatureCards from "@/components/landing/FeatureCards";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Faint grid + amber glow backdrop */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />

      {/* Top nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-ink-200">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent animate-pulseDot" />
          TELL
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/history" className="text-ink-400 hover:text-ink-200">
            History
          </Link>
          <Button href="/setup" variant="secondary">
            Start a session
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-12 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="animate-fadeInUp">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1 text-xs text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Practice the conversations that actually matter
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-ink-200 md:text-5xl">
              Every other tool grades what you{" "}
              <span className="text-ink-400">said.</span>
              <br />
              We see what you{" "}
              <span className="text-accent accent-glow">gave away.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-400">
              A practice arena for interviews, salary negotiations, sales calls, and hard
              conversations. The AI opponent reads your face, voice, and body in real time —
              and exploits every tell, just like the real thing.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Button href="/setup" className="px-7 py-3 text-base">
                Start a free session →
              </Button>
              <span className="text-xs text-ink-400">
                No sign-up. Runs in your browser.
              </span>
            </div>
          </div>

          {/* The mock debrief hook */}
          <div className="animate-fadeInUp [animation-delay:120ms]">
            <MockTimeline />
          </div>
        </div>
      </section>

      {/* Three layers */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">
          Three layers working together
        </h2>
        <FeatureCards />
      </section>

      {/* Privacy strip — this is a feature, so we state it loudly. */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-6 text-center">
          <p className="text-sm text-ink-200">
            <span className="font-semibold text-accent">Private by design.</span>{" "}
            Your camera and microphone are analyzed entirely on your device. No video or
            audio is ever uploaded — only the conversation text and anonymized tell signals
            reach the AI.
          </p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-ink-800 py-8 text-center text-xs text-ink-400">
        Built as a practice tool. Optimized for Chrome on a laptop with a webcam.
      </footer>
    </main>
  );
}
