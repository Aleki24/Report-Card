import type { ReactNode } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

type MarketingShellProps = {
  children: ReactNode;
  /** Extra page-level layers drawn behind the navbar, e.g. the landing page's WebGL aurora. */
  backdrop?: ReactNode;
};

/** The frame every public marketing page shares: ambient glow, navbar, content, footer. */
export function MarketingShell({ children, backdrop }: MarketingShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background transition-colors duration-500">
      {/* Ambient light — static CSS, always present */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] h-[50vh] w-[50vw] rounded-full bg-[radial-gradient(circle,var(--color-accent-glow)_0%,transparent_70%)] opacity-30 blur-[160px] dark:opacity-60" />
        <div className="absolute right-[-5%] bottom-[10%] h-[35vh] w-[35vw] rounded-full bg-[radial-gradient(circle,rgba(124,107,240,0.08)_0%,transparent_70%)] opacity-20 blur-[120px] dark:opacity-50" />
      </div>

      {backdrop}

      <Navbar />
      <main className="relative z-10">{children}</main>
      <Footer />
    </div>
  );
}
