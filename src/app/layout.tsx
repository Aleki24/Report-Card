import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';
import localFont from 'next/font/local';

const helveticaNeue = localFont({
  src: [
    {
      path: '../../public/fonts/helvetica-neue/HelveticaNeueRoman.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/helvetica-neue/HelveticaNeueMedium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../public/fonts/helvetica-neue/HelveticaNeueBold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/helvetica-neue/HelveticaNeueHeavy.otf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../../public/fonts/helvetica-neue/HelveticaNeueBlack.otf',
      weight: '900',
      style: 'normal',
    }
  ],
  variable: '--font-helvetica-neue'
});

export const metadata: Metadata = {
  title: 'Matokeo — Modern School Management System',
  description: 'Manage report cards, students, teachers, classes, exams, attendance, parents, and academic analytics from one powerful platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`overflow-x-hidden ${helveticaNeue.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
