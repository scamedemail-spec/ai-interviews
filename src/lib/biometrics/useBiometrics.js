"use client";

// ─────────────────────────────────────────────────────────────────────────────
// useBiometrics.js
//
// One React hook that wires together EVERYTHING in the biometric layer and exposes a
// simple control surface to the pages:
//
//   const bio = useBiometrics({ onTells, onTranscriptFinal, onTranscriptInterim });
//   bio.attachVideo(videoEl)        // give it the <video> to draw the camera into
//   await bio.requestMedia()        // ask for camera + mic permission
//   await bio.loadModels(onMsg)     // download/init MediaPipe models
//   bio.startCalibration()          // begin collecting baseline samples
//   const baseline = bio.finishCalibration()
//   bio.startSession()              // begin emitting tells + transcribing speech
//   bio.setContext("...")           // tell the processor what the user is saying now
//   bio.stop()                      // release camera/mic and stop everything
//
// The heavy lifting (a single requestAnimationFrame loop, throttled to ~12 fps to keep the
// laptop cool and the conversation responsive) lives here. All detection is client-side;
// no frame or audio sample ever leaves the browser.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback, useState } from "react";
import { loadVisionModels } from "./visionLoader";
import { extractFaceMetrics } from "./faceMetrics";
import { extractPoseMetrics } from "./poseMetrics";
import { extractHandMetrics } from "./handMetrics";
import { VoiceMeter } from "./voiceMetrics";
import { SpeechTranscriber, isSpeechSupported } from "./speech";
import { SignalProcessor } from "./signalProcessor";

