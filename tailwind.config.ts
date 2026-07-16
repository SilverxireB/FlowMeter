import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // FlowMeter marka paleti (Mentimeter'ın koyu lacivert + canlı vurgu düzenine benzer)
        brand: {
          navy: "#10305b",
          blue: "#2d6ff7",
          sky: "#e8f0fe",
        },
      },
    },
  },
  plugins: [],
};
export default config;
