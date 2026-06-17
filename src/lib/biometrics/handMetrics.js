"use client";

// ─────────────────────────────────────────────────────────────────────────────
// handMetrics.js
//
// Turns the 21 landmarks per hand from MediaPipe HandLandmarker into a couple of simple
// numbers about nervous hand behavior.
//
// Output of extractHandMetrics(result):
//   {
//     handsPresent: boolean,
//     clenchScore: 0..1 (1 = fingertips curled tight into the palm — a fist/clench),
//     fingertipY: average fingertip height, so the processor can detect tapping motion
//                 (rapid up/down) over successive frames.
//   }
// ─────────────────────────────────────────────────────────────────────────────

// HandLandmarker indices: wrist=0, fingertips = 4,8,12,16,20; the MCP knuckles = 5,9,13,17.
const TIPS = [8, 12, 16, 20]; // index, middle, ring, pinky tips (skip thumb tip 4)
const KNUCKLES = [5, 9, 13, 17];
const WRIST = 0;

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * @param {Object} handResult - returned by handLandmarker.detectForVideo(...)
 */
export function extractHandMetrics(handResult) {
  const hands = handResult && handResult.landmarks;
  if (!hands || hands.length === 0) {
    return { handsPresent: false };
  }

  // Average across however many hands are visible.
  let clenchSum = 0;
  let tipYSum = 0;
  let count = 0;

  for (const lm of hands) {
    // Hand size unit: wrist → middle knuckle. Normalizes for distance from camera.
    const handSize = Math.max(dist(lm[WRIST], lm[KNUCKLES[1]]), 0.0001);

    // Clench: how close fingertips are to their knuckles (curled = small distance).
    let curl = 0;
    for (let i = 0; i < TIPS.length; i++) {
      const tipToKnuckle = dist(lm[TIPS[i]], lm[KNUCKLES[i]]) / handSize;
      // tipToKnuckle ~0.2 when curled, ~1.0+ when extended. Map to a 0..1 "curl" score.
      curl += clampRange(1.2 - tipToKnuckle, 0, 1);
    }
    clenchSum += curl / TIPS.length;

    // Average fingertip height for tap detection.
    let tipY = 0;
    for (const t of TIPS) tipY += lm[t].y;
    tipYSum += tipY / TIPS.length;

    count++;
  }

  return {
    handsPresent: true,
    clenchScore: clenchSum / count,
    fingertipY: tipYSum / count,
  };
}

function clampRange(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
