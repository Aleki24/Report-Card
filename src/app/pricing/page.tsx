import type { Metadata } from 'next';
import {
  BarChart3, CalendarCheck, CheckCircle2, ClipboardList, FileText, GraduationCap, Sparkles,
  MessageSquare, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section, SectionHeader } from '@/components/landing/ui/Section';
import { CtaLink } from '@/components/landing/ui/CtaLink';
import { SCHOOL_PLAN } from '@/lib/pricing';

export const metadata: Metadata = {
  title: 'Pricing · Skulbase',
  description: `${SCHOOL_PLAN.price} ${SCHOOL_PLAN.period}, every module included. No per-learner fees.`,
};

const INCLUDED: readonly string[] = [
  'Unlimited learners and teachers',
  'Every module, no add-ons',
  'Report cards as PDFs, one or a whole class',
  'Results and announcements by SMS',
  'Attendance registers',
  'Fees, payments and receipts',
  'Analytics for every class and subject',
  'Priority support',
];

interface Module { icon: LucideIcon; title: string; detail: string }

const MODULES: readonly Module[] = [
  { icon: ClipboardList, title: 'Exams & marks', detail: 'Mark grids, CSV upload and photo capture of paper mark sheets.' },
  { icon: FileText, title: 'Report cards', detail: 'CBC and 8-4-4 templates with your logo, motto and signature.' },
  { icon: CalendarCheck, title: 'Attendance', detail: 'A daily register per class, with absence trends.' },
  { icon: Wallet, title: 'Fees', detail: 'Fee structures, payments, balances and mobile checkout.' },
  { icon: BarChart3, title: 'Analytics', detail: 'Pass rates, rankings and term-on-term comparisons.' },
  { icon: MessageSquare, title: 'Parent SMS', detail: 'Results and notices sent to parents’ phones.' },
  { icon: Users, title: 'People', detail: 'Learners, staff and guardians, imported from a spreadsheet.' },
  { icon: GraduationCap, title: 'Student portal', detail: 'Learners see results, assignments, attendance and fees.' },
];

const BILLING: readonly { q: string; a: string }[] = [
  { q: 'What does “per term” mean?', a: 'You pay once for each school term you use Skulbase, whatever the size of your school.' },
  { q: 'Are there setup or per-learner fees?', a: 'No. The price covers every learner, teacher and module.' },
  { q: 'Who gets an account?', a: 'Administrators, class and subject teachers, staff and learners. Each role gets its own view of the school.' },
  { q: 'Have a question about billing?', a: 'Get in touch through the contact page and we will walk you through it.' },
];

/** One plan, what it includes, and how billing works. It used to be a single card styled inline. */
export default function PricingPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Plans & pricing"
        title="Simple, transparent"
        highlight="pricing."
        description={`One plan with everything included: ${SCHOOL_PLAN.price} ${SCHOOL_PLAN.period}. No hidden fees.`}
      />

      <Section className="pt-0 md:pt-0">
        <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-10">
          <article className="relative flex flex-col rounded-3xl border-2 border-primary bg-card p-6 shadow-2xl shadow-black/5 sm:p-8 dark:shadow-black/40">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[0.6875rem] font-bold tracking-widest text-primary-foreground uppercase">
              Every module
            </span>
            <h2 className="font-heading text-xl font-bold text-foreground">{SCHOOL_PLAN.name}</h2>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="font-heading text-4xl font-bold text-foreground sm:text-5xl">{SCHOOL_PLAN.price}</span>
              <span className="text-sm text-muted-foreground">{SCHOOL_PLAN.period}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{SCHOOL_PLAN.summary}</p>
            <ul className="my-6 flex flex-col gap-2.5">
              {INCLUDED.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <CtaLink href="/signup" className="w-full">Create your school</CtaLink>
            <CtaLink href="/contact" variant="outline" size="md" className="mt-3 w-full">Talk to us first</CtaLink>
          </article>

          <div>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              <Sparkles className="size-3.5" aria-hidden /> What you get
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {MODULES.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-3 rounded-2xl border border-border/70 bg-card/80 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
                  </span>
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
