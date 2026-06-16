"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ConversationPanel — the main conversation area of the live session.
//
// Shows the running dialogue (opponent messages + the user's own turns), a typing
// indicator while the opponent "thinks," and the input row. Voice is the primary input:
// finalized speech is appended to the draft; the user can also type. Pressing Send (or
// Enter) commits the turn.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import Spinner from "@/components/ui/Spinner";

export default function ConversationPanel({
  transcript, // [{ role, text, timestamp }]
  opponentName,
  opponentThinking, // boolean — show typing indicator
  draft, // current input text (controlled)
  setDraft,
  interim, // live partial speech text (ghost)
  onSend,
  listening, // boolean — mic on?
  onToggleMic,
  speechSupported,
  disabled,
}) {
  const scrollRef = useRef(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, opponentThinking, interim]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 py-2">
        {transcript.map((m, i) => (
          <Message key={i} message={m} opponentName={opponentName} />
        ))}

        {opponentThinking && (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <span className="font-semibold text-ink-200">{opponentName}</span>
            <span className="flex gap-1">
              <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
            </span>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="mt-3 border-t border-ink-800 pt-3">
        {/* Live partial speech preview */}
        {interim && (
          <div className="mb-2 text-xs italic text-ink-400">…{interim}</div>
        )}

        <div className="flex items-end gap-2">
          {speechSupported && (
            <button
              type="button"
              onClick={onToggleMic}
              title={listening ? "Mute mic" : "Speak"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                listening
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-ink-700 bg-ink-900 text-ink-400 hover:text-ink-200"
              }`}
            >
              {/* simple mic glyph */}
              <MicIcon active={listening} />
            </button>
          )}

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
            placeholder={
              speechSupported
                ? "Speak, or type your response…"
                : "Type your response (voice not supported in this browser)…"
            }
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-ink-200 placeholder:text-ink-600 outline-none focus:border-accent"
          />

          <button
            type="button"
            onClick={onSend}
            disabled={disabled || (!draft.trim())}
            className="h-11 shrink-0 rounded-lg bg-accent px-5 text-sm font-semibold text-ink-950 hover:bg-accent-soft disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// One chat bubble. Opponent on the left, user on the right.
function Message({ message, opponentName }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "text-right" : "text-left"}`}>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">
          {isUser ? "You" : opponentName} · {message.timestamp}
        </div>
        <div
          className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-accent/15 text-ink-200 rounded-br-sm"
              : "border border-ink-700 bg-ink-800 text-ink-200 rounded-bl-sm"
          }`}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = "0ms" }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-ink-400 animate-pulseDot"
      style={{ animationDelay: delay }}
    />
  );
}

function MicIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      {active && <circle cx="20" cy="4" r="2" fill="currentColor" stroke="none" />}
    </svg>
  );
}
