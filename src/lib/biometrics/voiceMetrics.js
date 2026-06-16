"use client";

// ─────────────────────────────────────────────────────────────────────────────
// voiceMetrics.js
//
// Real-time voice analysis using the browser's built-in Web Audio API. No audio ever
// leaves the device — we only read numbers (pitch, volume) off the live mic stream.
//
// What we measure each frame:
//   - pitch (Hz)      via autocorrelation of the raw waveform
//   - volume (0..1)   via RMS (root-mean-square) of the waveform
//   - isSpeaking      derived from volume crossing a small threshold
//
// Higher-level signals (uptalk, pace) are computed by the signal processor from the
// stream of these per-frame samples plus the transcript.
// ─────────────────────────────────────────────────────────────────────────────

export class VoiceMeter {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.sourceNode = null;
    this.buffer = null; // reused Float32Array for waveform samples
    this.running = false;
  }

  // Attach to a getUserMedia audio stream and start the audio graph.
  start(mediaStream) {
    // Safari prefixes the constructor; support both.
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx();

    this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    // 2048 samples gives us good frequency resolution for speech pitch (~80-400 Hz).
    this.analyser.fftSize = 2048;
    this.buffer = new Float32Array(this.analyser.fftSize);

    this.sourceNode.connect(this.analyser);
    // NOTE: we intentionally do NOT connect the analyser to the destination,
    // so the user doesn't hear their own mic echoed back.
    this.running = true;
  }

  // Read one frame. Returns { pitch, volume, isSpeaking, timeMs }.
  sample() {
    if (!this.running || !this.analyser) {
      return { pitch: 0, volume: 0, isSpeaking: false, timeMs: 0 };
    }

    this.analyser.getFloatTimeDomainData(this.buffer);

    const volume = computeRms(this.buffer);
    // Only bother computing pitch when there's enough signal — avoids garbage from silence.
    const isSpeaking = volume > 0.012;
    const pitch = isSpeaking
      ? autoCorrelatePitch(this.buffer, this.audioContext.sampleRate)
      : 0;

    return {
      pitch: pitch > 0 ? pitch : 0,
      volume,
      isSpeaking,
      timeMs: performance.now(),
    };
  }

  stop() {
    this.running = false;
    try {
      if (this.sourceNode) this.sourceNode.disconnect();
      if (this.analyser) this.analyser.disconnect();
      if (this.audioContext && this.audioContext.state !== "closed") {
        this.audioContext.close();
      }
    } catch (err) {
      // Closing an already-closed context can throw; safe to ignore.
    }
  }
}

// RMS = perceived loudness of the waveform window, 0..~1.
function computeRms(buffer) {
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  return Math.sqrt(sumSquares / buffer.length);
}

// Autocorrelation pitch detection. Returns frequency in Hz, or -1 if no clear pitch.
// This is a well-known, dependency-free approach: we find the lag at which the signal
// best repeats itself; that lag corresponds to the fundamental period.
function autoCorrelatePitch(buffer, sampleRate) {
  const size = buffer.length;

  // Quick energy check — bail on near-silence.
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  // Search lags corresponding to human voice range ~ 70 Hz .. 400 Hz.
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.floor(sampleRate / 70);

  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < size - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    correlation = correlation / (size - lag);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  // Require a reasonably strong periodicity to trust the result.
  if (bestLag > 0 && bestCorrelation > 0.0015) {
    return sampleRate / bestLag;
  }
  return -1;
}
