import HeroSection from '@/components/landing/HeroSection';
import ShaderBackdrop from '@/components/landing/ShaderBackdrop';
import ProblemSolutionSection from '@/components/landing/ProblemSolutionSection';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import ModulesSection from '@/components/landing/ModulesSection';
import WorkflowSection from '@/components/landing/WorkflowSection';
import JoinGuideSection from '@/components/landing/JoinGuideSection';
import RolesSection from '@/components/landing/RolesSection';
import FaqSection from '@/components/landing/FaqSection';
import CTASection from '@/components/landing/CTASection';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';

export default function Home() {
  return (
    <MarketingShell
      backdrop={
        <>
          {/* Scroll progress bar — driven by animation-timeline: scroll(),
              invisible on browsers without support */}
          <div className="landing-scroll-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left [transform:scaleX(0)] bg-gradient-to-r from-primary to-positive" />
          {/* Live WebGL aurora — layers over the static glow, skipped without WebGL2 */}
          <ShaderBackdrop />
        </>
      }
    >
      {/* Order tells the buying story: promise → pain → proof → social proof → breadth →
          ease → who it serves → objections → ask. */}
      <HeroSection />
      <ProblemSolutionSection />
      <ShowcaseSection />
      <TestimonialsSection />
      <ModulesSection />
      <WorkflowSection />
      <RolesSection />
      <JoinGuideSection />
      <FaqSection />
      <CTASection />
    </MarketingShell>
  );
}
