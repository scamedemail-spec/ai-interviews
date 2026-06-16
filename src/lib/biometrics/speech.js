"use client";

// ─────────────────────────────────────────────────────────────────────────────
// speech.js
//
// A thin wrapper around the browser's Web Speech API (SpeechRecognition) for live,
// on-device transcription. This is how the user "speaks" their turns.
//
// IMPORTANT: Web Speech recognition is only supported in Chromium browsers (Chrome, Edge).
// We expose `isSpeechSupported()` so the UI can fall back to typing elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

// Is the SpeechRecognition API available in this browser?
export function isSpeechSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class SpeechTranscriber {
  /**
   * @param {Object} handlers
   * @param {(interimText: string) => void}            handlers.onInterim - partial words as you speak
   * @param {(finalText: string, atMs: number) => void} handlers.onFinal  - a finalized phrase
   * @param {(error: string) => void}                   handlers.onError
   */
  constructor({ onInterim, onFinal, onError } = {}) {
    this.onInterim = onInterim || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onError = onError || (() => {});
    this.recognition = null;
    this.shouldRun = false;
  }

  start() {
    if (!isSpeechSupported()) {
      this.onError("Speech recognition is not supported in this browser. Please type instead.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true; // keep listening across pauses
    recognition.interimResults = true; // stream partial words for the live caption
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      // Walk only the new results since last callback.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          this.onFinal(text.trim(), performance.now());
        } else {
          interim += text;
        }
      }
      if (interim) this.onInterim(interim);
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are normal/expected; don't alarm the user.
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.onError("Speech error: " + event.error);
    };

    // The API stops itself after long silences; restart if we still want to listen.
    recognition.onend = () => {
      if (this.shouldRun) {
        try {
          recognition.start();
        } catch (err) {
          // Starting too quickly can throw; ignore and let the next tick retry.
        }
      }
    };

    this.recognition = recognition;
    this.shouldRun = true;
    try {
      recognition.start();
    } catch (err) {
      this.onError("Could not start speech recognition.");
    }
  }

  stop() {
    this.shouldRun = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        // ignore
      }
    }
  }
}
