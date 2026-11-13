import type { Metadata } from 'next';
import {
  BarChart3, CalendarCheck, CheckCircle2, ClipboardList, FileText, GraduationCap, Sparkles,
  MessageSquare, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section, SectionHeader } from '@/components/landing/ui/Section';
import { CtaLink } from '@/components/landing/ui/CtaLink';
import { FREE_TRIAL, PER_LEARNER_ABOVE, PLANS, STARTING_PRICE, cyclePrice, formatKes } from '@/lib/pricing';
import { PriceCalculator } from '@/components/landing/PriceCalculator';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Pricing · Skulbase',
  description: `${FREE_TRIAL}, then from ${STARTING_PRICE}. Every module in every plan.`,
};

const INCLUDED: readonly string[] = [
  'Every module, no add-ons',
  'Unlimited teachers and staff',
  'Phone app for staff, parents and learners',
  'M-Pesa fee matching',
  'Timetables and report cards',
  'Free setup and data import',
];

interface Module { icon: LucideIcon; title: string }

const MODULES: readonly Module[] = [
  { icon: ClipboardList, title: 'Exams & marks' },
  { icon: FileText, title: 'Report cards' },
  { icon: CalendarCheck, title: 'Attendance' },
  { icon: Wallet, title: 'Fees' },
  { icon: BarChart3, title: 'Analytics' },
  { icon: MessageSquare, title: 'Parent SMS' },
  { icon: Users, title: 'People' },
  { icon: GraduationCap, title: 'Student portal' },
];

const BILLING: readonly { q: string; a: string }[] = [
  { q: 'How do we pay?', a: 'By the term or the year, by M-Pesa or bank. The year is three terms less 15%.' },
  { q: 'Is there a trial?', a: 'Your first term is free. No payment until your second term.' },
  { q: 'Do we pay per learner?', a: `Only past 1,500 learners: ${formatKes(PER_LEARNER_ABOVE)} a learner a term. Below that, one price by size.` },
  { q: 'What about SMS?', a: 'Texts to parents are bought in bundles, at the network price.' },
];

/** Plans by school size, every module in each, a calculator, and how paying works. */
export default function PricingPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Plans & pricing"
        title="Pay by school size."
        highlight="Every module included."
        description={`${FREE_TRIAL}. Then from ${STARTING_PRICE}.`}
      />

      <Section className="pt-0 md:pt-0">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <article key={plan.id} className={cn('relative flex flex-col rounded-3xl border bg-card p-6', i === 1 ? 'border-2 border-primary shadow-2xl shadow-black/5 dark:shadow-black/40' : 'border-border/70')}>
              {i === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[0.6875rem] font-bold tracking-widest text-primary-foreground uppercase">Most schools</span>}
              <h2 className="font-heading text-lg font-bold text-foreground">{plan.name}</h2>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-4 font-heading text-[1.75rem] leading-tight font-bold whitespace-nowrap text-foreground">{formatKes(plan.perTerm)}</p>
              <p className="text-sm text-muted-foreground">a term · {formatKes(cyclePrice(plan.upTo, 'year'))} a year</p>
              <CtaLink href="/signup" variant={i === 1 ? 'primary' : 'outline'} size="md" className="mt-6 w-full">Start free</CtaLink>
            </article>
          ))}
          <article className="flex flex-col rounded-3xl border border-dashed border-border bg-card/60 p-6">
            <h2 className="font-heading text-lg font-bold text-foreground">Big schools</h2>
            <p className="text-sm text-muted-foreground">Over 1,500 learners</p>
            <p className="mt-4 font-heading text-[1.75rem] leading-tight font-bold whitespace-nowrap text-foreground">{formatKes(PER_LEARNER_ABOVE)}</p>
            <p className="text-sm text-muted-foreground">a learner a term</p>
            <CtaLink href="/contact" variant="outline" size="md" className="mt-auto w-full">Talk to us</CtaLink>
          </article>
        </div>
      </Section>

      <Section className="pt-0 md:pt-0">
        <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-10">
          <PriceCalculator />
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Sparkles className="size-3.5" aria-hidden /> In every plan
            </h2>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {INCLUDED.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {MODULES.map(({ icon: Icon, title }) => (
                <li key={title} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden><Icon className="size-4" /></span>
                  <span className="text-sm font-semibold text-foreground">{title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section width="narrow" className="pt-0 md:pt-0">
        <SectionHeader eyebrow="Billing" title="How paying" highlight="works." />
        <dl className="grid gap-4 sm:grid-cols-2">
          {BILLING.map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-border/70 bg-card p-5">
              <dt className="font-heading text-base font-bold text-foreground">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </MarketingShell>
  );
}
