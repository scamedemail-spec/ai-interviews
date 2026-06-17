"use client";

// ─────────────────────────────────────────────────────────────────────────────
// signalProcessor.js
//
// THE BRAIN of the biometric layer. Raw MediaPipe / Web Audio numbers are noisy and
// meaningless on their own — a single frame where your eyes flick away is not a "tell."
// This file does two jobs:
//
//   1. CALIBRATION: during the 30-second baseline, it collects samples and computes each
//      user's PERSONAL normal (where their eyes rest, how often they blink, their average
//      pitch and its variation, their posture). Everything afterward is measured as
//      DEVIATION FROM THIS BASELINE — never absolute values.
//
//   2. DETECTION: during the live session, it watches the per-frame metrics and the
//      transcript and emits "tells" ONLY when a signal is real, applying the debounce
//      rules from the spec:
//        - ignore momentary glances away (< 0.3s)
//        - blink rate must stay above ~2× baseline for > 2s before flagging
//        - ignore pitch spikes that don't coincide with speech
//        - postural shifts must sustain > 1s
//      Each emitted tell is timestamped to the conversation moment and given a severity.
//
// Usage:
//   const sp = new SignalProcessor();
//   // calibration phase:
//   sp.addCalibrationSample({ face, voice, pose, hand });   // many times over 30s
//   const baseline = sp.finalizeBaseline();
//   // session phase:
//   sp.startSession(Date.now());
//   const newTells = sp.processFrame({ face, voice, pose, hand }, context);
//   const fillerTells = sp.processTranscript(text);
// ─────────────────────────────────────────────────────────────────────────────

import { FILLER_WORDS, HEDGING_PHRASES, clamp01 } from "./tellTypes";

// ── Tunable thresholds (all commented so a beginner can adjust them) ──────────
const GAZE_AWAY_DELTA = 0.12; // how far gaze must drift from baseline center to count as "away"
const GAZE_MIN_AWAY_MS = 300; // ignore glances shorter than this (the spec's 0.3s rule)
const BLINK_WINDOW_MS = 4000; // rolling window used to estimate current blink rate
const BLINK_SUSTAIN_MS = 2000; // blink rate must stay elevated this long before flagging
const PITCH_RISE_STD = 1.6; // pitch must exceed baseline by this many std-devs to flag
const POSTURE_SUSTAIN_MS = 1000; // postural shifts must hold this long (the spec's 1s rule)
const LEAN_BACK_SHRINK = 0.88; // shoulders shrinking below 88% of baseline = leaned back
const FIDGET_WINDOW_MS = 2500; // window for measuring wrist jitter
const FIDGET_MOVE_THRESHOLD = 0.9; // accumulated normalized wrist motion that counts as fidgeting
const TELL_COOLDOWN_MS = 3500; // minimum gap between two tells of the SAME type (anti-spam)

export class SignalProcessor {
  constructor() {
    // Calibration accumulators (filled during the 30s baseline).
    this.calib = {
      gazeX: [],
      gazeY: [],
      eyeOpen: [],
      browRaise: [],
      pitch: [],
      shoulderWidth: [],
      clench: [],
      blinkCount: 0,
      startMs: null,
      lastMs: null,
      // blink state machine during calibration
      eyeClosed: false,
    };

    this.baseline = null; // set by finalizeBaseline()

    // Live session state.
    this.sessionStartMs = null;
    this.currentContext = ""; // short text describing what the user is saying right now
    this.state = freshSessionState();
  }

  // ── CALIBRATION ────────────────────────────────────────────────────────────

  addCalibrationSample({ face, voice, pose, hand }) {
    const now = performance.now();
    if (this.calib.startMs === null) this.calib.startMs = now;
    this.calib.lastMs = now;

    if (face && face.facePresent) {
      this.calib.gazeX.push(face.gazeX);
      this.calib.gazeY.push(face.gazeY);
      this.calib.eyeOpen.push(face.eyeOpenness);
      this.calib.browRaise.push(face.browRaise);

      // Count blinks during calibration to learn the user's natural blink rate.
      this._trackBlinkForCalibration(face.eyeOpenness);
    }
    if (voice && voice.isSpeaking && voice.pitch > 0) {
      this.calib.pitch.push(voice.pitch);
    }
    if (pose && pose.posePresent) {
      this.calib.shoulderWidth.push(pose.shoulderWidth);
    }
    if (hand && hand.handsPresent) {
      this.calib.clench.push(hand.clenchScore);
    }
  }

