import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sade FlowMeter paleti: sıcak nötr zemin + tek mavi vurgu
        ink: "#0b0b0b",
        paper: "#f9f9f7",
        line: "#e1e0d9",
        muted: "#898781",
        accent: {
          DEFAULT: "#2a78d6",
          dark: "#1c5cab",
          soft: "#cde2fb",
        },
      },
    },
  },
  plugins: [],
};
export default config;
