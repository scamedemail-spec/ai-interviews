"use client";

// ─────────────────────────────────────────────────────────────────────────────
// humeEmotionClient.js
//
// Connects to Hume AI's real-time expression streaming API via WebSocket.
// Every time sendFrame() is called with a <video> element, it captures a low-res
// JPEG frame and sends it to Hume. Emotion scores arrive asynchronously via onEmotions.
//
// Usage:
//   const client = new HumeEmotionClient(apiKey);
//   client.onEmotions = (scores) => { /* { Doubt: 0.6, Concentration: 0.4, ... } */ };
//   client.onTell = (tell) => { /* standard tell object */ };
//   client.connect();
//   client.sendFrame(videoEl);
//   client.disconnect();
// ─────────────────────────────────────────────────────────────────────────────

// Emotion names we care about for tell generation (maps to tell types/labels).
const EMOTION_MAP = {
  "Doubt":          { type: "emotion_doubt",       label: "visible doubt" },
  "Discomfort":     { type: "emotion_discomfort",   label: "physical discomfort" },
  "Contempt":       { type: "emotion_contempt",     label: "contempt" },
  "Concentration":  { type: "emotion_concentration",label: "deep concentration" },
  "Distress":       { type: "emotion_distress",     label: "distress" },
  "Anxiety":        { type: "emotion_anxiety",      label: "anxiety" },
  "Confusion":      { type: "emotion_confusion",    label: "confusion" },
  "Embarrassment":  { type: "emotion_embarrassment",label: "embarrassment" },
  "Fear":           { type: "emotion_fear",         label: "fear" },
};

// Severity threshold — only emit tells for emotions above this score.
const TELL_THRESHOLD = 0.45;

export class HumeEmotionClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.onEmotions = () => {};
    this.onTell = () => {};
    this._canvas = null;
    this._ctx = null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const url = `wss://api.hume.ai/v0/stream/models?apikey=${encodeURIComponent(this.apiKey)}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        // Hume streams face predictions
        const preds = msg?.face?.predictions;
        if (!preds || preds.length === 0) return;

        const emotions = {};
        (preds[0].emotions || []).forEach(({ name, score }) => {
          emotions[name] = score;
        });
        this.onEmotions(emotions);
        this._emitTells(emotions);
      } catch (_) {}
    };

    this.ws.onerror = (e) => console.warn("[Hume] WS error", e);
    this.ws.onclose = () => {};
  }

  // Capture a frame from the video element and send to Hume.
  sendFrame(videoEl) {
    if (!videoEl || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (!this._canvas) {
      this._canvas = document.createElement("canvas");
      this._canvas.width = 160;
      this._canvas.height = 120;
      this._ctx = this._canvas.getContext("2d");
    }

    this._ctx.drawImage(videoEl, 0, 0, 160, 120);
    const imageData = this._canvas.toDataURL("image/jpeg", 0.55).split(",")[1];

    this.ws.send(JSON.stringify({
      models: { face: {} },
      data: imageData,
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _emitTells(emotions) {
    const now = new Date().toISOString();
    for (const [name, entry] of Object.entries(EMOTION_MAP)) {
      const score = emotions[name] || 0;
      if (score >= TELL_THRESHOLD) {
        this.onTell({
          timestamp: now,
          type: entry.type,
          context: `Hume detected ${entry.label} (score: ${score.toFixed(2)})`,
          severity: Math.min(score, 1),
          source: "hume",
        });
      }
    }
  }
}
