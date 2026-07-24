import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  // Report cards are typeset in the project's own fonts (Merriweather + Syne).
  // The .ttf files are read at render time, so they must be traced into the
  // serverless bundle — nothing imports them, so Next cannot infer this.
  outputFileTracingIncludes: {
    '/api/reports/**': ['./src/lib/pdf/fonts/**'],
    '/api/school/generate-reports': ['./src/lib/pdf/fonts/**'],
  },
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/layout",
    "@react-pdf/pdfkit",
    "@react-pdf/font",
    "@react-pdf/image",
    "@react-pdf/textkit",
    "@react-pdf/stylesheet",
  ],
};

export default nextConfig;
