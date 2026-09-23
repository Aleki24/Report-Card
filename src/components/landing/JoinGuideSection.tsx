import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BookOpen, GraduationCap, School } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/utils';
import { Section, SectionHeader } from './ui/Section';
import { TONES, type Tone } from './ui/tones';

type JoinPath = {
  icon: LucideIcon;
  audience: string;
  title: string;
  tone: Tone;
  steps: string[];
  ctaLabel: string;
  ctaHref: '/signup' | '/activate';
};

const PATHS: JoinPath[] = [
  {
    icon: School,
    audience: 'School administrators',
    title: 'Register your school',
    tone: 'primary',
    steps: [
      'Create an account with your email or Google',
      'Complete the guided setup — school details, calendar, classes and subjects',
      'Invite your teachers and students with one-time invite codes',
    ],
    ctaLabel: 'Create school account',
    ctaHref: '/signup',
  },
  {
    icon: BookOpen,
    audience: 'Teachers',
    title: 'Join with an invite code',
    tone: 'positive',
    steps: [
      'Ask your school administrator for your 6-character invite code',
      'Activate your account once — with Google or a username & password',
      'Sign in to manage your classes, marks and report cards',
    ],
    ctaLabel: 'Activate your account',
    ctaHref: '/activate',
  },
  {
    icon: GraduationCap,
    audience: 'Students',
    title: 'Activate your portal',
    tone: 'violet',
    steps: [
      'Get your personal invite code from your school',
      'Activate your account once — no second code needed later',
      'View your marks, report cards and progress anytime',
    ],
    ctaLabel: 'Activate your account',
    ctaHref: '/activate',
  },
];

export default function JoinGuideSection() {
  return (
    <Section id="how-to-join">
      <SectionHeader
        eyebrow="Getting started"
        title="Pick your"
        highlight="way in."
        description={
          <>
            Whether you run a school or belong to one, getting on <Wordmark /> takes just a few minutes.
          </>
        }
      />

      <ul className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {PATHS.map(({ icon: Icon, audience, title, tone: toneKey, steps, ctaLabel, ctaHref }) => {
          const tone = TONES[toneKey];
          return (
            <li
              key={title}
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:shadow-lg md:p-8',
                tone.hoverBorder,
              )}
            >
              <div className="mb-5 flex items-center gap-3.5">
                <span
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none',
                    tone.tile,
                    tone.text,
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">{audience}</p>
                  <h3 className="font-heading text-base font-bold tracking-tight text-foreground md:text-lg">{title}</h3>
                </div>
              </div>

              <ol className="mb-6 flex flex-1 flex-col gap-3">
                {steps.map((step, idx) => (
                  <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                    <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold', tone.tile, tone.text)}>
                      {idx + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              <Link
                href={ctaHref}
                className={cn(
                  'inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl border px-4 text-sm font-semibold transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  tone.outline,
                )}
              >
                {ctaLabel}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>

              {/* Accent line revealed on hover */}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100',
                  tone.bar,
                )}
              />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
