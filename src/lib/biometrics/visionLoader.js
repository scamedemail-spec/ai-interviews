"use client";

// ─────────────────────────────────────────────────────────────────────────────
// visionLoader.js
//
// Loads Google MediaPipe's "tasks-vision" models and runs them ENTIRELY in the browser.
// No frame ever leaves the device. We load three detectors:
//   - FaceLandmarker  (468 face points)  → gaze, blink, eyebrows, jaw, mouth
//   - PoseLandmarker  (33 body points)   → lean, crossed arms, hand-to-face, fidget
//   - HandLandmarker  (21 points / hand) → tapping, clenching
//
// The model files (.task) and the WASM runtime are fetched from Google's public CDN the
// first time, then cached by the browser. This keeps our repo small and needs no build step.
// ─────────────────────────────────────────────────────────────────────────────

import {
  FilesetResolver,
  FaceLandmarker,
  PoseLandmarker,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

// CDN locations. Pinned to a version that matches our package.json dependency.
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * Create all three landmarkers. Returns { faceLandmarker, poseLandmarker, handLandmarker }.
 * This can take a few seconds the first time while models download.
 *
 * @param {(msg: string) => void} [onProgress] - optional status callback for the UI.
 */
export async function loadVisionModels(onProgress = () => {}) {
  onProgress("Loading vision runtime…");
  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE);

  onProgress("Loading face model…");
  const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    // We don't need the blendshapes/matrix extras; landmarks are enough and faster.
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });

  onProgress("Loading pose model…");
  const poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  onProgress("Loading hand model…");
  const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 2,
  });

  onProgress("Models ready.");
  return { faceLandmarker, poseLandmarker, handLandmarker };
}
