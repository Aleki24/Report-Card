import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { comingSoonModules } from '@/lib/modules';
import { Section, SectionHeader } from './ui/Section';
import { LIVE_MODULES, ModuleGrid } from './ui/ModuleGrid';

export default function ModulesSection() {
  return (
    <Section id="modules">
      <SectionHeader
        eyebrow="Platform modules"
        title="One platform,"
        highlight="every module."
        description={`${LIVE_MODULES.length} modules live today and all included in one plan — from enrollment on day one to results on closing day.`}
      />

      <ModuleGrid />

      <div className="mt-10 flex flex-col items-center gap-6 md:mt-14">
        <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Coming next:</span>
          {comingSoonModules.map((mod) => (
            <span key={mod.slug} className="rounded-full border border-dashed border-border px-3 py-1 text-xs">
              {mod.title}
            </span>
          ))}
        </p>

        <Link
          href="/features"
          className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Explore all features
          <ArrowRight className="size-4 text-primary transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>
    </Section>
  );
}
