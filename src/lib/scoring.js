// ─────────────────────────────────────────────────────────────────────────────
// scoring.js
//
// A simple, transparent local fallback for the 1-10 confidence score. The debrief API
// asks Claude for a score too, but we compute our own here so the app still produces a
// number even when there is no API key, and so we have a deterministic cross-check.
//
// The logic is intentionally explicit (no clever math): more tells and higher-severity
// tells lower the score.
// ─────────────────────────────────────────────────────────────────────────────

import { TELL_TYPES, TELL_CATEGORIES } from "./biometrics/tellTypes";

/**
 * Compute a 1-10 confidence score from the detected tells and the session length.
 *
 * @param {Array}  tells           - array of tell objects (each has type + severity).
 * @param {number} sessionSeconds  - how long the session lasted, in seconds.
 * @returns {number} integer 1..10 (10 = very composed, 1 = very rattled).
 */
export function computeLocalScore(tells, sessionSeconds) {
  // Start from a perfect 10 and subtract penalty points.
  let score = 10;

  if (!tells || tells.length === 0) {
    return 9; // No tells is great, but we leave a little room — nobody is perfect.
  }

  // Sum up severity-weighted penalties. High-severity tells hurt more than minor ones.
  let penalty = 0;
  for (const tell of tells) {
    // Each tell costs between 0 and ~0.8 points depending on severity.
    penalty += tell.severity * 0.8;
  }

  // Normalize by session length so a 10-minute session isn't punished vs a 2-minute one.
  // We express tells "per minute" so the rate matters more than the raw count.
  const minutes = Math.max(sessionSeconds / 60, 0.5);
  const tellsPerMinute = tells.length / minutes;

  // Rate penalty: a few tells per minute is normal; lots is a problem.
  const ratePenalty = Math.min(tellsPerMinute * 0.4, 4);

  score = score - Math.min(penalty, 5) - ratePenalty;

  // Clamp to 1..10 and round to a whole number.
  score = Math.max(1, Math.min(10, score));
  return Math.round(score);
}

/**
 * Aggregate tells into the per-category counts used by the debrief summary cards.
 *
 * @param {Array} tells
 * @returns {Object} counts keyed by category, plus a flat byType map.
 */
export function summarizeTells(tells) {
  const byCategory = {
    [TELL_CATEGORIES.GAZE]: 0,
    [TELL_CATEGORIES.VOCAL]: 0,
    [TELL_CATEGORIES.FILLER]: 0,
    [TELL_CATEGORIES.POSTURAL]: 0,
  };
  const byType = {};

  for (const tell of tells || []) {
    const def = TELL_TYPES[tell.type];
    const category = def ? def.category : TELL_CATEGORIES.POSTURAL;
    byCategory[category] = (byCategory[category] || 0) + 1;
    byType[tell.type] = (byType[tell.type] || 0) + 1;
  }

  return { byCategory, byType, total: (tells || []).length };
}
