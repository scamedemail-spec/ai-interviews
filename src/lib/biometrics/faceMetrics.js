"use client";

// ─────────────────────────────────────────────────────────────────────────────
// faceMetrics.js
//
// Turns the 468(+iris) face landmarks from MediaPipe FaceLandmarker into a few simple,
// meaningful numbers per frame. We deliberately compute RELATIVE values (ratios) so they
// don't depend on how big the face is in the frame or where the user sits.
//
// Output of extractFaceMetrics(result):
//   {
//     facePresent: boolean,
//     gazeX: 0..1  (0.5 = centered horizontally; <0.4 or >0.6 = looking away),
//     gazeY: 0..1  (0.5 = centered vertically),
//     eyeOpenness: ~0..0.4 (eye aspect ratio; small = closed/blinking),
//     browRaise: normalized eyebrow-to-eye distance (bigger = raised brows),
//     mouthOpen: normalized lip gap,
//   }
//
// The signal processor compares these against the calibration baseline to decide whether
// something is a real "tell" (e.g. gaze drifted far from the user's normal center).
// ─────────────────────────────────────────────────────────────────────────────

// Landmark indices we rely on (MediaPipe FaceLandmarker canonical mesh).
const IDX = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  leftIris: 468, // available because FaceLandmarker outputs iris points
  rightIris: 473,
  leftBrow: 65,
  rightBrow: 295,
  upperLip: 13,
  lowerLip: 14,
  chin: 152,
  forehead: 10,
};

// Euclidean distance between two {x,y} landmark points.
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * @param {Object} faceResult - the object returned by faceLandmarker.detectForVideo(...)
 * @returns metrics object (see top of file). facePresent=false if no face detected.
 */
export function extractFaceMetrics(faceResult) {
  const faces = faceResult && faceResult.faceLandmarks;
  if (!faces || faces.length === 0) {
    return { facePresent: false };
  }
  const lm = faces[0]; // we only track one face

  // Overall face height as a normalization unit (forehead → chin).
  const faceHeight = Math.max(dist(lm[IDX.forehead], lm[IDX.chin]), 0.0001);

  // --- Gaze: where is each iris inside its eye socket? ---
  // Horizontal: iris x relative to the two eye corners → 0 (inner) .. 1 (outer).
  const leftGazeX = horizontalRatio(
    lm[IDX.leftIris],
    lm[IDX.leftEyeInner],
    lm[IDX.leftEyeOuter]
  );
  const rightGazeX = horizontalRatio(
    lm[IDX.rightIris],
    lm[IDX.rightEyeInner],
    lm[IDX.rightEyeOuter]
  );
  const gazeX = (leftGazeX + rightGazeX) / 2;

  // Vertical: iris y relative to eye top/bottom.
  const leftGazeY = verticalRatio(lm[IDX.leftIris], lm[IDX.leftEyeTop], lm[IDX.leftEyeBottom]);
  const rightGazeY = verticalRatio(lm[IDX.rightIris], lm[IDX.rightEyeTop], lm[IDX.rightEyeBottom]);
  const gazeY = (leftGazeY + rightGazeY) / 2;

  // --- Eye openness (Eye Aspect Ratio): vertical eye opening / horizontal eye width ---
  const leftEar =
    dist(lm[IDX.leftEyeTop], lm[IDX.leftEyeBottom]) /
    Math.max(dist(lm[IDX.leftEyeOuter], lm[IDX.leftEyeInner]), 0.0001);
  const rightEar =
    dist(lm[IDX.rightEyeTop], lm[IDX.rightEyeBottom]) /
    Math.max(dist(lm[IDX.rightEyeOuter], lm[IDX.rightEyeInner]), 0.0001);
  const eyeOpenness = (leftEar + rightEar) / 2;

  // --- Eyebrow raise: brow-to-eye distance, normalized by face height ---
  const leftBrowRaise = dist(lm[IDX.leftBrow], lm[IDX.leftEyeTop]) / faceHeight;
  const rightBrowRaise = dist(lm[IDX.rightBrow], lm[IDX.rightEyeTop]) / faceHeight;
  const browRaise = (leftBrowRaise + rightBrowRaise) / 2;

  // --- Mouth open: lip gap normalized by face height ---
  const mouthOpen = dist(lm[IDX.upperLip], lm[IDX.lowerLip]) / faceHeight;

  return {
    facePresent: true,
    gazeX,
    gazeY,
    eyeOpenness,
    browRaise,
    mouthOpen,
  };
}

// How far along the inner→outer axis the iris sits (0 inner, ~0.5 center, 1 outer).
function horizontalRatio(iris, inner, outer) {
  const total = dist(inner, outer);
  if (total < 0.0001) return 0.5;
  return dist(iris, inner) / total;
}

// How far along the top→bottom axis the iris sits.
function verticalRatio(iris, top, bottom) {
  const total = dist(top, bottom);
  if (total < 0.0001) return 0.5;
  return dist(iris, top) / total;
}
