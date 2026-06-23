import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-heebo)", "sans-serif"],
      },
      colors: {
        sage: {
          50:  "#f4f7f4",
          100: "#e2ebe2",
          200: "#c5d7c5",
          300: "#9dbf9d",
          400: "#70a070",
          500: "#4d8050",
          600: "#3a6640",
          700: "#2f5234",
          800: "#27422a",
          900: "#203623",
        },
        warm: {
          50:  "#fdf8f2",
          100: "#faeede",
          200: "#f4d9b8",
          300: "#ecbe87",
          400: "#e29f54",
          500: "#d98530",
          600: "#c06b22",
          700: "#a0531d",
          800: "#82421e",
          900: "#6a381b",
        },
      },
      animation: {
        "pulse-ring": "pulseRing 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite",
        "spin-slow": "spin 2s linear infinite",
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
      },
      keyframes: {
        pulseRing: {
          "0%":   { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(77,128,80,0.5)" },
          "70%":  { transform: "scale(1)",    boxShadow: "0 0 0 18px rgba(77,128,80,0)" },
          "100%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(77,128,80,0)" },
        },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
export default config;