  // Simple blink detector for the calibration phase (counts closed→open transitions).
  _trackBlinkForCalibration(eyeOpenness) {
    // We don't have a baseline yet, so use a reasonable absolute-ish threshold.
    const closedThreshold = 0.18;
    if (eyeOpenness < closedThreshold && !this.calib.eyeClosed) {
      this.calib.eyeClosed = true;
    } else if (eyeOpenness > closedThreshold * 1.4 && this.calib.eyeClosed) {
      this.calib.eyeClosed = false;
      this.calib.blinkCount++;
    }
  }

  // Compute the baseline from everything collected. Returns the baseline object and
  // stores it on the processor.
  finalizeBaseline() {
    const durationMs = Math.max((this.calib.lastMs || 0) - (this.calib.startMs || 0), 1);
    const durationMin = durationMs / 60000;

    const eyeOpenMean = mean(this.calib.eyeOpen) || 0.25;

    this.baseline = {
      gazeXMean: mean(this.calib.gazeX) || 0.5,
      gazeYMean: mean(this.calib.gazeY) || 0.5,
      eyeOpenMean,
      // A blink = eye openness dropping below ~55% of the user's resting openness.
      blinkThreshold: eyeOpenMean * 0.55,
      blinkRatePerMin: this.calib.blinkCount / Math.max(durationMin, 0.1),
      browRaiseMean: mean(this.calib.browRaise) || 0,
      browRaiseStd: std(this.calib.browRaise) || 0.01,
      pitchMean: mean(this.calib.pitch) || 0,
      pitchStd: std(this.calib.pitch) || 1,
      shoulderWidthMean: mean(this.calib.shoulderWidth) || 0,
      clenchMean: mean(this.calib.clench) || 0,
      capturedAt: Date.now(),
    };

    return this.baseline;
  }

  // Restore a saved baseline (e.g. if calibration was done earlier).
  loadBaseline(baseline) {
    this.baseline = baseline;
  }

  // ── SESSION ──────────────────────────────────────────────────────────────--

  startSession(sessionStartMs) {
    this.sessionStartMs = sessionStartMs || Date.now();
    this.state = freshSessionState();
  }

  // The live session sets this to the user's most recent words so tells can carry context
  // like "while stating their number".
  setContext(text) {
    this.currentContext = (text || "").slice(0, 120);
  }

