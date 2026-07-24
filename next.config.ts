import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "sharp", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/extract": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/generate": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/@sparticuz/chromium/build/**/*",
      "./node_modules/playwright-core/**/*",
    ],
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
