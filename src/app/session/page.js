"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Live Session Page  ( /session )
//
// This single page runs the whole real-time experience in phases:
//   permission → loading models → calibration → ready → live conversation → (debrief)
//
// It owns the orchestration; the heavy biometric machinery lives in useBiometrics(), and
// the conversation/Claude calls happen here. When the user ends the session we stop the
// camera and navigate to the debrief, which reads everything from SessionContext.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";
import { useBiometrics } from "@/lib/biometrics/useBiometrics";
import VideoFeed from "@/components/session/VideoFeed";
import Calibration from "@/components/session/Calibration";
import ConversationPanel from "@/components/session/ConversationPanel";
import DebugOverlay from "@/components/session/DebugOverlay";
import SessionHud from "@/components/session/SessionHud";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

// How long calibration runs.
const CALIBRATION_MS = 30000;
// Casual prompts shown during calibration to get the user talking naturally.
const CALIBRATION_PROMPTS = [
  "Tell me about your morning.",
  "What did you have for lunch?",
  "Describe your walk or commute today.",
  "What's a show you've been watching lately?",
];

// Format milliseconds as "M:SS".
function formatElapsed(ms) {
  const totalSec = Math.max(Math.floor(ms / 1000), 0);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SessionPage() {
  const router = useRouter();
  const {
    session,
    setBaseline,
    markStarted,
    addMessage,
    addTells,
    resetKeepConfig,
  } = useSession();

  // ── Phase machine ──────────────────────────────────────────────────────────
  // "permission" | "loading" | "calibrate" | "ready" | "live"
  const [phase, setPhase] = useState("permission");
  const [loadMsg, setLoadMsg] = useState("");
  const [error, setError] = useState("");

  // Calibration UI state.
  const [calibProgress, setCalibProgress] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);

  // Live conversation UI state.
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [opponentThinking, setOpponentThinking] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  // Refs that the long-lived biometric callbacks and timers read/write without re-rendering.
  const convoRef = useRef([]); // mirror of the transcript for building API payloads
  const pendingTellsRef = useRef([]); // tells accumulated since the last user turn
  const tellCountRef = useRef(0);
  const startedAtRef = useRef(null);
  const [tellCount, setTellCount] = useState(0);

  const config = session.config;
  const persona = session.persona;
  const opponentName = persona?.name || "Opponent";

  // ── Biometrics hook with stable callbacks (it stores latest refs internally) ─
  const bio = useBiometrics({
    onTells: (tells) => {
      // Add to the full session log AND to the per-turn pending buffer.
      addTells(tells);
      pendingTellsRef.current.push(...tells);
      tellCountRef.current += tells.length;
      setTellCount(tellCountRef.current);
    },
    onTranscriptInterim: (text) => setInterim(text),
    onTranscriptFinal: (text) => {
      // Append finalized speech to the editable draft, and feed context to the processor.
      setDraft((prev) => (prev ? prev + " " + text : text));
      bio.setContext(text);
      setInterim("");
    },
    onError: (msg) => {
      // Non-fatal (e.g. speech hiccup) — surface quietly.
      console.warn(msg);
    },
  });

  // If the user landed here without setting up a scenario, send them to setup.
  useEffect(() => {
    if (!config) router.replace("/setup");
  }, [config, router]);

  // Clean up camera/mic if the user navigates away.
  useEffect(() => {
    return () => bio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step A: request permission + load models ────────────────────────────────
  async function handleEnable() {
    setError("");
    setPhase("loading");
    try {
      await bio.requestMedia();
      await bio.loadModels((msg) => setLoadMsg(msg));
      setPhase("calibrate");
    } catch (err) {
      setError(
        err && err.name === "NotAllowedError"
          ? "Camera/mic permission was denied. The app needs both to read your tells."
          : "Could not start the camera/models: " + (err?.message || err)
      );
      setPhase("permission");
    }
  }

  // ── Step B: run calibration once we enter the "calibrate" phase ─────────────
  useEffect(() => {
    if (phase !== "calibrate") return;

    bio.startCalibration();
    const start = performance.now();

    // Rotate the casual prompt every ~7 seconds.
    const promptTimer = setInterval(() => {
      setPromptIndex((i) => (i + 1) % CALIBRATION_PROMPTS.length);
    }, 7000);

    // Drive the progress bar and finish at 100%.
    const tick = setInterval(() => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / CALIBRATION_MS, 1);
      setCalibProgress(progress);
      if (progress >= 1) {
        clearInterval(tick);
        clearInterval(promptTimer);
        const baseline = bio.finishCalibration();
        setBaseline(baseline);
        setPhase("ready");
      }
    }, 150);

    return () => {
      clearInterval(tick);
      clearInterval(promptTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Step C: begin the live session ──────────────────────────────────────────
  function handleBegin() {
    markStarted();
    startedAtRef.current = Date.now();
    bio.startSession();
    setListening(bio.supportsSpeech);

    // Seed the opponent's opening line so the conversation starts in character.
    if (persona?.openingLine) {
      const opener = { role: "opponent", text: persona.openingLine, timestamp: "0:00" };
      convoRef.current = [opener];
      addMessage(opener);
    }
    setPhase("live");
  }

  // Tick the session timer while live.
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - (startedAtRef.current || Date.now()));
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  // ── Sending a user turn ─────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || opponentThinking) return;

    const timestamp = formatElapsed(Date.now() - (startedAtRef.current || Date.now()));
    const userMsg = { role: "user", text, timestamp };

    // Update both the visible transcript and our payload mirror.
    convoRef.current = [...convoRef.current, userMsg];
    addMessage(userMsg);
    setDraft("");
    setInterim("");

    // Drain the tells collected since the last turn — these get exploited by the opponent.
    const tellsSinceLastTurn = pendingTellsRef.current;
    pendingTellsRef.current = [];

    setOpponentThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          persona,
          transcript: convoRef.current,
          tellsSinceLastTurn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The opponent could not respond.");

      const replyStamp = formatElapsed(Date.now() - (startedAtRef.current || Date.now()));
      const opponentMsg = { role: "opponent", text: data.reply, timestamp: replyStamp };
      convoRef.current = [...convoRef.current, opponentMsg];
      addMessage(opponentMsg);
    } catch (err) {
      const errMsg = {
        role: "opponent",
        text: "⚠️ " + err.message,
        timestamp: formatElapsed(Date.now() - (startedAtRef.current || Date.now())),
      };
      convoRef.current = [...convoRef.current, errMsg];
      addMessage(errMsg);
    } finally {
      setOpponentThinking(false);
    }
  }, [draft, opponentThinking, config, persona, addMessage]);

  // Toggle the microphone on/off during the session.
  function handleToggleMic() {
    if (listening) {
      bio.pauseTranscription();
      setListening(false);
    } else {
      bio.resumeTranscription();
      setListening(true);
    }
  }

  // End the session and go to the debrief (which reads everything from context).
  function handleEnd() {
    bio.stop();
    router.push("/debrief");
  }

  // ── Render ───────────────────────────────────────────────────────────────---
  if (!config) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        Redirecting to setup…
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />

      {/* PERMISSION INTRO */}
      {phase === "permission" && (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-bold text-ink-200">Enable camera &amp; microphone</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            We read your gaze, expression, voice, and posture to detect tells — all{" "}
            <span className="text-accent">on your device</span>. No video or audio is ever
            uploaded. You can stop anytime.
          </p>
          {error && (
            <div className="mt-5 w-full rounded-lg border border-tell-gaze/40 bg-tell-gaze/10 px-4 py-3 text-sm text-tell-gaze">
              {error}
            </div>
          )}
          <Button onClick={handleEnable} className="mt-8 px-7 py-3 text-base">
            Enable &amp; continue
          </Button>
          {!bio.supportsSpeech && (
            <p className="mt-4 text-xs text-ink-400">
              Heads up: live speech-to-text isn't supported in this browser, so you'll type
              your turns. For voice, use Chrome or Edge.
            </p>
          )}
        </div>
      )}

      {/* LOADING MODELS */}
      {phase === "loading" && (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
          <Spinner className="h-6 w-6" />
          <p className="mt-4 text-sm text-ink-200">{loadMsg || "Starting up…"}</p>
          <p className="mt-1 text-xs text-ink-400">
            First run downloads the on-device vision models (a few seconds).
          </p>
          {/* Hidden video so the stream has somewhere to attach during load. */}
          <div className="pointer-events-none absolute opacity-0">
            <VideoFeed attachVideo={bio.attachVideo} badge={false} className="h-2 w-2" />
          </div>
        </div>
      )}

      {/* CALIBRATION / READY */}
      {(phase === "calibrate" || phase === "ready") && (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
          <VideoFeed
            attachVideo={bio.attachVideo}
            className="mb-8 h-48 w-64"
          />
          <Calibration
            progress={calibProgress}
            currentPrompt={CALIBRATION_PROMPTS[promptIndex]}
            done={phase === "ready"}
            onBegin={handleBegin}
          />
        </div>
      )}

      {/* LIVE SESSION */}
      {phase === "live" && (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-4">
          <SessionHud
            elapsedLabel={formatElapsed(elapsedMs)}
            showDebug={showDebug}
            onToggleDebug={() => setShowDebug((v) => !v)}
            onEnd={handleEnd}
            tellCount={tellCount}
          />

          <div className="mt-4 grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
            {/* Conversation */}
            <div className="flex min-h-0 flex-col rounded-xl border border-ink-800 bg-ink-900/40 p-4">
              <ConversationPanel
                transcript={session.transcript}
                opponentName={opponentName}
                opponentThinking={opponentThinking}
                draft={draft}
                setDraft={setDraft}
                interim={interim}
                onSend={handleSend}
                listening={listening}
                onToggleMic={handleToggleMic}
                speechSupported={bio.supportsSpeech}
                disabled={false}
              />
            </div>

            {/* Right rail: self-view + (optional) debug signals */}
            <div className="flex flex-col gap-4">
              <VideoFeed attachVideo={bio.attachVideo} className="h-40 w-full" />
              {showDebug && <DebugOverlay metrics={bio.debugMetrics} />}
              {!showDebug && (
                <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-3 text-xs leading-relaxed text-ink-400">
                  The opponent can see what you give away. Stay composed — your tells are
                  being logged for the debrief.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
