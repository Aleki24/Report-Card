import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ResultsApp - Student Analytics Platform',
  description: 'Comprehensive results analysis, mark entry, analytics generation, and downloadable PDF reports for teachers and schools.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
