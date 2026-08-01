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
        accent: {
          DEFAULT: "#4f46e5",
          dark: "#4338ca",
          soft: "#e0e7ff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
