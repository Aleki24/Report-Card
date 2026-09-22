import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, SectionHeader } from './ui/Section';
import { TONES, type Tone } from './ui/tones';

type Feature = {
  kicker: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  tone: Tone;
  points: string[];
};

const FEATURES: Feature[] = [
  {
    kicker: 'Mark Entry',
    title: 'Marks entry that keeps up with your teachers',
    description:
      'Whether it\'s one subject or the whole exam, marks go in fast — and only the students who actually take a subject show up on its list.',
    image: '/images/dashboard_marks_icon.png',
    imageAlt: 'Glass 3D grade report with a pen',
    tone: 'violet',
    points: [
      'Quick grid entry per subject and class',
      'Bulk upload marks from CSV in seconds',
      'Snap a photo of a handwritten marksheet — we read it',
      'Electives scoped to their actual takers',
    ],
  },
  {
    kicker: 'Report Cards',
    title: 'Report cards parents actually keep',
    description:
      'Auto-graded against your own CBC or 8-4-4 grading scales, laid out on polished templates, and generated for the whole class in one click.',
    image: '/images/dashboard_report_icon.png',
    imageAlt: 'Glowing 3D analytics report on a clipboard',
    tone: 'positive',
    points: [
      'Multiple professional PDF templates',
      'School logo, grading key and teacher comments included',
      'Class-wide generation in a single click',
      'Delivered to parents by SMS or download',
    ],
  },
  {
    kicker: 'Onboarding',
    title: 'Onboard the whole school in an afternoon',
    description:
      'Import your student roll from a spreadsheet, and every teacher, student and guardian gets a one-time invite code — by SMS or email — to activate their own account.',
    image: '/images/dashboard_bulk_icon.png',
    imageAlt: 'Colorful stack of 3D books tied with a ribbon',
    tone: 'caution',
    points: [
      'Bulk CSV import for students',
      'Usernames generated automatically',
      'Invite codes delivered by SMS and email',
      'Role-based access from day one',
    ],
  },
];

export default function ShowcaseSection() {
  return (
    <Section id="showcase">
      <SectionHeader
        eyebrow="See it in action"
        title="Everything a school runs on,"
        highlight="working together."
        description="From enrollment on day one to results on closing day — marks, report cards and onboarding share one system, so nothing is retyped twice."
      />

      <div className="flex flex-col gap-16 md:gap-24">
        {FEATURES.map((feature, idx) => {
          const tone = TONES[feature.tone];
          return (
            <article
              key={feature.kicker}
              className={cn('flex flex-col items-center gap-8 md:gap-12 lg:gap-16', idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row')}
            >
              {/* Image panel */}
              <div className="relative w-full lg:w-1/2">
                <div aria-hidden className={cn('absolute inset-[15%] rounded-full opacity-15 blur-[80px] dark:opacity-25', tone.glow)} />
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border shadow-2xl shadow-black/10 transition-transform duration-500 hover:scale-[1.015] motion-reduce:transition-none dark:shadow-black/50">
                  <Image src={feature.image} alt={feature.imageAlt} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                  <span className="absolute top-4 left-4 rounded-full border border-white/15 bg-black/45 px-3.5 py-1.5 text-xs font-semibold tracking-[0.15em] text-white uppercase backdrop-blur-md">
                    {feature.kicker}
                  </span>
                </div>
              </div>

              {/* Copy */}
              <div className="w-full text-center lg:w-1/2 lg:text-left">
                <h3 className="mb-4 font-heading text-2xl leading-tight font-bold tracking-tight text-foreground md:text-3xl">{feature.title}</h3>
                <p className="mb-6 text-base leading-relaxed text-muted-foreground">{feature.description}</p>
                <ul className="mb-7 inline-flex flex-col items-start gap-3 text-left">
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm leading-normal text-muted-foreground">
                      <CheckCircle2 className={cn('mt-0.5 size-4 shrink-0', tone.text)} aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
                <div>
                  <Link
                    href="/features"
                    className="group inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary transition-opacity hover:opacity-80 focus-visible:underline focus-visible:outline-none"
                  >
                    See it in detail
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
