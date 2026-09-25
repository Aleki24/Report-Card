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
  // Old dashboard URLs folded into other pages. Kept as redirects rather than
  // pages so bookmarks and links in messages already sent still land somewhere.
  async redirects() {
    return [
      { source: '/dashboard/students', destination: '/dashboard/people', permanent: false },
      { source: '/dashboard/teachers', destination: '/dashboard/people?tab=teachers', permanent: false },
      { source: '/dashboard/parents', destination: '/dashboard/people?tab=parents', permanent: false },
      { source: '/dashboard/exams', destination: '/dashboard/exams-marks', permanent: false },
      { source: '/dashboard/report-cards', destination: '/dashboard/reports', permanent: false },
      { source: '/dashboard/academic-structure', destination: '/dashboard/settings', permanent: false },
      { source: '/dashboard/administration', destination: '/dashboard/users', permanent: false },
      { source: '/dashboard/my-results', destination: '/student/results', permanent: false },
    ];
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
