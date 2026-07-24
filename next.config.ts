import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  // Report cards are typeset in the project's own fonts (Merriweather + Syne).
  // The server reads the .ttf files off disk at render time and nothing
  // imports them, so Next cannot infer the dependency — trace them explicitly
  // into the serverless bundle. (The browser fetches the same files over HTTP
  // when the bulk-download page generates PDFs client-side.)
  outputFileTracingIncludes: {
    '/api/reports/**': ['./public/fonts/report/*.ttf', './public/images/logo.png'],
    '/api/school/generate-reports': ['./public/fonts/report/*.ttf', './public/images/logo.png'],
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
