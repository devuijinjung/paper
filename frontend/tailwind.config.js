/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0e11",
          900: "#13171c",
          850: "#1e2329",
          800: "#252a33",
          700: "#2b3139",
          600: "#363f4e",
        },
        brand: {
          400: "#fcd34d",
          500: "#f0b90b",
          600: "#d4a017",
        },
        up:   "#0ecb81",
        down: "#f6465d",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "Pretendard", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow:       "0 0 0 1px rgba(240,185,11,0.15), 0 4px 24px -8px rgba(240,185,11,0.2)",
        "glow-up":  "0 0 20px -4px rgba(14,203,129,0.4)",
        "glow-down":"0 0 20px -4px rgba(246,70,93,0.4)",
        card:       "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 4px 16px -8px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "slide-in": {
          "0%":   { opacity: 0, transform: "translateX(12px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%":   { boxShadow: "0 0 0 0 rgba(14,203,129,0.6)" },
          "70%":  { boxShadow: "0 0 0 5px rgba(14,203,129,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(14,203,129,0)" },
        },
      },
      animation: {
        "fade-up":   "fade-up 0.3s ease-out",
        "slide-in":  "slide-in 0.3s ease-out",
        "pulse-ring":"pulse-ring 2s ease-out infinite",
      },
    },
  },
  plugins: [],
};
