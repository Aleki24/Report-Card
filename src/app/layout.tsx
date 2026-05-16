import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Merriweather, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const fontSans = Merriweather({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "700", "900"],
});

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
    <html lang="en" data-theme="dark" className={cn("font-sans", fontSans.variable, fontSerif.variable, fontMono.variable)}>
      <body className={`overflow-x-hidden antialiased bg-background text-foreground`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
