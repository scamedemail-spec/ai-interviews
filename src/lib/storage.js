// ─────────────────────────────────────────────────────────────────────────────
// storage.js
//
// Saves finished sessions to the browser's localStorage. We deliberately keep history
// on-device (no database, no login) — it's the simplest possible persistence and it fits
// the privacy story: your practice never leaves your machine.
//
// A "saved session" record looks like:
//   {
//     id, createdAt, scenarioType, difficulty, context, fear,
//     persona, transcript, tells, durationSeconds,
//     score, achievedGoal, summary, coachNotes
//   }
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "tell.sessions.v1";

// Guard so this module is safe to import on the server (where localStorage is undefined).
function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

/**
 * Return all saved sessions, newest first. Returns [] if none / unavailable.
 */
export function getAllSessions() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Newest first.
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn("Could not read saved sessions:", err);
    return [];
  }
}

/**
 * Look up a single session by id.
 */
export function getSessionById(id) {
  return getAllSessions().find((s) => s.id === id) || null;
}

/**
 * Save a new session. Generates an id and timestamp if not provided.
 * Returns the saved record (including its id).
 */
export function saveSession(session) {
  if (!hasStorage()) return session;

  const record = {
    id: session.id || makeId(),
    createdAt: session.createdAt || Date.now(),
    ...session,
  };

  const all = getAllSessions();
  // Replace if an id already exists, otherwise prepend.
  const filtered = all.filter((s) => s.id !== record.id);
  filtered.unshift(record);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Could not save session:", err);
  }
  return record;
}

/**
 * Delete one session by id.
 */
export function deleteSession(id) {
  if (!hasStorage()) return;
  const remaining = getAllSessions().filter((s) => s.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

// A short, readable unique id. Not cryptographic — just needs to be unique on one device.
function makeId() {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}
