"use client";

// ─────────────────────────────────────────────────────────────────────────────
// voiceOutput.js
//
// Gives the AI opponent a SPOKEN voice using the browser's built-in speech synthesis
// (window.speechSynthesis). No external service and nothing leaves the device.
//
// The opponent's reply text may contain lightweight emotion tags that the model emits to
// shape delivery:
//
//   <anger>…</anger>       louder/faster, higher
//   <disbelief>…</disbelief>  a beat of pause, then higher
//   <emphasis>…</emphasis>    slower + higher, hit the words hard
//   <passion>…</passion>      faster + higher, energized
//
// We parse those tags, split the reply into segments, map each emotion to rate/pitch/pause
// parameters, and speak the segments back-to-back so the whole line sounds expressive.
//
// To make the opponent sound distinct from the user, EVERY segment is shifted: pitch ×0.9
// and rate ×0.8 (a slower, lower voice).
// ─────────────────────────────────────────────────────────────────────────────

// Emotion → audio parameters. These mirror the mapping the product owner specified.
// (The Web Speech API only exposes `rate` and `pitch`, plus we simulate `delay_before`
// with a real pause; there is no native "emphasis_level", so the slower/higher rate+pitch
// values already encode the strong emphasis.)
const EMOTION_PARAMS = {
  anger: { rate: 1.2, pitch: 1.1, delayBefore: 0 },
  disbelief: { rate: 1.0, pitch: 1.2, delayBefore: 0.2 },
  emphasis: { rate: 0.8, pitch: 1.15, delayBefore: 0 },
  passion: { rate: 1.15, pitch: 1.2, delayBefore: 0 },
};

// Neutral (untagged) speech.
const NEUTRAL = { rate: 1.0, pitch: 1.0, delayBefore: 0 };

// How much to shift the OPPONENT voice so it's clearly not the user.
const OPPONENT_PITCH_MULTIPLIER = 0.9;
const OPPONENT_RATE_MULTIPLIER = 0.8;

// Is speech synthesis available in this browser?
export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Remove all emotion tags so we can DISPLAY clean text (and store it in the transcript).
export function stripEmotionTags(text) {
  if (!text) return "";
  return text.replace(/<\/?(?:anger|disbelief|emphasis|passion)>/gi, "").trim();
}

/**
 * Split a reply into ordered segments, each carrying its emotion parameters.
 * Untagged runs become NEUTRAL segments. Returns [] for empty input.
 *
 * Example: "I hear you, <anger>but that's absurd.</anger>"
 *   → [ {text:"I hear you, ", ...NEUTRAL}, {text:"but that's absurd.", ...anger} ]
 */
export function parseEmotionSegments(text) {
  if (!text) return [];

  const segments = [];
  // Matches either an emotion tag with its inner text, or a run of untagged text.
  const tagRegex = /<(anger|disbelief|emphasis|passion)>([\s\S]*?)<\/\1>/gi;

  let lastIndex = 0;
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    // Any plain text before this tag is a neutral segment.
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain.trim()) segments.push({ text: plain, ...NEUTRAL });
    }
    const emotion = match[1].toLowerCase();
    const inner = match[2];
    if (inner.trim()) {
      segments.push({ text: inner, ...(EMOTION_PARAMS[emotion] || NEUTRAL) });
    }
    lastIndex = tagRegex.lastIndex;
  }

  // Trailing plain text after the last tag.
  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    if (plain.trim()) segments.push({ text: plain, ...NEUTRAL });
  }

  // No tags at all → the whole thing is one neutral segment.
  if (segments.length === 0 && text.trim()) {
    segments.push({ text, ...NEUTRAL });
  }
  return segments;
}

// Clamp helpers to the Web Speech API's valid ranges.
function clampPitch(p) {
  return Math.max(0, Math.min(2, p)); // spec: 0..2
}
function clampRate(r) {
  return Math.max(0.1, Math.min(10, r)); // spec: 0.1..10
}

export class OpponentVoice {
  constructor() {
    this.enabled = true;
    this.preferredVoice = null;
    this._speaking = false;
    // Picking a voice can be async (voices load lazily); grab one when ready.
    if (isSpeechSynthesisSupported()) {
      this._pickVoice();
      window.speechSynthesis.onvoiceschanged = () => this._pickVoice();
    }
  }

  _pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;
    // Prefer an English voice; fall back to the first available.
    this.preferredVoice =
      voices.find((v) => /en[-_]/i.test(v.lang)) || voices[0] || null;
  }

  get isSpeaking() {
    return this._speaking;
  }

  /**
   * Speak a (possibly tagged) opponent line. Segments play in order, with the opponent
   * pitch/rate shift applied and any per-emotion pause honored.
   *
   * @param {string} rawText
   * @param {Object} [handlers] - { onStart, onEnd }
   */
  speak(rawText, { onStart, onEnd } = {}) {
    if (!this.enabled || !isSpeechSynthesisSupported()) {
      if (onEnd) onEnd();
      return;
    }

    const segments = parseEmotionSegments(rawText);
    if (segments.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    // Stop anything currently queued so lines don't overlap.
    window.speechSynthesis.cancel();
    this._speaking = true;
    if (onStart) onStart();

    let index = 0;

    const speakNext = () => {
      if (index >= segments.length) {
        this._speaking = false;
        if (onEnd) onEnd();
        return;
      }
      const seg = segments[index];
      index += 1;

      const startThisSegment = () => {
        const utterance = new SpeechSynthesisUtterance(stripEmotionTags(seg.text));
        if (this.preferredVoice) utterance.voice = this.preferredVoice;
        // Apply the emotion params, then the opponent distinguishing shift.
        utterance.pitch = clampPitch(seg.pitch * OPPONENT_PITCH_MULTIPLIER);
        utterance.rate = clampRate(seg.rate * OPPONENT_RATE_MULTIPLIER);
        // When a segment finishes, move to the next one.
        utterance.onend = () => speakNext();
        // If synthesis errors on a segment, don't get stuck — continue.
        utterance.onerror = () => speakNext();
        window.speechSynthesis.speak(utterance);
      };

      // Honor delay_before as a real pause before the segment.
      if (seg.delayBefore > 0) {
        setTimeout(startThisSegment, seg.delayBefore * 1000);
      } else {
        startThisSegment();
      }
    };

    speakNext();
  }

  // Immediately stop speaking (used when the user ends the session or mutes).
  cancel() {
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
    this._speaking = false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.cancel();
  }
}
