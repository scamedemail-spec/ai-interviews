"use client";

// ─────────────────────────────────────────────────────────────────────────────
// deepgramTranscriber.js
//
// Real-time speech-to-text via Deepgram's streaming WebSocket API.
// Replaces / supplements the browser's built-in Web Speech API with a much more
// accurate transcription engine that includes word-level timestamps and smart
// filler-word detection.
//
// Usage:
//   const t = new DeepgramTranscriber({ token, onInterim, onFinal, onError });
//   t.start(mediaStream);   // pass the mic MediaStream
//   t.stop();
// ─────────────────────────────────────────────────────────────────────────────

// Words / phrases we flag as filler tells.
const FILLER_WORDS = new Set([
  "um", "uh", "er", "ah", "like", "you know", "i mean", "basically",
  "literally", "actually", "honestly", "sort of", "kind of", "right",
  "so", "well", "anyway",
]);

const HEDGING_PHRASES = [
  "i think maybe", "i guess", "i'm not sure", "i suppose", "kind of like",
  "sort of like", "more or less", "something like that",
];

function detectFillers(transcript) {
  const words = transcript.toLowerCase().split(/\s+/);
  const found = words.filter(w => FILLER_WORDS.has(w));

  const lower = transcript.toLowerCase();
  const hedges = HEDGING_PHRASES.filter(p => lower.includes(p));

  const tells = [];

  if (found.length > 0) {
    tells.push({
      timestamp: new Date().toISOString(),
      type: "filler_words",
      context: `Said: ${found.slice(0, 3).join(", ")}`,
      severity: Math.min(0.3 + found.length * 0.12, 0.9),
      words: found,
      source: "deepgram",
    });
  }

  if (hedges.length > 0) {
    tells.push({
      timestamp: new Date().toISOString(),
      type: "hedging_language",
      context: `Used hedging: "${hedges[0]}"`,
      severity: Math.min(0.4 + hedges.length * 0.15, 0.9),
      words: hedges,
      source: "deepgram",
    });
  }

  return tells;
}

export class DeepgramTranscriber {
  constructor({ token, onInterim = () => {}, onFinal = () => {}, onTell = () => {}, onError = () => {} }) {
    this.token = token;
    this.onInterim = onInterim;
    this.onFinal = onFinal;
    this.onTell = onTell;
    this.onError = onError;
    this.ws = null;
    this.processor = null;
    this.audioContext = null;
    this._running = false;
  }

  async start(stream) {
    this._running = true;
    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", "nova-3");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("utterance_end_ms", "1000");
    url.searchParams.set("vad_events", "true");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("channels", "1");

    this.ws = new WebSocket(url.toString(), ["token", this.token]);

    this.ws.onopen = () => this._setupAudioPipeline(stream);
    this.ws.onclose = () => this._teardownAudio();
    this.ws.onerror = (e) => this.onError("Deepgram WS error: " + e.type);

    this.ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const transcript = msg?.channel?.alternatives?.[0]?.transcript || "";
        if (!transcript) return;

        if (msg.is_final) {
          const tells = detectFillers(transcript);
          tells.forEach(t => this.onTell(t));
          this.onFinal(transcript);
        } else {
          this.onInterim(transcript);
        }
      } catch (_) {}
    };
  }

  _setupAudioPipeline(stream) {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const f32 = e.inputBuffer.getChannelData(0);
        // Convert Float32 PCM to Int16
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
        }
        this.ws.send(i16.buffer);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (e) {
      this.onError("Audio pipeline error: " + e.message);
    }
  }

  _teardownAudio() {
    if (this.processor) {
      try { this.processor.disconnect(); } catch (_) {}
      this.processor = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }
  }

  stop() {
    this._running = false;
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "CloseStream" }));
      }
      this.ws.close();
      this.ws = null;
    }
    this._teardownAudio();
  }
}

export function isDeepgramSupported() {
  return typeof WebSocket !== "undefined" && typeof AudioContext !== "undefined";
}
