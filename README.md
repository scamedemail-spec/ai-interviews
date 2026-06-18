# Tell — AI High-Stakes Conversation Simulator

Practice job interviews, salary negotiations, sales calls, and hard conversations against
an adversarial AI that **reads your real-time tells** — gaze, blink rate, pitch, pace,
filler words, and posture — and exploits them like a real negotiator would. Afterward you
get a "game film" debrief showing every tell on a timeline.

> **Every other tool grades what you said. This one sees what you gave away.**

### Try it live (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fscamedemail-spec%2Fwill-stein-detailing&env=ANTHROPIC_API_KEY&envDescription=Claude%20API%20key%20for%20the%20AI%20opponent%20and%20coach%20notes&envLink=https%3A%2F%2Fconsole.anthropic.com%2Fsettings%2Fkeys&project-name=tell&repository-name=tell)

Click the button, sign in with GitHub, paste your [Claude API key](https://console.anthropic.com/settings/keys)
when prompted, and Vercel builds a live HTTPS URL in ~2 minutes. Open it in **Chrome or Edge**
and allow camera + mic. (See [Deploying to Vercel](#deploying-to-vercel) for the manual path.)

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

## Deploying to Vercel

This is a standard Next.js app (a `vercel.json` pins the framework) and deploys cleanly to
Vercel's free **Hobby** tier. Two ways:

### Option A — Import the GitHub repo (recommended)

1. Go to **https://vercel.com/new** and sign in with GitHub.
2. Click **Add New… → Project**, find **`will-stein-detailing`**, and click **Import**.
   (If you don't see it, click *Adjust GitHub App Permissions* and grant access to the repo.)
3. Vercel auto-detects Next.js — leave the build settings as-is (Build: `next build`,
   Output: `.next`, Install: `npm install`).
4. Expand **Environment Variables** and add your Claude key:
   - Name: `ANTHROPIC_API_KEY` — Value: *your key from https://console.anthropic.com/*
   - (Optional) `ANTHROPIC_MODEL` = `claude-sonnet-4-6`
5. Click **Deploy**. In ~1–2 minutes you'll get a live `*.vercel.app` URL.

Every push to `main` will auto-deploy after that.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link                      # link to a Vercel project
vercel env add ANTHROPIC_API_KEY # paste your key when prompted (choose Production)
vercel --prod                    # build + deploy
```

### Notes for live testing
- **Use Chrome or Edge** and open the deployed URL — the browser will prompt for camera +
  mic. HTTPS (which Vercel provides) is required for `getUserMedia`, so the live site works
  even where `http://localhost` would be restricted.
- The app **deploys and runs without** `ANTHROPIC_API_KEY` (landing, setup, calibration,
  biometric debug, local scoring all work); the AI opponent and coach notes just return a
  friendly "key not set" message until the env var is added.
- Costs stay well under a small monthly budget: Vercel Hobby is free, and Claude usage is
  pay-as-you-go on Anthropic's low tiers.

## Privacy

The only outbound network calls are to **your own `/api/*` routes** (which call Claude with
text only) and to Google's CDN to download the MediaPipe model files. Your camera and
microphone streams are processed entirely in the browser and are never uploaded. You can
confirm this in the browser DevTools Network tab during a session.
