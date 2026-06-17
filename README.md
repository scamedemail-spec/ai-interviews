# Tell — AI High-Stakes Conversation Simulator

Practice job interviews, salary negotiations, sales calls, and hard conversations against
an adversarial AI that **reads your real-time tells** — gaze, blink rate, pitch, pace,
filler words, and posture — and exploits them like a real negotiator would. Afterward you
get a "game film" debrief showing every tell on a timeline.

> **Every other tool grades what you said. This one sees what you gave away.**

---

## How it works (two layers)

1. **Biometric detection — 100% in your browser.** [MediaPipe](https://ai.google.dev/edge/mediapipe)
   Face Mesh, Pose, and Hands plus the Web Audio API and Web Speech API read your camera
   and mic *on your device*. A calibration step learns your personal baseline, and a
   signal-processing layer filters the noise into meaningful, timestamped "tells." **No
   video or audio ever leaves your computer.**
2. **AI opponent — Claude.** Every turn, the filtered tells are bundled into a JSON payload
   and sent (as text only) alongside the conversation to the Claude API. The opponent stays
   in character and subtly presses on your weak moments. It also **speaks its replies aloud**
   using the browser's built-in speech synthesis — Claude can wrap phrases in lightweight
   emotion tags (`<anger>`, `<disbelief>`, `<emphasis>`, `<passion>`) that map to delivery
   (rate/pitch/pause), and the opponent voice is pitched down and slowed so it's clearly not
   you. Toggle it with the voice button in the session HUD.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Add your Claude API key
cp .env.local.example .env.local
#    then open .env.local and paste your key after ANTHROPIC_API_KEY=
#    (get one at https://console.anthropic.com/)

# 3. Run it
npm run dev
#    open http://localhost:3000 in Chrome
```

**The app runs without a key** (landing page, setup form, calibration, biometric debug
overlay, local scoring) — but the AI opponent and AI coach notes need a valid
`ANTHROPIC_API_KEY`. Until then those calls return a friendly "key not set" message.

### Browser support
Use **Chrome or Edge on a laptop with a webcam**. Live speech-to-text relies on the Web
Speech API, which only ships in Chromium browsers; elsewhere the app automatically falls
back to typing your turns.

---

## Project structure

```
src/
  app/
    page.js                  Landing page
    setup/page.js            Scenario setup + AI "scouting report"
    session/page.js          Calibration + live session orchestrator
    debrief/page.js          Score, tell timeline, coach notes (also ?id= review)
    history/page.js          Saved sessions + score-over-time chart
    api/persona|chat|debrief Server-side Claude calls (key stays here)
  components/                UI, landing, setup, session, debrief, history
  context/SessionContext.js  In-progress session state across pages
  lib/
    anthropic.js             Single Claude client (model: claude-sonnet-4-6)
    prompts.js               All system-prompt builders
    scoring.js               Local 1–10 score + tell aggregation
    storage.js               localStorage session history (no DB/login)
    biometrics/              The whole client-side detection layer:
      visionLoader.js          loads the 3 MediaPipe models (from CDN)
      faceMetrics / poseMetrics / handMetrics
      voiceMetrics.js          Web Audio pitch/volume
      speech.js                Web Speech transcription
      signalProcessor.js       baselines + filtered, debounced tell detection
      useBiometrics.js         React hook that runs the whole loop
      tellTypes.js             single source of truth for tell types/colors
```

---

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | for AI features | — | Your Claude API key (server-side only). |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-4-6` | Override the Claude model. |

## Deploying

This is a standard Next.js app and deploys cleanly to **Vercel**: import the repo, add
`ANTHROPIC_API_KEY` as an environment variable, and deploy. The Anthropic free/low tiers
plus Vercel's hobby tier keep this comfortably under a small monthly budget.

## Privacy

The only outbound network calls are to **your own `/api/*` routes** (which call Claude with
text only) and to Google's CDN to download the MediaPipe model files. Your camera and
microphone streams are processed entirely in the browser and are never uploaded. You can
confirm this in the browser DevTools Network tab during a session.
