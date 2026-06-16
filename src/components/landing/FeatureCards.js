// FeatureCards — the three-layer explanation on the landing page.
import Card from "@/components/ui/Card";

const FEATURES = [
  {
    tag: "Layer 1",
    title: "Conversation practice",
    body: "Describe your real situation — the interview, the raise, the hard talk — and a tailored AI opponent shows up to play the other side. Easy, medium, or plays-dirty hard.",
  },
  {
    tag: "Layer 2",
    title: "Tell detection",
    body: "Your camera and mic run entirely in your browser. We read gaze, blink rate, pitch, pace, filler words, and posture — measured against your own calibrated baseline.",
  },
  {
    tag: "Layer 3",
    title: "Adversarial AI",
    body: "The opponent sees what you gave away and uses it — pressing when you hesitate, pushing when your pitch jumps. Then the debrief shows you every moment, like game film.",
  },
];

export default function FeatureCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {FEATURES.map((f) => (
        <Card key={f.title} className="p-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
            {f.tag}
          </div>
          <h3 className="mb-2 text-lg font-semibold text-ink-200">{f.title}</h3>
          <p className="text-sm leading-relaxed text-ink-400">{f.body}</p>
        </Card>
      ))}
    </div>
  );
}
