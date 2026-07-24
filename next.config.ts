import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "sharp"],
  outputFileTracingIncludes: {
    "/api/extract": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
