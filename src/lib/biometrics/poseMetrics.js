"use client";

// ─────────────────────────────────────────────────────────────────────────────
// poseMetrics.js
//
// Turns the 33 body landmarks from MediaPipe PoseLandmarker into simple posture numbers.
//
// Output of extractPoseMetrics(result):
//   {
//     posePresent: boolean,
//     shoulderWidth: distance between shoulders (proxy for distance from camera —
//                    leaning BACK makes you smaller, so this shrinks),
//     armsCrossed: boolean (wrists pulled across the torso toward opposite sides),
//     handToFace: boolean (a wrist is up near the head),
//     wristLeft / wristRight: {x,y} so the processor can measure fidget motion over time,
//   }
//
// As with the face, we keep values relative (normalized by shoulder width) so they don't
// depend on camera distance.
// ─────────────────────────────────────────────────────────────────────────────

// MediaPipe Pose landmark indices.
const IDX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
};

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * @param {Object} poseResult - returned by poseLandmarker.detectForVideo(...)
 */
export function extractPoseMetrics(poseResult) {
  const poses = poseResult && poseResult.landmarks;
  if (!poses || poses.length === 0) {
    return { posePresent: false };
  }
  const lm = poses[0];

  const leftShoulder = lm[IDX.leftShoulder];
  const rightShoulder = lm[IDX.rightShoulder];
  const leftWrist = lm[IDX.leftWrist];
  const rightWrist = lm[IDX.rightWrist];
  const nose = lm[IDX.nose];

  const shoulderWidth = Math.max(dist(leftShoulder, rightShoulder), 0.0001);

  // Center x of the torso (between the shoulders).
  const torsoCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;

  // --- Arms crossed heuristic ---
  // When arms are crossed, the LEFT wrist ends up on the RIGHT side of the torso center
  // and vice versa, and both wrists sit roughly at chest height (just below shoulders).
  // (Remember the camera image is mirrored, but the heuristic is symmetric so it holds.)
  const wristsAtChest =
    leftWrist.y > shoulderY &&
    rightWrist.y > shoulderY &&
    leftWrist.y < shoulderY + shoulderWidth * 1.2 &&
    rightWrist.y < shoulderY + shoulderWidth * 1.2;
  const wristsCrossedOver =
    leftWrist.x > torsoCenterX - shoulderWidth * 0.1 &&
    rightWrist.x < torsoCenterX + shoulderWidth * 0.1;
  const armsCrossed = wristsAtChest && wristsCrossedOver;

  // --- Hand to face: either wrist is up near the head (above shoulders, near nose x) ---
  const handToFace =
    (leftWrist.y < shoulderY && dist(leftWrist, nose) < shoulderWidth * 0.9) ||
    (rightWrist.y < shoulderY && dist(rightWrist, nose) < shoulderWidth * 0.9);

  return {
    posePresent: true,
    shoulderWidth,
    armsCrossed,
    handToFace,
    // Normalize wrist positions by shoulder width so fidget motion is scale-independent.
    wristLeft: { x: leftWrist.x / shoulderWidth, y: leftWrist.y / shoulderWidth },
    wristRight: { x: rightWrist.x / shoulderWidth, y: rightWrist.y / shoulderWidth },
  };
}
