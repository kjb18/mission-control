/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Overriding Tailwind's built-in `white` is deliberate and
        // high-leverage: the app uses text-white / border-white/NN /
        // bg-white/NN pervasively as its text-primary + hairline system,
        // so this single line re-tints every one of those usages to the
        // spec's exact text-primary (#f1f5f9) without touching ~50 files.
        white: "#f1f5f9",
        base: {
          950: "#0f1117", // background primary
          900: "#161b27", // surface cards
          800: "#1c2333", // surface elevated
        },
        sidebar: "#0d1120",
        accent: {
          DEFAULT: "#f59e0b", // accent primary amber
          light: "#d97706", // accent hover amber — class name kept as
          // `accent-light` since ~28 existing hover:bg-accent-light
          // usages read it; the *value* is the spec's hover color.
          dark: "#d97706",
        },
        blue: {
          subtle: "#1e3a5f", // merges into Tailwind's stock blue scale —
          // blue-500 (#3b82f6) is an exact match for "Blue highlight"
          // already, so only the subtle tint needed adding.
        },
        success: "#10b981", // == Tailwind's stock emerald-500
        danger: "#ef4444", // == Tailwind's stock red-500
        warning: "#f97316", // == Tailwind's stock orange-500
        ink: {
          secondary: "#94a3b8", // == Tailwind's stock slate-400
          muted: "#475569", // == Tailwind's stock slate-600
        },
        line: {
          DEFAULT: "#1e2d3d", // border default
          strong: "#2d3f55", // border strong
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
