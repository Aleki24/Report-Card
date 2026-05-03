"use client";

import { useTheme } from '@/components/ThemeProvider';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import WorkflowSection from '@/components/landing/WorkflowSection';
import RolesSection from '@/components/landing/RolesSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function Home() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500" style={{ background: 'var(--color-bg)' }}>

      {/* AMBIENT LIGHT EFFECTS — static, no animation */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-[10%] w-[50vw] h-[50vh] rounded-full blur-[160px]"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%)',
            opacity: theme === 'dark' ? 0.6 : 0.3,
          }}
        />
        <div
          className="absolute bottom-[10%] right-[-5%] w-[35vw] h-[35vh] rounded-full blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(124, 107, 240, 0.08) 0%, transparent 70%)',
            opacity: theme === 'dark' ? 0.5 : 0.2,
          }}
        />
        <div
          className="absolute top-[5%] right-[20%] w-[30vw] h-[25vh] rounded-full blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(159, 122, 234, 0.06) 0%, transparent 70%)',
            opacity: theme === 'dark' ? 0.4 : 0.15,
          }}
        />
      </div>

      <Navbar />

      <main className="relative z-10">
        <HeroSection />
        <WorkflowSection />
        <RolesSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
