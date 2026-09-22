import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BookOpen, CheckCircle2, Heart, ShieldCheck, Users } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/utils';
import { Section, SectionHeader } from './ui/Section';
import { TONES, type Tone } from './ui/tones';

type Role = {
  label: string;
  title: string;
  description: string;
  icons: { icon: LucideIcon; tone: Tone }[];
  tone: Tone;
  features: string[];
};

const ROLES: Role[] = [
  {
    label: 'Full control',
    title: 'Administrator',
    description:
      'Complete school management — academics, users, settings, and system-wide analytics from a single command center.',
    icons: [{ icon: ShieldCheck, tone: 'primary' }],
    tone: 'primary',
    features: [
      'School structure & grading config',
      'Teacher and student management',
      'Report card generation & export',
      'Global analytics & performance insights',
    ],
  },
  {
    label: 'Streamlined input',
    title: 'Teachers',
    description:
      'Dedicated interface for marks entry, attendance tracking, report generation, and class performance monitoring.',
    icons: [
      { icon: BookOpen, tone: 'positive' },
      { icon: Users, tone: 'violet' },
    ],
    tone: 'positive',
    features: ['Rapid exam marks input', 'Daily attendance marking', 'Class performance overview', 'Report card comments & generation'],
  },
  {
    label: 'Connected access',
    title: 'Students & Parents',
    description:
      "Personalized dashboards for students to track progress and for parents to stay connected with their child's academic journey.",
    icons: [{ icon: Heart, tone: 'violet' }],
    tone: 'violet',
    features: [
      'Personal academic performance view',
      'Report card download access',
      'Subject-wise analytics & trends',
      'Parent portal access (coming soon)',
    ],
  },
];

/** How many headline features each card lists before "See all features". */
const VISIBLE_FEATURES = 2;

export default function RolesSection() {
  return (
    <div className="relative">
      {/* Band that lifts this section off the page background */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background via-card/60 to-background dark:via-card" />

      <Section id="roles" className="relative">
        <SectionHeader
          eyebrow="Role-based access"
          title="Dedicated portals,"
          highlight="tailored experience."
          description={
            <>
              <Wordmark /> scopes access and tools to match each user&apos;s responsibilities.
            </>
          }
        />

        <ul className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {ROLES.map((role) => {
            const tone = TONES[role.tone];
            return (
              <li
                key={role.title}
                className={cn(
                  'flex flex-col rounded-2xl border border-border bg-card p-6 shadow-lg shadow-black/5 transition-colors duration-500 md:p-8 dark:shadow-black/30',
                  tone.hoverBorder,
                )}
              >
                <div className="mb-7 flex gap-3">
                  {role.icons.map(({ icon: Icon, tone: iconTone }) => (
                    <span
                      key={iconTone}
                      className={cn('flex size-13 items-center justify-center rounded-xl border', TONES[iconTone].tile, TONES[iconTone].text)}
                    >
                      <Icon className="size-6" aria-hidden />
                    </span>
                  ))}
                </div>

                <span className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{role.label}</span>
                <h3 className="mt-2 mb-3 font-heading text-lg font-bold tracking-tight text-foreground md:text-xl">{role.title}</h3>
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{role.description}</p>

                <ul className="mb-4 flex flex-1 flex-col gap-2.5">
                  {role.features.slice(0, VISIBLE_FEATURES).map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 className={cn('size-4 shrink-0', tone.text)} aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/features"
                  className={cn(
                    'group inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:underline focus-visible:outline-none',
                    tone.text,
                  )}
                >
                  See all features
                  <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
