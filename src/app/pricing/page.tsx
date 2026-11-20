import type { Metadata } from 'next';
import {
  BarChart3, CalendarCheck, CheckCircle2, ClipboardList, FileText, GraduationCap, Sparkles,
  MessageSquare, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section, SectionHeader } from '@/components/landing/ui/Section';
import { CtaLink } from '@/components/landing/ui/CtaLink';
import { PRICE_PER_TERM, TERM_PRICE, formatKes } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Pricing · Skulbase',
  description: `${TERM_PRICE}. Every module included.`,
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
  { q: 'How do we pay?', a: 'Each term, by M-Pesa or bank.' },
  { q: 'Do we pay per learner?', a: `No. Every school pays ${TERM_PRICE}, whatever its size.` },
  { q: 'What about SMS?', a: 'Texts to parents are bought in bundles, at the network price.' },
];

/** One price for every school, every module included, and how paying works. */
export default function PricingPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Plans & pricing"
        title="One price."
        highlight="Every module included."
        description={`${TERM_PRICE} for every school.`}
      />

      <Section className="pt-0 md:pt-0">
        <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-10">
          <article className="flex flex-col rounded-3xl border-2 border-primary bg-card p-6 shadow-2xl shadow-black/5 sm:p-8 dark:shadow-black/40">
            <h2 className="font-heading text-lg font-bold text-foreground">Every school</h2>
            <p className="text-sm text-muted-foreground">Any size, every module</p>
            <p className="mt-4 font-heading text-4xl leading-tight font-bold text-foreground tabular-nums">{formatKes(PRICE_PER_TERM)}</p>
            <p className="text-sm text-muted-foreground">a term</p>
            <CtaLink href="/signup" variant="primary" size="md" className="mt-6 w-full">Get started</CtaLink>
          </article>
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Sparkles className="size-3.5" aria-hidden /> Included
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
