"use client";

import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import ShaderBackdrop from '@/components/landing/ShaderBackdrop';
import ProblemSolutionSection from '@/components/landing/ProblemSolutionSection';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import ModulesSection from '@/components/landing/ModulesSection';
import WorkflowSection from '@/components/landing/WorkflowSection';
import JoinGuideSection from '@/components/landing/JoinGuideSection';
import RolesSection from '@/components/landing/RolesSection';
import FaqSection from '@/components/landing/FaqSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function Home() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="relative min-h-screen overflow-hidden bg-background transition-colors duration-500">
      {/* Scroll progress bar — driven by animation-timeline: scroll(),
          invisible on browsers without support */}
      <div className="landing-scroll-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left [transform:scaleX(0)] bg-gradient-to-r from-primary to-positive" />

      {/* AMBIENT LIGHT EFFECTS — static CSS fallback, always present */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className={cn(
            'absolute top-[-20%] left-[10%] h-[50vh] w-[50vw] rounded-full bg-[radial-gradient(circle,var(--color-accent-glow)_0%,transparent_70%)] blur-[160px]',
            isDark ? 'opacity-60' : 'opacity-30',
          )}
        />
        <div
          className={cn(
            'absolute right-[-5%] bottom-[10%] h-[35vh] w-[35vw] rounded-full bg-[radial-gradient(circle,rgba(124,107,240,0.08)_0%,transparent_70%)] blur-[120px]',
            isDark ? 'opacity-50' : 'opacity-20',
          )}
        />
      </div>

      {/* Live WebGL aurora — layers over the static glow, skipped without WebGL2 */}
      <ShaderBackdrop />

      <Navbar />

      {/* Order tells the buying story: promise → pain → proof → breadth →
          ease → who it serves → objections → ask. */}
      <main className="relative z-10">
        <HeroSection />
        <ProblemSolutionSection />
        <ShowcaseSection />
        <ModulesSection />
        <WorkflowSection />
        <RolesSection />
        <JoinGuideSection />
        <FaqSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
