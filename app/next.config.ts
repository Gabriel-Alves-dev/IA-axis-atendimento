import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autocontido pra rodar em Docker (node server.js, sem node_modules completo).
  // Não afeta o deploy na Vercel — ela ignora essa opção.
  output: 'standalone',
};

export default nextConfig;
