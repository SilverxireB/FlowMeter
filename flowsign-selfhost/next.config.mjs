/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tek klasörlük dağıtım: `npm run build` sonrası .next/standalone kendi
  // başına `node server.js` ile çalışır (node_modules kopyalamak gerekmez).
  output: "standalone",
};

export default nextConfig;
