"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck,
  CheckCircle2,
  FileText,
  MessageSquareText,
  Smartphone,
  Users,
} from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { modules } from '@/lib/modules';
import { cn } from '@/lib/utils';
import { CtaLink } from './ui/CtaLink';
import { Eyebrow } from './ui/Section';

const TRUST_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: CheckCircle2, label: 'CBC & 8-4-4' },
  { icon: Users, label: 'Students, teachers & classes' },
  { icon: CalendarCheck, label: 'Exams & attendance' },
  { icon: FileText, label: 'Report cards & analytics' },
  { icon: Smartphone, label: 'Parents kept in the loop' },
];

type Stat = { value: number; prefix?: string; suffix?: string; label: string };

// Outcome-led figures a head teacher weighs when buying — all true of the product today.
const STATS: Stat[] = [
  { value: modules.filter((m) => m.status === 'active' && m.slug !== 'settings').length, label: 'Modules under one login' },
  { value: 1, label: 'Click to print a whole class’s report cards' },
  { value: 2, label: 'Curricula supported — CBC & 8-4-4' },
  { value: 5000, prefix: 'KES ', label: 'Per term, every module included' },
];

// Grade 8 is CBC junior school — marks map to KNEC performance levels
// (EE: Exceeding Expectations, ME: Meeting Expectations), not 8-4-4 letters.
type PerformanceLevel = 'EE' | 'ME';

const MOCK_MARKS: { subject: string; score: number; level: PerformanceLevel }[] = [
  { subject: 'Mathematics', score: 84, level: 'EE' },
  { subject: 'English', score: 76, level: 'ME' },
  { subject: 'Kiswahili', score: 81, level: 'EE' },
  { subject: 'Int. Science', score: 88, level: 'EE' },
  { subject: 'Social Studies', score: 72, level: 'ME' },
];

const LEVEL_CLASSES: Record<PerformanceLevel, string> = {
  EE: 'bg-positive/10 text-positive',
  ME: 'bg-primary/10 text-primary',
};

const MOCK_TABS = ['Dashboard', 'People', 'Marks', 'Attendance', 'Reports', 'Analytics'] as const;
const ACTIVE_TAB: (typeof MOCK_TABS)[number] = 'Marks';

const MOCK_SUMMARY = [
  { label: 'Average', value: '80.2%' },
  { label: 'Rank', value: '3 / 42' },
];

/** Glassy surface shared by the mock panel and its floating chips. */
const GLASS = 'border border-border bg-white/95 backdrop-blur-md dark:bg-card/90';

/** Pointer state fed to CSS as custom properties — tilt in degrees, sheen in %. */
type TiltVars = CSSProperties & Record<'--rx' | '--ry' | '--gx' | '--gy', string>;
const REST = { rx: 0, ry: 0, gx: 50, gy: 50 };

/** Eased count-up that starts when `run` flips true. */
function useCountUp(target: number, run: boolean, durationMs = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    // Reduced motion jumps straight to the final value (t = 1 on the first frame).
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationMs;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs]);
  return value;
}

function StatValue({ value, prefix = '', suffix = '', run }: Omit<Stat, 'label'> & { run: boolean }) {
  const n = useCountUp(value, run);
  return (
    <>
      {prefix}
      {n.toLocaleString('en-KE')}
      {suffix}
    </>
  );
}

type FloatingChipProps = {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  className: string;
};

