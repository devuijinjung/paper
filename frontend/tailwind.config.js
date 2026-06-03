/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070809",
          900: "#0c0e12",
          850: "#11141a",
          800: "#171b22",
          700: "#1f242d",
          600: "#2a313c",
        },
        brand: {
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
        },
        up:   "#34d399",
        down: "#fb7185",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "Pretendard", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow:       "0 0 0 1px rgba(99,102,241,0.15), 0 8px 40px -12px rgba(99,102,241,0.25)",
        "glow-up":  "0 0 24px -6px rgba(52,211,153,0.45)",
        "glow-down":"0 0 24px -6px rgba(251,113,133,0.45)",
        card:       "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 40px -16px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "slide-in": {
          "0%":   { opacity: 0, transform: "translateX(16px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%":   { boxShadow: "0 0 0 0 rgba(52,211,153,0.5)" },
          "70%":  { boxShadow: "0 0 0 6px rgba(52,211,153,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52,211,153,0)" },
        },
      },
      animation: {
        "fade-up":   "fade-up 0.4s ease-out",
        "slide-in":  "slide-in 0.35s ease-out",
        "pulse-ring":"pulse-ring 2s ease-out infinite",
      },
    },
  },
  plugins: [],
};
