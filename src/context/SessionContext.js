"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SessionContext.js
//
// One React Context that carries the ACTIVE (in-progress) session across the pages of a
// single run: setup → calibration → live session → debrief. Because the provider lives in
// the root layout and we navigate with Next.js client-side routing, this state survives
// moving between those pages without a full reload.
//
// What it holds:
//   config       — the user's setup form (scenario, context, fear, difficulty)
//   persona      — the AI-generated opponent ("scouting report")
//   baseline     — the calibration baseline (set during the calibration step)
//   transcript   — array of { role, text, timestamp } messages
//   tells        — array of detected tell objects (the full session log)
//   result       — the debrief result once computed (score, coachNotes, etc.)
//
// Finished sessions are persisted separately to localStorage via lib/storage.js.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useState, useCallback, useMemo } from "react";

const SessionContext = createContext(null);

// A fresh, empty session shape.
function emptySession() {
  return {
    config: null, // { scenarioType, context, fear, difficulty }
    persona: null, // { name, role, personality, priorities[], pressurePoints[], openingLine }
    baseline: null, // calibration baseline object (see signalProcessor)
    transcript: [], // [{ role: "user"|"opponent", text, timestamp }]
    tells: [], // [{ id, timestamp, type, severity, context, ... }]
    startedAt: null, // epoch ms when the live session began
    result: null, // debrief result
  };
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(emptySession);

  // Start a brand new session from the setup form.
  const startNewSession = useCallback((config) => {
    setSession({ ...emptySession(), config });
  }, []);

  // Reset everything (used by "Try Again" to reuse the same scenario).
  const resetKeepConfig = useCallback(() => {
    setSession((prev) => ({
      ...emptySession(),
      config: prev.config,
      persona: prev.persona, // keep the persona so "Try Again" faces the same opponent
    }));
  }, []);

  const setPersona = useCallback((persona) => {
    setSession((prev) => ({ ...prev, persona }));
  }, []);

  const setBaseline = useCallback((baseline) => {
    setSession((prev) => ({ ...prev, baseline }));
  }, []);

  const markStarted = useCallback(() => {
    setSession((prev) => ({ ...prev, startedAt: Date.now() }));
  }, []);

  // Append a message to the transcript.
  const addMessage = useCallback((message) => {
    setSession((prev) => ({
      ...prev,
      transcript: [...prev.transcript, message],
    }));
  }, []);

  // Append one or more tells to the session log.
  const addTells = useCallback((newTells) => {
    if (!newTells || newTells.length === 0) return;
    setSession((prev) => ({ ...prev, tells: [...prev.tells, ...newTells] }));
  }, []);

  const setResult = useCallback((result) => {
    setSession((prev) => ({ ...prev, result }));
  }, []);

  const value = useMemo(
    () => ({
      session,
      startNewSession,
      resetKeepConfig,
      setPersona,
      setBaseline,
      markStarted,
      addMessage,
      addTells,
      setResult,
    }),
    [
      session,
      startNewSession,
      resetKeepConfig,
      setPersona,
      setBaseline,
      markStarted,
      addMessage,
      addTells,
      setResult,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// Convenience hook so components do `const { session, ... } = useSession()`.
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside a <SessionProvider>");
  }
  return ctx;
}
