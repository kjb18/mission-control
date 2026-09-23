/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0a0e1a",
          900: "#0f172a",
          800: "#151f34",
          700: "#1e293b",
          600: "#2a3a52",
        },
        accent: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
          dark: "#d97706",
        },
      },
    },
  },
  plugins: [],
};
