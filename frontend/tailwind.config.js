/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          900: "#0a0f1e",
          800: "#0d1526",
          700: "#111829",
          600: "#131e35",
          500: "#1a2840",
          400: "#233352",
          300: "#2a3555",
        },
        accent: {
          purple: "#7c6fff",
          green: "#00e5a0",
          red: "#ff4d6d",
          yellow: "#ffd166",
          blue: "#4dabf7",
          pink: "#ff6b9d",
        },
        muted: "#4a5a80",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
  safelist: [
    // Score button dynamic classes in Revisions.jsx
    { pattern: /bg-(accent-red|accent-yellow|accent-purple|accent-blue|accent-green)\/(10|15|20|30)/ },
    { pattern: /text-(accent-red|accent-yellow|accent-purple|accent-blue|accent-green)/ },
    { pattern: /border-(accent-red|accent-yellow|accent-purple|accent-blue|accent-green)\/(30|60)/ },
    { pattern: /hover:border-(accent-red|accent-yellow|accent-purple|accent-blue|accent-green)\/60/ },
  ],
};