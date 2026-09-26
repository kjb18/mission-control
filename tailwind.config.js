/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Overriding Tailwind's built-in `white` is deliberate and
        // high-leverage: the app uses text-white pervasively as its
        // text-primary token, so this single line re-tints every one of
        // those usages to the spec's exact text-primary (#0f172a) without
        // touching every file that already reads it.
        white: "#0f172a",
        base: {
          950: "#f0f2f5", // background base
          900: "#ffffff", // card surface
          800: "#f8fafc", // elevated / secondary surface (inputs, hovers)
        },
        sidebar: "#ffffff",
        // `accent` was the brand/primary color; it is now blue — the new
        // spec's "operations, focus, active states, primary buttons"
        // color — so every existing bg-accent/text-accent/hover:bg-accent-light
        // usage across the app cascades to blue for free. Growth-domain
        // surfaces (Crosshairs, OKRs, Content, SEO, Brewing, meetings)
        // are hand-overridden to violet-* where they diverge.
        accent: {
          DEFAULT: "#3b82f6", // blue primary — == Tailwind's stock blue-500
          light: "#2563eb", // hover — == Tailwind's stock blue-600
        },
        success: "#10b981", // == Tailwind's stock emerald-500
        danger: "#ef4444", // == Tailwind's stock red-500
        warning: "#f97316", // == Tailwind's stock orange-500
        ink: {
          secondary: "#64748b", // == Tailwind's stock slate-500
          muted: "#94a3b8", // == Tailwind's stock slate-400
        },
        line: {
          DEFAULT: "#e2e8f0", // border default — == Tailwind's stock slate-200
          strong: "#cbd5e1", // border strong — == Tailwind's stock slate-300
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
