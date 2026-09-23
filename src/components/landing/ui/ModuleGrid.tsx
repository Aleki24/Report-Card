import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { modules, type Module } from '@/lib/modules';
import { cn } from '@/lib/utils';

/** Every module a school can use today — Settings is plumbing, not a feature. */
export const LIVE_MODULES = modules.filter((m) => m.status === 'active' && m.slug !== 'settings');

// Report cards are the product's core promise, so that tile gets the wide slot.
const FEATURED_SLUG: Module['slug'] = 'report-cards';

/** The live modules as linked cards; shared by the landing page and /features. */
export function ModuleGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {LIVE_MODULES.map((mod) => (
        <li key={mod.slug} className={cn(mod.slug === FEATURED_SLUG && 'sm:col-span-2')}>
          <ModuleCard module={mod} featured={mod.slug === FEATURED_SLUG} />
        </li>
      ))}
    </ul>
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
