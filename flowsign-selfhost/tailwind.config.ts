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
        // Ana ürünle AYNI nötr palet (Flow Studio tasarım sistemi) — Sign artık
        // diğer ürünler gibi AYDINLIK kokpit kullanıyor.
        ink: "#18181b",
        paper: "#fafafa",
        line: "#ececeb",
        muted: "#78716c",
        brand: {
          DEFAULT: "#e11d48",
          dark: "#be123c",
          soft: "#ffe4e6",
        },
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
