import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { comingSoonModules, modules, type Module } from '@/lib/modules';
import { cn } from '@/lib/utils';
import { Section, SectionHeader } from './ui/Section';

const liveModules = modules.filter((m) => m.status === 'active' && m.slug !== 'settings');

// Report cards are the product's core promise, so the first tile gets the wide slot.
const FEATURED_SLUG: Module['slug'] = 'report-cards';

export default function ModulesSection() {
  return (
    <Section id="modules">
      <SectionHeader
        eyebrow="Platform modules"
        title="One platform,"
        highlight="every module."
        description={`${liveModules.length} modules live today and all included in one plan — from enrollment on day one to results on closing day.`}
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liveModules.map((mod) => (
          <li key={mod.slug} className={cn(mod.slug === FEATURED_SLUG && 'sm:col-span-2')}>
            <ModuleCard module={mod} featured={mod.slug === FEATURED_SLUG} />
          </li>
        ))}
      </ul>

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

function ModuleCard({ module: mod, featured }: { module: Module; featured: boolean }) {
  const Icon = mod.icon;

  return (
    <Link
      href={mod.featureHref}
      className={cn(
        'group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300',
        'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        featured && 'bg-gradient-to-br from-primary/10 via-card to-card',
      )}
    >
      <div className="flex items-start justify-between">
        <span className="flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <ArrowUpRight
          className="size-5 text-muted-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </div>

      <h3 className={cn('font-heading font-bold tracking-tight text-foreground', featured ? 'text-xl md:text-2xl' : 'text-base')}>
        {mod.title}
      </h3>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{featured ? mod.longDescription : mod.description}</p>

      {featured && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {mod.features.slice(0, 4).map((feature) => (
            <li key={feature} className="rounded-full bg-background/60 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border">
              {feature}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