  // Format milliseconds-since-start as "M:SS" for tell timestamps.
  _stamp() {
    const elapsed = Math.max(performance.now() - this.state.perfStartMs, 0);
    const totalSec = Math.floor(elapsed / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // Build a tell object, honoring the per-type cooldown. Returns the tell, or null if
  // we're still within the cooldown window for this type.
  _makeTell(type, severity, extra = {}) {
    const now = performance.now();
    const last = this.state.lastEmitted[type] || 0;
    if (now - last < TELL_COOLDOWN_MS) return null;
    this.state.lastEmitted[type] = now;

    return {
      id: "t_" + Math.round(now) + "_" + Math.random().toString(36).slice(2, 6),
      timestamp: this._stamp(),
      atMs: now,
      type,
      severity: clamp01(severity),
      context: this.currentContext,
      ...extra,
    };
  }

  /**
   * Process one frame of fused metrics. Returns an array of NEW tells (often empty).
   * @param {Object} frame - { face, voice, pose, hand }
   */
  processFrame(frame) {
    if (!this.baseline) return [];
    const tells = [];
    const now = performance.now();
    const { face, voice, pose, hand } = frame;

    if (face && face.facePresent) {
      this._checkGaze(face, now, tells);
      this._checkBlink(face, now, tells);
    }
    if (voice && voice.isSpeaking && voice.pitch > 0) {
      this._checkPitch(voice, tells);
    }
    if (pose && pose.posePresent) {
      this._checkPosture(pose, now, tells);
      this._checkFidget(pose, now, tells);
    }
    if (hand && hand.handsPresent) {
      this._checkClench(hand, tells);
    }

    return tells.filter(Boolean);
  }

  // --- Gaze: flag only when the user looks away from THEIR center for >= 0.3s ---
  _checkGaze(face, now, tells) {
    const dx = Math.abs(face.gazeX - this.baseline.gazeXMean);
    const dy = Math.abs(face.gazeY - this.baseline.gazeYMean);
    const away = dx > GAZE_AWAY_DELTA || dy > GAZE_AWAY_DELTA * 1.2;

    if (away) {
      if (this.state.gazeAwayStart === null) {
        this.state.gazeAwayStart = now; // start the timer
      } else if (now - this.state.gazeAwayStart >= GAZE_MIN_AWAY_MS && !this.state.gazeFlagged) {
        // Sustained long enough — this is a real gaze drop.
        const durationSec = (now - this.state.gazeAwayStart) / 1000;
        const magnitude = Math.max(dx, dy);
        // Severity grows with both how far and how long they looked away.
        const severity = clamp01(0.5 + magnitude * 2 + durationSec * 0.1);
        const tell = this._makeTell("gaze_drop", severity, {
          duration: Number(durationSec.toFixed(1)),
        });
        if (tell) tells.push(tell);
        this.state.gazeFlagged = true;
      }
    } else {
      // Eyes returned to center — reset.
      this.state.gazeAwayStart = null;
      this.state.gazeFlagged = false;
    }
  }

  // --- Blink: flag when blink RATE stays above ~2× baseline for > 2s ---
  _checkBlink(face, now, tells) {
    // Detect an individual blink (openness dipping below the personal threshold).
    if (face.eyeOpenness < this.baseline.blinkThreshold && !this.state.eyeClosed) {
      this.state.eyeClosed = true;
      this.state.blinkTimes.push(now);
    } else if (face.eyeOpenness > this.baseline.blinkThreshold * 1.3 && this.state.eyeClosed) {
      this.state.eyeClosed = false;
    }

    // Drop blink events older than the rolling window.
    this.state.blinkTimes = this.state.blinkTimes.filter((t) => now - t <= BLINK_WINDOW_MS);

    // Current blink rate, extrapolated to per-minute.
    const ratePerMin = (this.state.blinkTimes.length / BLINK_WINDOW_MS) * 60000;
    const baselineRate = Math.max(this.baseline.blinkRatePerMin, 6); // floor so silence isn't 0
    const elevated = ratePerMin > baselineRate * 2;

    if (elevated) {
      if (this.state.blinkElevatedStart === null) {
        this.state.blinkElevatedStart = now;
      } else if (now - this.state.blinkElevatedStart >= BLINK_SUSTAIN_MS) {
        const severity = clamp01(0.4 + (ratePerMin / baselineRate) * 0.15);
        const tell = this._makeTell("blink_burst", severity);
        if (tell) tells.push(tell);
        this.state.blinkElevatedStart = now; // restart so cooldown governs repeats
      }
    } else {
      this.state.blinkElevatedStart = null;
    }
  }

  // --- Pitch: only when speaking; flag a rise well above baseline ---
  _checkPitch(voice, tells) {
    const { pitchMean, pitchStd } = this.baseline;
    if (pitchMean <= 0) return; // no voice baseline captured

    const rise = voice.pitch - pitchMean;
    if (rise > PITCH_RISE_STD * pitchStd) {
      const percentAbove = Math.round((rise / pitchMean) * 100);
      // Ignore implausible jumps (octave errors from the pitch detector).
      if (percentAbove > 80) return;
      const severity = clamp01(0.45 + percentAbove / 60);
      const tell = this._makeTell("pitch_rise", severity, {
        percentAboveBaseline: percentAbove,
      });
      if (tell) tells.push(tell);
    }
  }

  // --- Posture: lean-back, arms crossed, hand to face — each must sustain > 1s ---
  _checkPosture(pose, now, tells) {
    // Lean back (shoulders shrink because the user moved away from the camera).
    const leaning =
      this.baseline.shoulderWidthMean > 0 &&
      pose.shoulderWidth < this.baseline.shoulderWidthMean * LEAN_BACK_SHRINK;
    this._sustainedFlag("lean_back", leaning, now, 0.6, tells);

    // Arms crossed.
    this._sustainedFlag("arms_crossed", pose.armsCrossed, now, 0.65, tells);

    // Hand to face.
    this._sustainedFlag("hand_to_face", pose.handToFace, now, 0.55, tells);
  }

  // Generic "must hold for POSTURE_SUSTAIN_MS" helper used by the posture checks.
  _sustainedFlag(type, conditionTrue, now, severity, tells) {
    const startKey = type + "Start";
    if (conditionTrue) {
      if (this.state.posture[startKey] == null) {
        this.state.posture[startKey] = now;
      } else if (now - this.state.posture[startKey] >= POSTURE_SUSTAIN_MS) {
        const tell = this._makeTell(type, severity);
        if (tell) tells.push(tell);
        // keep the start time so it can re-fire after cooldown if still held
      }
    } else {
      this.state.posture[startKey] = null;
    }
  }

  // --- Fidget: accumulate wrist motion over a short window ---
  _checkFidget(pose, now, tells) {
    const prev = this.state.lastWrist;
    if (prev && pose.wristLeft && pose.wristRight) {
      const moved =
        pointDist(prev.left, pose.wristLeft) + pointDist(prev.right, pose.wristRight);
      this.state.fidgetSamples.push({ t: now, moved });
    }
    this.state.lastWrist = { left: pose.wristLeft, right: pose.wristRight };

    // Sum movement within the window.
    this.state.fidgetSamples = this.state.fidgetSamples.filter(
      (s) => now - s.t <= FIDGET_WINDOW_MS
    );
    const totalMotion = this.state.fidgetSamples.reduce((sum, s) => sum + s.moved, 0);

    if (totalMotion > FIDGET_MOVE_THRESHOLD) {
      const severity = clamp01(0.4 + totalMotion * 0.1);
      const tell = this._makeTell("fidget", severity);
      if (tell) tells.push(tell);
    }
  }

  // --- Clench: fingertips curled much tighter than baseline ---
  _checkClench(hand, tells) {
    if (hand.clenchScore > this.baseline.clenchMean + 0.35 && hand.clenchScore > 0.6) {
      const severity = clamp01(0.4 + (hand.clenchScore - this.baseline.clenchMean));
      const tell = this._makeTell("fidget", severity, { sub: "clench" });
      if (tell) tells.push(tell);
    }
  }

  /**
   * Scan a chunk of finalized transcript for filler words and hedging language.
   * Returns an array of tells (filler_burst and/or hedging).
   */
  processTranscript(text) {
    if (!text) return [];
    const lower = " " + text.toLowerCase() + " ";
    const tells = [];

    // Filler words — count how many appear, flag a burst.
    const foundFillers = [];
    for (const word of FILLER_WORDS) {
      // Whole-word-ish match using spaces so "like" doesn't match "likely".
      if (lower.includes(" " + word + " ")) foundFillers.push(word);
    }
    if (foundFillers.length > 0) {
      const severity = clamp01(0.4 + foundFillers.length * 0.15);
      const tell = this._makeTell("filler_burst", severity, { words: foundFillers });
      if (tell) tells.push(tell);
    }

    // Hedging phrases — softening language that signals low conviction.
    const foundHedges = [];
    for (const phrase of HEDGING_PHRASES) {
      if (lower.includes(" " + phrase + " ") || lower.includes(" " + phrase + ",")) {
        foundHedges.push(phrase);
      }
    }
    if (foundHedges.length > 0) {
      const severity = clamp01(0.45 + foundHedges.length * 0.15);
      const tell = this._makeTell("hedging", severity, { words: foundHedges });
      if (tell) tells.push(tell);
    }

    return tells.filter(Boolean);
  }
}

// Fresh per-session state object (so a "Try Again" starts clean).
function freshSessionState() {
  return {
    perfStartMs: performance.now(),
    lastEmitted: {}, // type -> last emit time (cooldown)
    // gaze
    gazeAwayStart: null,
    gazeFlagged: false,
    // blink
    eyeClosed: false,
    blinkTimes: [],
    blinkElevatedStart: null,
    // posture
    posture: {},
    // fidget
    fidgetSamples: [],
    lastWrist: null,
  };
}

// ── tiny math helpers ─────────────────────────────────────────────────────────
function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
}

function std(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  let sumSq = 0;
  for (const v of arr) sumSq += (v - m) * (v - m);
  return Math.sqrt(sumSq / (arr.length - 1));
}

function pointDist(a, b) {
  if (!a || !b) return 0;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
