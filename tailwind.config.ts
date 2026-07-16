import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // FlowMeter tasarım sistemi: "vibrant rose + engagement blue"
        // (ui-ux-pro-max önerisi), sade zemin + beyaz kartlar
        ink: "#1c1917",
        paper: "#fff7f6",
        line: "#f0e4e4",
        muted: "#8a8086",
        brand: {
          DEFAULT: "#e11d48",
          dark: "#be123c",
          soft: "#ffe4e6",
        },
        accent: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
          soft: "#dbeafe",
        },
      },
      borderRadius: {
        blob: "1.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
