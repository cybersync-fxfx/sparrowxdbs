import svgToDataUri from "mini-svg-data-uri";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#030407",
        surface: "#080B12",
        "surface-border": "#141A29",
        periwinkle: "#8F9CFF",
        "spx-cyan": "#06B6D4",
        "spx-emerald": "#10B981",
        "spx-amber": "#F59E0B",
      },
      backgroundImage: {
        "silver-metallic": "linear-gradient(180deg, #FFFFFF 0%, #B0BAC9 100%)",
        "blueprint-grid": `url("${svgToDataUri(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="rgba(143,156,255,0.08)"><path d="M0 .5H39.5V40"/></svg>`,
        )}")`,
        "dot-matrix": `url("${svgToDataUri(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none"><circle cx="2" cy="2" r="1" fill="rgba(143,156,255,0.22)"/></svg>`,
        )}")`,
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-50%, 0, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spot-glow": {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.06)" },
        },
        float: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" },
        },
        "grid-movement": {
          "0%": { backgroundPosition: "0px 0px" },
          "100%": { backgroundPosition: "40px 40px" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(143, 156, 255, 0.35)" },
          "50%": { boxShadow: "0 0 28px 4px rgba(143, 156, 255, 0.45)" },
        },
        "particle-drift": {
          "0%": { transform: "translate3d(0, 0, 0)", opacity: "0.2" },
          "50%": { transform: "translate3d(12px, -18px, 0)", opacity: "0.75" },
          "100%": { transform: "translate3d(0, 0, 0)", opacity: "0.2" },
        },
        "text-gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
        shimmer: "shimmer 2.8s linear infinite",
        "spot-glow": "spot-glow 4.5s ease-in-out infinite",
        float: "float 5.5s ease-in-out infinite",
        "grid-movement": "grid-movement 8s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "particle-drift": "particle-drift 9s ease-in-out infinite",
        "text-gradient-shift": "text-gradient-shift 6s ease infinite",
      },
    },
  },
  plugins: [],
};