/** Small status card hovering in front of the mock panel. */
function FloatingChip({ icon: Icon, iconClassName, title, subtitle, className }: FloatingChipProps) {
  return (
    <div className={cn('absolute z-3 animate-float items-center gap-2.5 rounded-xl px-4 py-3 shadow-2xl shadow-black/25', GLASS, className)}>
      <span className={cn('flex size-8.5 shrink-0 items-center justify-center rounded-lg', iconClassName)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-xs font-bold text-foreground">{title}</p>
        <p className="text-[0.6875rem] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** A marks screen standing in for the product — one tab of a much bigger system. */
function MockMarksPanel() {
  return (
    <div className={cn('relative z-2 overflow-hidden rounded-2xl shadow-[0_32px_90px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_90px_rgba(0,0,0,0.55)]', GLASS)}>
      {/* Pointer-following sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-1 bg-[radial-gradient(480px_circle_at_var(--gx)_var(--gy),rgba(255,255,255,0.55),transparent_60%)] dark:bg-[radial-gradient(480px_circle_at_var(--gx)_var(--gy),rgba(255,255,255,0.06),transparent_60%)]"
      />

      {/* Module tabs — swipeable on narrow screens; must never widen the page */}
      <div className="landing-mock-tabs flex items-center gap-1 overflow-x-auto border-b border-border/60 px-3.5 pt-2.5">
        {MOCK_TABS.map((tab) => (
          <span
            key={tab}
            className={cn(
              'border-b-2 px-2.5 pt-1.5 pb-2 text-[0.6875rem] whitespace-nowrap',
              tab === ACTIVE_TAB ? 'border-primary font-bold text-primary' : 'border-transparent font-medium text-muted-foreground',
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-4">
        <div>
          <p className="font-heading text-[0.9375rem] font-bold tracking-tight text-foreground">End-Term Marks — Grade 8 East</p>
          <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">42 students · 5 subjects · CBC Junior School</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.6875rem] font-semibold whitespace-nowrap text-primary">Term 2 · 2026</span>
      </div>

      <ul className="divide-y divide-border/60 px-5 py-2">
        {MOCK_MARKS.map((row) => (
          <li key={row.subject} className="flex items-center justify-between gap-3 py-2.75">
            <span className="flex-1 text-[0.8125rem] font-medium text-foreground">{row.subject}</span>
            <span className="hidden h-1.25 w-24 overflow-hidden rounded-full bg-border/60 xs:block">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-primary to-positive"
                style={{ width: `${row.score}%` }}
              />
            </span>
            <span className="w-8 text-right font-mono text-[0.8125rem] text-muted-foreground">{row.score}</span>
            <span className={cn('w-8.5 rounded-md py-0.75 text-center text-[0.6875rem] font-bold', LEVEL_CLASSES[row.level])}>{row.level}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/60 bg-black/[0.015] px-5 py-3.5 dark:bg-white/[0.02]">
        <dl className="flex items-center gap-3.5 divide-x divide-border/60">
          {MOCK_SUMMARY.map(({ label, value }) => (
            <div key={label} className="pr-3.5 last:pr-0">
              <dt className="text-[0.625rem] tracking-widest text-muted-foreground uppercase">{label}</dt>
              <dd className="text-sm font-bold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <span className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground">
          <FileText className="size-3.5" aria-hidden />
          Generate Report Cards
        </span>
      </div>
    </div>
  );
}

export default function HeroSection() {
  // ---- Pointer-driven 3D tilt for the product mock ----
  const tiltRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState(REST);
  const handleTilt = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const rect = tiltRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -y * 7, ry: x * 9, gx: (x + 0.5) * 100, gy: (y + 0.5) * 100 });
  }, []);
  const resetTilt = useCallback(() => setTilt(REST), []);

  const tiltVars: TiltVars = {
    '--rx': `${tilt.rx}deg`,
    '--ry': `${tilt.ry}deg`,
    '--gx': `${tilt.gx}%`,
    '--gy': `${tilt.gy}%`,
  };

  // ---- Count-up trigger when the stats strip scrolls into view ----
  const statsRef = useRef<HTMLDListElement>(null);
  const [statsInView, setStatsInView] = useState(false);
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const marqueeItems = modules.filter((m) => m.slug !== 'settings').map((m) => m.title);

  return (
    <section className="px-4 pt-26 pb-10 sm:px-6 md:pt-32 md:pb-16 lg:px-12 lg:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-12 lg:gap-14">
        {/* ============ LEFT — COPY ============ */}
        <div className="flex min-w-0 animate-fade-in-up flex-col items-center gap-4 text-center md:gap-6 lg:col-span-6 lg:items-start lg:text-left">
          {/* Rule only when left-aligned; centred mobile copy wraps and a lone rule looks stray */}
          <Eyebrow leading={<span aria-hidden className="hidden h-px w-8 shrink-0 bg-primary lg:block" />}>
            The Complete School Management System · Kenya
          </Eyebrow>

          <h1 className="font-heading text-4xl leading-[1.06] font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
            Your entire school, <span className="text-primary italic">running on one dashboard.</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Students, teachers, classes, subjects, exams, attendance, analytics and report cards — <Wordmark /> runs the
            whole term in one place, on CBC or 8-4-4, and keeps parents in the loop by SMS.
          </p>

          <div className="flex w-full flex-col gap-3.5 pt-1 sm:w-auto sm:flex-row">
            <CtaLink href="/signup">Register Your School</CtaLink>
            <CtaLink href="/activate" variant="outline">
              I Have an Invite Code
            </CtaLink>
          </div>

          <p className="text-sm text-muted-foreground">
            KES 5,000 per term · every module included. <br className="sm:hidden" />
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none">
              Sign in
            </Link>
          </p>

          <ul className="flex flex-wrap justify-center gap-2 pt-2 lg:justify-start">
            {TRUST_CHIPS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <Icon className="size-3.5 text-primary" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* ============ RIGHT — PRODUCT MOCK (pointer-tilt 3D scene) ============ */}
        <div
          ref={tiltRef}
          aria-hidden
          className="relative min-w-0 animate-scale-in py-6 perspective-[1400px] animation-delay-200 lg:col-span-6"
          style={tiltVars}
          onPointerMove={handleTilt}
          onPointerLeave={resetTilt}
        >
          <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[radial-gradient(circle,var(--color-accent-glow)_0%,transparent_70%)] opacity-60 blur-[100px] dark:opacity-90" />

          <div className="relative transform-3d transition-transform duration-250 ease-out [transform:rotateX(var(--rx))_rotateY(var(--ry))] motion-reduce:[transform:none]">
            {/* Floating 3D asset — glass grade report */}
            <div className="absolute -top-9 -right-2 z-3 hidden size-24 rotate-6 animate-float overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/35 translate-z-[70px] sm:block md:size-34">
              <Image src="/images/dashboard_marks_icon.png" alt="" fill sizes="136px" className="object-cover" />
            </div>

            <MockMarksPanel />

            {/* Chips sit over the panel's empty zones (tab strip, footer middle), never over data */}
            <FloatingChip
              icon={CheckCircle2}
              iconClassName="bg-positive/10 text-positive"
              title="42 report cards ready"
              subtitle="Generated in one click"
              className="-bottom-8 left-[30%] hidden translate-z-[56px] [animation-delay:1.5s] sm:flex"
            />
            <FloatingChip
              icon={MessageSquareText}
              iconClassName="bg-primary/10 text-primary"
              title="Results sent by SMS"
              subtitle="Straight to every parent"
              className="-top-8 -left-6 hidden translate-z-[84px] [animation-delay:3s] md:flex"
            />
          </div>
        </div>
      </div>

      {/* ============ STATS STRIP (count-up on scroll) ============ */}
      <dl
        ref={statsRef}
        className="mx-auto mt-12 grid max-w-7xl animate-fade-in-up grid-cols-2 gap-4 border-t border-border/60 pt-6 animation-delay-400 md:mt-20 md:gap-6 md:pt-10 lg:grid-cols-4"
      >
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse text-center lg:text-left">
            <dt className="mt-1.5 text-[0.8125rem] text-muted-foreground">{stat.label}</dt>
            <dd className="font-heading text-3xl leading-tight font-bold tracking-tight text-primary md:text-4xl">
              <StatValue value={stat.value} prefix={stat.prefix} suffix={stat.suffix} run={statsInView} />
            </dd>
          </div>
        ))}
      </dl>

      {/* ============ MODULE MARQUEE ============ */}
      <div className="landing-marquee mx-auto mt-8 max-w-7xl md:mt-14" aria-hidden>
        <div className="landing-marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="inline-flex items-center">
              {marqueeItems.map((title) => (
                <span
                  key={`${copy}-${title}`}
                  className="inline-flex items-center gap-11 px-5.5 font-heading text-base font-semibold tracking-wide text-muted-foreground md:text-lg"
                >
                  {title}
                  <span className="text-xs text-primary">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
