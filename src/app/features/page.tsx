import { Clock } from 'lucide-react';
import { comingSoonModules } from '@/lib/modules';
import { Wordmark } from '@/components/Wordmark';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section } from '@/components/landing/ui/Section';
import { ModuleGrid } from '@/components/landing/ui/ModuleGrid';

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Platform modules"
        title="Everything your school"
        highlight="needs."
        description={
          <>
            Explore the modules that power <Wordmark /> — from report cards and student management to attendance tracking and
            academic analytics.
          </>
        }
      />

      <Section className="pt-0 md:pt-0">
        <ModuleGrid />
      </Section>

      <Section aria-labelledby="coming-soon" className="pt-0 md:pt-0">
        <div className="mb-8 flex items-center gap-6 md:mb-12">
          <span aria-hidden className="h-px flex-1 bg-border" />
          <h2 id="coming-soon" className="flex items-center gap-2 text-xs font-medium tracking-[0.3em] text-muted-foreground uppercase">
            <Clock className="size-3.5" aria-hidden /> Coming in phase two
          </h2>
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {comingSoonModules.map(({ slug, icon: Icon, title, description }) => (
            <li key={slug} className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-5">
              <div className="flex items-center justify-between gap-2">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="rounded-full bg-caution/15 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wider text-caution uppercase">
                  Coming soon
                </span>
              </div>
              <h3 className="font-heading text-base font-bold text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>
      </Section>
    </MarketingShell>
  );
}
