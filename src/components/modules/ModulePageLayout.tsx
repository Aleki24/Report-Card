"use client";

import { useTheme } from '@/components/ThemeProvider';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import ModuleHero from '@/components/modules/ModuleHero';
import ModuleFeatureGrid from '@/components/modules/ModuleFeatureGrid';
import ModuleWorkflow from '@/components/modules/ModuleWorkflow';
import ModuleBenefits from '@/components/modules/ModuleBenefits';
import ModuleCTA from '@/components/modules/ModuleCTA';
import { getModuleBySlug } from '@/lib/modules';

interface ModulePageLayoutProps {
  slug: string;
}

export default function ModulePageLayout({ slug }: ModulePageLayoutProps) {
  const { theme } = useTheme();
  const module = getModuleBySlug(slug);

  if (!module) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <Navbar />
        <div style={{ padding: '200px 24px', textAlign: 'center' }}>
          <h1 style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
            Module Not Found
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '12px' }}>
            The module &ldquo;{slug}&rdquo; does not exist.
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden transition-colors duration-500"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Ambient Light Effects */}
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

      <Navbar />

      <main className="relative z-10">
        <ModuleHero module={module} />
        <ModuleFeatureGrid features={module.features} />
        <ModuleWorkflow steps={module.workflow} />
        <ModuleBenefits benefits={module.benefits} />
        <ModuleCTA module={module} />
      </main>

      <Footer />
    </div>
  );
}
