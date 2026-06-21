"use client";

import { useRef, useCallback, useState } from "react";
import { loadVisionModels } from "./visionLoader";
import { extractFaceMetrics } from "./faceMetrics";
import { extractPoseMetrics } from "./poseMetrics";
import { extractHandMetrics } from "./handMetrics";
import { VoiceMeter } from "./voiceMetrics";
import { SpeechTranscriber, isSpeechSupported } from "./speech";
import { SignalProcessor } from "./signalProcessor";
import { HumeEmotionClient } from "./humeEmotionClient";
import { DeepgramTranscriber, isDeepgramSupported } from "./deepgramTranscriber";

const TARGET_FPS = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const HUME_INTERVAL_MS = 3000; // send a frame to Hume every 3 seconds

export function useBiometrics({
  onTells = () => {},
  onTranscriptFinal = () => {},
  onTranscriptInterim = () => {},
  onError = () => {},
} = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelsRef = useRef(null);
  const voiceMeterRef = useRef(null);
  const transcriberRef = useRef(null);
  const processorRef = useRef(new SignalProcessor());
  const rafRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const lastHumeFrameTimeRef = useRef(0);
  const modeRef = useRef("idle");
  const latestMetricsRef = useRef(null);
  const humeClientRef = useRef(null);

  const cbRef = useRef({ onTells, onTranscriptFinal, onTranscriptInterim, onError });
  cbRef.current = { onTells, onTranscriptFinal, onTranscriptInterim, onError };

  const [debugMetrics, setDebugMetrics] = useState(null);
  const [supportsSpeech] = useState(() => isSpeechSupported() || isDeepgramSupported());

  const attachVideo = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const requestMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    voiceMeterRef.current = new VoiceMeter();
    voiceMeterRef.current.start(stream);

    return stream;
  }, []);

  const loadModels = useCallback(async (onMsg = () => {}) => {
    if (modelsRef.current) return modelsRef.current;
    modelsRef.current = await loadVisionModels(onMsg);

    // Initialize Hume AI emotion client (non-blocking — best effort)
    try {
      const humeRes = await fetch("/api/hume-token");
      if (humeRes.ok) {
        const { apiKey } = await humeRes.json();
        if (apiKey) {
          const hume = new HumeEmotionClient(apiKey);
          hume.onTell = (tell) => cbRef.current.onTells([tell]);
          hume.connect();
          humeClientRef.current = hume;
        }
      }
    } catch (e) {
      console.warn("[Hume] Could not initialize:", e.message);
    }

    return modelsRef.current;
  }, []);

  const loop = useCallback(() => {
    rafRef.current = requestAnimationFrame(loop);

    const now = performance.now();
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL_MS) return;
    lastFrameTimeRef.current = now;

    const video = videoRef.current;
    const models = modelsRef.current;
    if (!video || !models || video.readyState < 2) return;

    let face, pose, hand;
    try {
      face = extractFaceMetrics(models.faceLandmarker.detectForVideo(video, now));
      pose = extractPoseMetrics(models.poseLandmarker.detectForVideo(video, now));
      hand = extractHandMetrics(models.handLandmarker.detectForVideo(video, now));
    } catch {
      return;
    }

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

      // Send a frame to Hume every HUME_INTERVAL_MS
      if (humeClientRef.current && now - lastHumeFrameTimeRef.current > HUME_INTERVAL_MS) {
        lastHumeFrameTimeRef.current = now;
        humeClientRef.current.sendFrame(video);
      }
    }

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

    // Prefer Deepgram over browser Speech API when available
    if (isDeepgramSupported()) {
      fetch("/api/deepgram-token")
        .then((r) => r.json())
        .then(({ token }) => {
          transcriberRef.current = new DeepgramTranscriber({
            token,
            onInterim: (text) => cbRef.current.onTranscriptInterim(text),
            onFinal: (text) => {
              // Filler word detection happens inside DeepgramTranscriber
              cbRef.current.onTranscriptFinal(text);
            },
            onTell: (tell) => cbRef.current.onTells([tell]),
            onError: (msg) => cbRef.current.onError(msg),
          });
          if (streamRef.current) {
            transcriberRef.current.start(streamRef.current);
          }
        })
        .catch(() => _startBrowserSpeech(processor));
    } else if (isSpeechSupported()) {
      _startBrowserSpeech(processor);
    }

    function _startBrowserSpeech(processor) {
      const { SpeechTranscriber: ST } = require("./speech");
      transcriberRef.current = new ST({
        onInterim: (text) => cbRef.current.onTranscriptInterim(text),
        onFinal: (text) => {
          const fillerTells = processor.processTranscript(text);
          if (fillerTells.length > 0) cbRef.current.onTells(fillerTells);
          cbRef.current.onTranscriptFinal(text);
        },
        onError: (msg) => cbRef.current.onError(msg),
      });
      transcriberRef.current.start();
    }
  }, [ensureLoopRunning]);

  const setContext = useCallback((text) => {
    processorRef.current.setContext(text);
  }, []);

  const pauseTranscription = useCallback(() => {
    if (transcriberRef.current) {
      if (transcriberRef.current.stop) transcriberRef.current.stop();
    }
  }, []);

  const resumeTranscription = useCallback(() => {
    if (transcriberRef.current && streamRef.current) {
      if (transcriberRef.current instanceof DeepgramTranscriber) {
        transcriberRef.current.start(streamRef.current);
      } else if (isSpeechSupported()) {
        transcriberRef.current.start();
      }
    }
  }, []);

  const stop = useCallback(() => {
    modeRef.current = "idle";
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (transcriberRef.current) transcriberRef.current.stop();
    if (voiceMeterRef.current) voiceMeterRef.current.stop();
    if (humeClientRef.current) {
      humeClientRef.current.disconnect();
      humeClientRef.current = null;
    }
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
