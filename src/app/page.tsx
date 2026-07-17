"use client";

import { useTheme } from '@/components/ThemeProvider';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import ShaderBackdrop from '@/components/landing/ShaderBackdrop';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import ModulesSection from '@/components/landing/ModulesSection';
import WorkflowSection from '@/components/landing/WorkflowSection';
import JoinGuideSection from '@/components/landing/JoinGuideSection';
import RolesSection from '@/components/landing/RolesSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function Home() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen relative overflow-hidden transition-colors duration-500" style={{ background: 'var(--color-bg)' }}>

      {/* Scroll progress bar — driven by animation-timeline: scroll(),
          invisible on browsers without support */}
      <div
        className="landing-scroll-progress fixed top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '2px',
          zIndex: 60,
          transformOrigin: '0 50%',
          transform: 'scaleX(0)',
          background: 'linear-gradient(90deg, var(--color-accent), var(--color-success))',
        }}
      />

      {/* AMBIENT LIGHT EFFECTS — static CSS fallback, always present */}
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
      </div>

      {/* Live WebGL aurora — layers over the static glow, skipped without WebGL2 */}
      <ShaderBackdrop />

      <Navbar />

      <main className="relative z-10">
        <HeroSection />
        <ModulesSection />
        <ShowcaseSection />
        <WorkflowSection />
        <JoinGuideSection />
        <RolesSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
