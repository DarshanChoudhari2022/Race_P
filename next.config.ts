import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "sharp", "pdfjs-dist"],
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
