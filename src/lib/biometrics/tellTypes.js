// ─────────────────────────────────────────────────────────────────────────────
// tellTypes.js
//
// SINGLE SOURCE OF TRUTH for every kind of "tell" the app can detect.
//
// A "tell" is a moment where the user's body/voice gave something away — a broken
// gaze, a pitch spike, a filler word, a defensive posture shift. Every other part of
// the app (the signal processor that creates tells, the live session that sends them to
// the AI, and the debrief timeline that draws them) imports its definitions from here so
// nothing ever drifts out of sync.
// ─────────────────────────────────────────────────────────────────────────────

// The four visual categories. These map directly to the debrief timeline colors.
// (The actual hex values live in tailwind.config.js under colors.tell.*)
export const TELL_CATEGORIES = {
  GAZE: "gaze", // red — eye contact / gaze breaks
  VOCAL: "vocal", // orange — pitch / vocal tells
  FILLER: "filler", // yellow — filler words & hedging language
  POSTURAL: "postural", // blue — posture / physical tells
};

// Tailwind color class fragments per category, so components don't re-derive them.
export const CATEGORY_COLORS = {
  [TELL_CATEGORIES.GAZE]: {
    hex: "#ff4d4d",
    bg: "bg-tell-gaze",
    text: "text-tell-gaze",
    border: "border-tell-gaze",
    label: "Gaze / eye contact",
  },
  [TELL_CATEGORIES.VOCAL]: {
    hex: "#ff9f1c",
    bg: "bg-tell-vocal",
    text: "text-tell-vocal",
    border: "border-tell-vocal",
    label: "Voice / pitch",
  },
  [TELL_CATEGORIES.FILLER]: {
    hex: "#ffe14d",
    bg: "bg-tell-filler",
    text: "text-tell-filler",
    border: "border-tell-filler",
    label: "Filler / hedging",
  },
  [TELL_CATEGORIES.POSTURAL]: {
    hex: "#4d9dff",
    bg: "bg-tell-postural",
    text: "text-tell-postural",
    border: "border-tell-postural",
    label: "Posture / physical",
  },
};

// Every specific tell type the system understands.
// `category` controls its color; `label` is shown in the UI; `verb` is a short
// human phrase used when summarizing ("you broke eye contact").
export const TELL_TYPES = {
  gaze_drop: {
    category: TELL_CATEGORIES.GAZE,
    label: "Gaze drop",
    verb: "broke eye contact",
  },
  gaze_dart: {
    category: TELL_CATEGORIES.GAZE,
    label: "Eyes darting",
    verb: "let your eyes dart",
  },
  blink_burst: {
    category: TELL_CATEGORIES.GAZE,
    label: "Rapid blinking",
    verb: "blinked rapidly",
  },
  pitch_rise: {
    category: TELL_CATEGORIES.VOCAL,
    label: "Pitch rose",
    verb: "let your pitch rise",
  },
  uptalk: {
    category: TELL_CATEGORIES.VOCAL,
    label: "Uptalk (rising tone)",
    verb: "ended a statement like a question",
  },
  volume_drop: {
    category: TELL_CATEGORIES.VOCAL,
    label: "Voice got quiet",
    verb: "let your voice drop",
  },
  pace_spike: {
    category: TELL_CATEGORIES.VOCAL,
    label: "Sped up",
    verb: "started talking faster",
  },
  filler_burst: {
    category: TELL_CATEGORIES.FILLER,
    label: "Filler words",
    verb: "used filler words",
  },
  hedging: {
    category: TELL_CATEGORIES.FILLER,
    label: "Hedging language",
    verb: "hedged",
  },
  lean_back: {
    category: TELL_CATEGORIES.POSTURAL,
    label: "Leaned back",
    verb: "leaned back",
  },
  arms_crossed: {
    category: TELL_CATEGORIES.POSTURAL,
    label: "Arms crossed",
    verb: "crossed your arms",
  },
  hand_to_face: {
    category: TELL_CATEGORIES.POSTURAL,
    label: "Hand to face",
    verb: "touched your face",
  },
  fidget: {
    category: TELL_CATEGORIES.POSTURAL,
    label: "Fidgeting",
    verb: "fidgeted",
  },
};

// Helper: get the category (and therefore color) for any tell type.
export function getCategoryForType(type) {
  const def = TELL_TYPES[type];
  return def ? def.category : TELL_CATEGORIES.POSTURAL;
}

// Helper: get the color bundle for any tell type.
export function getColorForType(type) {
  return CATEGORY_COLORS[getCategoryForType(type)];
}

// Helper: human label for any tell type.
export function getLabelForType(type) {
  const def = TELL_TYPES[type];
  return def ? def.label : type;
}

// The filler / hedging words we pattern-match in the live transcript.
// Order matters a little: longer multi-word phrases are checked as substrings.
export const FILLER_WORDS = ["um", "uh", "er", "like", "you know", "sort of", "kind of"];
export const HEDGING_PHRASES = [
  "i guess",
  "maybe",
  "i was thinking",
  "would it be possible",
  "i think",
  "probably",
  "i'm not sure",
  "if that's okay",
  "just",
  "hopefully",
];

// Clamp a number into the 0..1 range (used everywhere severity is computed).
export function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
