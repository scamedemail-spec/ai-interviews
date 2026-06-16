/** @type {import('tailwindcss').Config} */

// Tailwind scans these files for class names so it can generate only the CSS we use.
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Our dark theme palette. "ink" shades are the dark grays of the background.
        // "accent" is the single bold color (electric amber) used for emphasis.
        ink: {
          950: "#08090c", // page background, almost black
          900: "#0c0e13", // panels
          850: "#11141b",
          800: "#171b24", // cards
          700: "#222734", // borders / dividers
          600: "#323847",
          400: "#7b8294", // muted text
          200: "#c7ccd6", // secondary text
        },
        accent: {
          // Electric amber accent.
          DEFAULT: "#ffb020",
          soft: "#ffc861",
          dim: "#7a5410",
        },
        // Tell category colors, used by both the live signal layer and the debrief timeline.
        tell: {
          gaze: "#ff4d4d",     // red  — eye contact / gaze breaks
          vocal: "#ff9f1c",    // orange — pitch / vocal tells
          filler: "#ffe14d",   // yellow — filler words & hedging
          postural: "#4d9dff", // blue — posture / physical tells
        },
      },
      fontFamily: {
        // System font stack keeps the bundle small and the look sharp/modern.
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        // Subtle pulse used for the live "recording" dot and typing indicator.
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        // Used to sweep the mock timeline on the landing page.
        sweep: {
          "0%": { transform: "translateX(-10%)", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { transform: "translateX(110%)", opacity: "0" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.2s ease-in-out infinite",
        sweep: "sweep 4s linear infinite",
        fadeInUp: "fadeInUp 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