// We process at most this many vision frames per second. MediaPipe at full 30fps with
// three models is heavy; ~12fps is plenty for human tells and keeps the UI smooth.
const TARGET_FPS = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export function useBiometrics({
  onTells = () => {},
  onTranscriptFinal = () => {},
  onTranscriptInterim = () => {},
  onError = () => {},
} = {}) {
  // ── Refs hold mutable engine objects that must NOT trigger re-renders ──────--
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelsRef = useRef(null);
  const voiceMeterRef = useRef(null);
  const transcriberRef = useRef(null);
  const processorRef = useRef(new SignalProcessor());
  const rafRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const modeRef = useRef("idle"); // "idle" | "calibrate" | "session"
  const latestMetricsRef = useRef(null); // for the debug overlay

  // Keep the latest callback values in refs so the long-lived loop never goes stale.
  const cbRef = useRef({ onTells, onTranscriptFinal, onTranscriptInterim, onError });
  cbRef.current = { onTells, onTranscriptFinal, onTranscriptInterim, onError };

  // A little reactive state for the UI (status text, debug snapshot).
  const [debugMetrics, setDebugMetrics] = useState(null);
  const [supportsSpeech] = useState(() => isSpeechSupported());

  // Give the hook the <video> element to read frames from. Because the session page swaps
  // the <video> across phases (loading → calibrate → live), we re-bind the existing camera
  // stream to whatever element is currently mounted so the picture never goes black.
  const attachVideo = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  // Ask the browser for camera + mic. Throws if the user denies.
  const requestMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false, // keep volume honest for the voice analysis
      },
    });
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    // Start the voice meter on the audio track.
    voiceMeterRef.current = new VoiceMeter();
    voiceMeterRef.current.start(stream);

    return stream;
  }, []);

  // Download + initialize the MediaPipe models. Call once after requestMedia.
  const loadModels = useCallback(async (onMsg = () => {}) => {
    if (modelsRef.current) return modelsRef.current;
    modelsRef.current = await loadVisionModels(onMsg);
    return modelsRef.current;
  }, []);

  // The single shared loop. Runs while mode !== "idle".
  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);

    const now = performance.now();
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL_MS) return; // throttle
    lastFrameTimeRef.current = now;

    const video = videoRef.current;
    const models = modelsRef.current;
    if (!video || !models || video.readyState < 2) return;

    // Run the three vision models on the current video frame.
    let face, pose, hand;
    try {
      face = extractFaceMetrics(models.faceLandmarker.detectForVideo(video, now));
      pose = extractPoseMetrics(models.poseLandmarker.detectForVideo(video, now));
      hand = extractHandMetrics(models.handLandmarker.detectForVideo(video, now));
    } catch (err) {
      // A dropped frame is not fatal — just skip it.
      return;
    }

    // Sample the voice meter.
    const voice = voiceMeterRef.current
      ? voiceMeterRef.current.sample()
      : { pitch: 0, volume: 0, isSpeaking: false };

    const frame = { face, pose, hand, voice };
    latestMetricsRef.current = frame;

    const processor = processorRef.current;
    if (modeRef.current === "calibrate") {
      processor.addCalibrationSample(frame);
    } else if (modeRef.current === "session") {
      const tells = processor.processFrame(frame);
      if (tells.length > 0) cbRef.current.onTells(tells);
    }

    // Throttle debug-state updates to ~3/sec so we don't thrash React.
    if (now - (loop._lastDebug || 0) > 333) {
      loop._lastDebug = now;
      setDebugMetrics(snapshotForDebug(frame));
    }
  }, []);

  const ensureLoopRunning = useCallback(() => {
    if (rafRef.current == null) {
      lastFrameTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  // ── Phase controls ─────────────────────────────────────────────────────────
  const startCalibration = useCallback(() => {
    modeRef.current = "calibrate";
    ensureLoopRunning();
  }, [ensureLoopRunning]);

  const finishCalibration = useCallback(() => {
    const baseline = processorRef.current.finalizeBaseline();
    modeRef.current = "idle";
    return baseline;
  }, []);

  const startSession = useCallback(() => {
    const processor = processorRef.current;
    processor.startSession(Date.now());
    modeRef.current = "session";
    ensureLoopRunning();

    // Start live speech transcription (voice is the primary input mode).
    if (isSpeechSupported()) {
      transcriberRef.current = new SpeechTranscriber({
        onInterim: (text) => cbRef.current.onTranscriptInterim(text),
        onFinal: (text) => {
          // Scan finalized speech for filler/hedging tells, then hand text to the page.
          const fillerTells = processor.processTranscript(text);
          if (fillerTells.length > 0) cbRef.current.onTells(fillerTells);
          cbRef.current.onTranscriptFinal(text);
        },
        onError: (msg) => cbRef.current.onError(msg),
      });
      transcriberRef.current.start();
    }
  }, []);

  // Update what the user is currently saying, so tells get meaningful context strings.
  const setContext = useCallback((text) => {
    processorRef.current.setContext(text);
  }, []);

  // Pause only the speech recognizer (e.g. while the opponent is "speaking").
  const pauseTranscription = useCallback(() => {
    if (transcriberRef.current) transcriberRef.current.stop();
  }, []);
  const resumeTranscription = useCallback(() => {
    if (transcriberRef.current && isSpeechSupported()) transcriberRef.current.start();
  }, []);

  // Tear everything down and release the camera/mic.
  const stop = useCallback(() => {
    modeRef.current = "idle";
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (transcriberRef.current) transcriberRef.current.stop();
    if (voiceMeterRef.current) voiceMeterRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  return {
    videoRef,
    attachVideo,
    requestMedia,
    loadModels,
    startCalibration,
    finishCalibration,
    startSession,
    setContext,
    pauseTranscription,
    resumeTranscription,
    stop,
    debugMetrics,
    supportsSpeech,
    getProcessor: () => processorRef.current,
  };
}

// Build a small, human-readable snapshot for the debug overlay (step 4 of the build).
function snapshotForDebug(frame) {
  const { face, pose, hand, voice } = frame;
  return {
    face: face && face.facePresent
      ? {
          gazeX: round(face.gazeX),
          gazeY: round(face.gazeY),
          eyeOpenness: round(face.eyeOpenness),
          browRaise: round(face.browRaise),
        }
      : null,
    pose: pose && pose.posePresent
      ? {
          shoulderWidth: round(pose.shoulderWidth),
          armsCrossed: pose.armsCrossed,
          handToFace: pose.handToFace,
        }
      : null,
    hand: hand && hand.handsPresent ? { clench: round(hand.clenchScore) } : null,
    voice: {
      pitch: Math.round(voice.pitch),
      volume: round(voice.volume),
      speaking: voice.isSpeaking,
    },
  };
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}
