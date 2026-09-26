"use client";

import { cn } from '@/lib/utils';
import { hueForHref } from '@/components/ui/pageHues';
import { TONES } from '@/components/ui/tones';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  Users, GraduationCap, FileText, ArrowRight, BarChart3, ClipboardList, Wallet,
  BookOpen, Search, CheckCircle2, Send, Bell, Award, CalendarCheck, UserPlus, Megaphone, Briefcase,
  type LucideIcon,
} from 'lucide-react';
import type { Hue } from '@/components/ui/tones';
import type { TermSummary, UpcomingRound } from '@/app/api/school/dashboard/route';

interface DashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalUsers: number;
  totalClasses: number;
  totalReports: number;
  attendanceToday: { present: number; absent: number; late: number; excused: number } | null;
  upcomingExams: { id: string; name: string; exam_type: string; exam_date: string; subject_name: string; grade_name: string }[];
  recentActivities: { type: string; message: string; timestamp: string; href?: string }[];
  overdueFeesCount: number;
  announcementsLast7Days: number;
  recentEnrollmentsLast7: number;
  financeSummary: { totalCollected: number; unpaidBalance: number; overdueCount: number };
  academicSummary: { recentAvg: number | null; passRate: number | null; passMark: number; markCount: number };
  examsAwaitingMarks?: number;
  unmarkedByClass?: { label: string; levelCode: string | null; count: number }[];
  classPerformance?: ClassPerformance[];
  subjectsWithoutGradingSystem?: number;
  /**
   * Whether the school has ever recorded a fee or an attendance register.
   * Both features are unused on this instance — every school has zero fee
   * rows — so their cards are hidden until there is something to show rather
   * than rendering a permanent row of zeros.
   */
  hasFeeData?: boolean;
  hasAttendanceData?: boolean;
  hasLogo: boolean;
  setup: SetupStatus | null;
  /** Where the school is in its own calendar. */
  term?: TermSummary;
  /** Upcoming exams grouped into each class's sitting. */
  upcomingRounds?: UpcomingRound[];
  /** Exams this term with marks entered but not yet released. */
  unreleasedResults?: number;
}


import { DashboardSkeleton as LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import KpiTile from '@/components/dashboard/KpiTile';
import GradeResultsCard from '@/components/dashboard/GradeResultsCard';
import InsightCard from '@/components/dashboard/InsightCard';
import SectionTitle from '@/components/dashboard/SectionTitle';
import Link from 'next/link';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import type { SetupStatus } from '@/lib/setup-status';
import ClassPerformanceList, { type ClassPerformance } from '@/components/dashboard/ClassPerformanceList';
import TeacherDashboard from '@/components/dashboard/teacher/TeacherDashboard';

// ── Admin Dashboard ──────────────────────────────────────────
/*
  The school's command centre, built around the term.

  It used to open on a gradient banner whose only two buttons were "Generate
  Report Cards" and "Send SMS Results", as if that were all the app did, under
  a line saying the school was "running smoothly this term" whatever the data
  said, with a term name taken from a generic calendar. Marks outstanding,
  overdue fees and announcements each appeared three times over; a top bar
  repeated the profile the sidebar already shows.

  Now: where the school is in its own term, what needs doing (each item with
  its own action, and a clear "all caught up"), the figures once, and every
  common task given the same weight.
*/
function AdminDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school/dashboard');
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSkeleton />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const passRate = data?.academicSummary?.markCount ? data.academicSummary.passRate : null;
  const attendanceTotal = data?.attendanceToday ? totalAttendanceCount(data.attendanceToday) : 0;
  const presentRate = attendanceTotal > 0 && data?.attendanceToday ? Math.round((data.attendanceToday.present / attendanceTotal) * 100) : null;
  const billed = (data?.financeSummary?.totalCollected ?? 0) + (data?.financeSummary?.unpaidBalance ?? 0);
  const collectedRate = billed > 0 ? Math.round(((data?.financeSummary?.totalCollected ?? 0) / billed) * 100) : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-2 pb-8 sm:px-3 lg:px-4">
      <SetupChecklist
        hasLogo={data?.hasLogo ?? false}
        totalTeachers={data?.totalTeachers ?? 0}
        totalStudents={data?.totalStudents ?? 0}
        totalUsers={data?.totalUsers ?? 0}
        setup={data?.setup ?? null}
      />

      {/* Where the school is in its term */}
      <header className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{todayLabel}</p>
          <h1 className="mt-0.5 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">{greeting}, {userName || 'there'}</h1>
          <TermLine term={data?.term ?? null} />
        </div>
        <form
          onSubmit={e => { e.preventDefault(); if (searchQuery.trim()) router.push(`/dashboard/people?search=${encodeURIComponent(searchQuery.trim())}`); }}
          className="w-full lg:w-80"
          role="search"
        >
          <label className="relative block">
            <span className="sr-only">Find a learner</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              placeholder="Find a learner by name or admission no."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field input-icon-left w-full"
            />
          </label>
        </form>
      </header>

      {/* What needs doing */}
      <section aria-labelledby="todo-heading">
        <SectionTitle><span id="todo-heading">Needs your attention</span></SectionTitle>
        <TodoList data={data} />
      </section>

      {/* The figures, once */}
      {/* A grid rather than the 3-wide carousel: every figure in view at once. */}
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiTile title="Learners" value={(data?.totalStudents ?? 0).toLocaleString()} icon={<Users size={17} />} href="/dashboard/people" tone="blue" />
          <KpiTile title="Teachers" value={data?.totalTeachers ?? 0} icon={<GraduationCap size={17} />} href="/dashboard/people?tab=teachers" tone="purple" />
          <KpiTile title="Classes" value={data?.totalClasses ?? 0} icon={<BookOpen size={17} />} href="/dashboard/classes" tone="blue" />
          {passRate != null && (
            <KpiTile title={`Pass rate (≥${data?.academicSummary?.passMark ?? 50}%)`} value={`${passRate}%`} icon={<BarChart3 size={17} />} href="/dashboard/analytics" tone={passRate >= 70 ? 'green' : passRate >= 40 ? 'amber' : 'red'} />
          )}
          {data?.hasAttendanceData && presentRate != null && (
            <KpiTile title="Present today" value={`${presentRate}%`} icon={<CheckCircle2 size={17} />} href="/dashboard/attendance" tone="green" />
          )}
          {data?.hasFeeData && collectedRate != null && (
            <KpiTile title="Fees collected" value={`${collectedRate}%`} icon={<Wallet size={17} />} href="/dashboard/fees" tone={collectedRate >= 80 ? 'green' : 'amber'} />
          )}
      </section>

      {/* Every common task, the same weight */}
      <section aria-labelledby="actions-heading">
        <SectionTitle><span id="actions-heading">Quick actions</span></SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          {QUICK_ACTIONS.map(a => <QuickAction key={a.label} {...a} />)}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 lg:gap-5">
          <section>
            <SectionTitle>Class results</SectionTitle>
            <GradeResultsCard />
          </section>
          <InsightCard title="How classes are doing" meta={`${(data?.classPerformance ?? []).filter(c => c.markCount > 0).length} with marks`} action={{ label: 'Analytics', href: '/dashboard/analytics' }}>
            <ClassPerformanceList classes={data?.classPerformance ?? []} passMark={data?.academicSummary?.passMark ?? 50} />
          </InsightCard>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <InsightCard title="Coming up" meta="Next three weeks" action={{ label: 'Exams', href: '/dashboard/exams-marks' }}>
            <UpcomingRounds rounds={data?.upcomingRounds ?? []} />
          </InsightCard>
          <InsightCard title="Academic performance" meta="This year">
            <AcademicSummary summary={data?.academicSummary ?? null} />
          </InsightCard>
          {data?.hasAttendanceData && (
            <InsightCard title="Attendance today" meta={`${attendanceTotal} marked`}>
              <AttendanceBreakdown present={data.attendanceToday?.present ?? 0} absent={data.attendanceToday?.absent ?? 0} late={data.attendanceToday?.late ?? 0} excused={data.attendanceToday?.excused ?? 0} />
            </InsightCard>
          )}
          {data?.hasFeeData && (
            <InsightCard title="Fee collection" meta="Current term">
              <FinanceSnapshot collected={data.financeSummary?.totalCollected ?? 0} unpaid={data.financeSummary?.unpaidBalance ?? 0} overdue={data.financeSummary?.overdueCount ?? 0} />
            </InsightCard>
          )}
          <InsightCard title="Recent activity">
            <RecentActivity activities={data?.recentActivities ?? []} />
          </InsightCard>
        </div>
      </div>
    </div>
  );
}

function totalAttendanceCount(a: NonNullable<DashboardData['attendanceToday']>): number {
  return a.present + a.absent + a.late + a.excused;
}

/** "Term 3 · 2026 · Week 5 of 10 · 34 days left", or the break and when school reopens. */
function TermLine({ term }: { term: DashboardData['term'] | null }) {
  if (!term || term.kind === 'none') {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        No term dates set. <Link href="/dashboard/settings?tab=calendar" className="font-medium text-primary hover:underline">Add your terms</Link> to track the calendar.
      </p>
    );
  }
  if (term.kind === 'break') {
    const opens = term.nextStart ? new Date(`${term.nextStart}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : null;
    return (
      <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="rounded-full bg-amber-500/12 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">School break</span>
        {term.nextName && opens ? `${term.nextName} opens ${opens}` : 'No upcoming term dates set'}
      </p>
    );
  }
  const progress = Math.round((term.week / term.weeks) * 100);
  return (
    <div className="mt-2 max-w-md">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{[term.name, term.year].filter(Boolean).join(' · ')}</span>
        <span className="text-muted-foreground">Week {term.week} of {term.weeks} · {term.daysLeft === 0 ? 'ends today' : `${term.daysLeft} day${term.daysLeft === 1 ? '' : 's'} left`}</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-label="How far through the term" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

interface Todo { key: string; icon: LucideIcon; hue: Hue; title: string; detail: string; cta: string; href: string }

/** What only the school can move forward, most urgent first; empty means all caught up. */
function buildTodos(data: DashboardData | null): Todo[] {
  if (!data) return [];
  const todos: Todo[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  if ((data.unreleasedResults ?? 0) > 0) {
    todos.push({ key: 'release', icon: Send, hue: 'violet', title: `${plural(data.unreleasedResults ?? 0, 'exam')} ready to release`, detail: 'Marks are in, but report cards and parents can’t see them until released.', cta: 'Release results', href: '/dashboard/exams-marks?tab=publish' });
  }
  if ((data.examsAwaitingMarks ?? 0) > 0) {
    const worst = (data.unmarkedByClass ?? []).slice(0, 3).map(c => `${c.label} (${c.count})`).join(', ');
    todos.push({ key: 'marks', icon: ClipboardList, hue: 'amber', title: `${plural(data.examsAwaitingMarks ?? 0, 'paper')} still need marks`, detail: worst ? `Most behind: ${worst}.` : 'Exams sat but not yet marked.', cta: 'Enter marks', href: '/dashboard/exams-marks' });
  }
  if ((data.subjectsWithoutGradingSystem ?? 0) > 0) {
    todos.push({ key: 'grading', icon: Award, hue: 'rose', title: `${plural(data.subjectsWithoutGradingSystem ?? 0, 'subject')} without a grading scale`, detail: 'No grade can be printed on report cards for these.', cta: 'Set grading', href: '/dashboard/settings?tab=grading' });
  }
  const inTerm = data.term?.kind === 'in-term';
  const weekday = ![0, 6].includes(new Date().getDay());
  const marked = data.attendanceToday ? totalAttendanceCount(data.attendanceToday) : 0;
  const unmarked = Math.max(0, data.totalStudents - marked);
  if (data.hasAttendanceData && inTerm && weekday && unmarked > 0) {
    todos.push({ key: 'attendance', icon: CalendarCheck, hue: 'emerald', title: `${plural(unmarked, 'learner')} not on today’s register`, detail: marked === 0 ? 'No register has been taken yet today.' : `${marked.toLocaleString()} marked so far.`, cta: 'Take attendance', href: '/dashboard/attendance' });
  }
  if (data.hasFeeData && data.overdueFeesCount > 0) {
    todos.push({ key: 'fees', icon: Wallet, hue: 'orange', title: `${plural(data.overdueFeesCount, 'fee record')} overdue`, detail: 'Past the due date with a balance still owing.', cta: 'Review fees', href: '/dashboard/fees' });
  }
  return todos;
}

function TodoList({ data }: { data: DashboardData | null }) {
  const todos = buildTodos(data);
  if (todos.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" aria-hidden><CheckCircle2 className="size-5" /></span>
        <div>
          <p className="text-sm font-semibold text-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground">Every exam sat has marks, results are released and nothing is overdue.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {todos.map(({ key, icon: Icon, hue, title, detail, cta, href }) => (
        <li key={key} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', TONES[hue].tile)} aria-hidden><Icon className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
            </div>
          </div>
          <Link href={href} className="btn-secondary mt-auto h-9 w-full text-sm no-underline sm:w-fit">
            {cta}<ArrowRight className="size-4" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Enter marks', href: '/dashboard/exams-marks', icon: ClipboardList },
  { label: 'Report cards', href: '/dashboard/reports', icon: FileText },
  { label: 'Attendance', href: '/dashboard/attendance', icon: CalendarCheck },
  { label: 'Add learner', href: '/dashboard/people', icon: UserPlus },
  { label: 'Add staff', href: '/dashboard/people?tab=teachers', icon: GraduationCap },
  { label: 'Announcement', href: '/dashboard/announcements', icon: Megaphone },
  { label: 'Assignment', href: '/dashboard/assignments', icon: Briefcase },
  { label: 'Record payment', href: '/dashboard/fees', icon: Wallet },
];

function QuickAction({ label, href, icon: Icon }: { label: string; href: string; icon: LucideIcon }) {
  const tone = TONES[hueForHref(href)];
  return (
    <Link href={href} className={cn('group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md xl:flex-col xl:items-start xl:gap-2 xl:py-3', tone.hover)}>
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone.tile)} aria-hidden><Icon className="size-4" /></span>
      <span className="text-xs font-semibold leading-tight text-foreground sm:text-sm">{label}</span>
    </Link>
  );
}

function UpcomingRounds({ rounds }: { rounds: NonNullable<DashboardData['upcomingRounds']> }) {
  if (rounds.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">No exams in the next three weeks.</p>;
  return (
    <ul className="-mx-1 flex flex-col">
      {rounds.map(r => {
        const date = new Date(`${r.firstDate}T00:00:00`);
        return (
          <li key={r.key} className="flex items-center gap-3 rounded-xl px-1 py-2">
            <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted/60 py-1 text-center" aria-hidden>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
              <span className="text-base font-bold leading-none text-foreground">{date.getDate()}</span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{r.className} · {r.label}</p>
              <p className="text-xs text-muted-foreground">{r.papers} paper{r.papers === 1 ? '' : 's'} · from {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RecentActivity({ activities }: { activities: DashboardData['recentActivities'] }) {
  if (activities.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">Nothing yet this year.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {activities.slice(0, 5).map((act, i) => {
        const row = (
          <>
            <span className="min-w-0 flex-1 text-[13px] text-foreground/85">{act.message}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{new Date(act.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </>
        );
        return (
          <li key={i} className="py-2">
            {act.href ? <Link href={act.href} className="flex items-start gap-3 no-underline hover:text-primary">{row}</Link> : <div className="flex items-start gap-3">{row}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/* Segment order keeps good (present) and bad (absent) non-adjacent so the
   stacked bar stays readable under red–green color-vision deficiency. */
const ATTENDANCE_SEGMENTS = [
  { key: 'present', label: 'Present', color: 'var(--viz-good)' },
  { key: 'late', label: 'Late', color: 'var(--viz-warn)' },
  { key: 'excused', label: 'Excused', color: 'var(--viz-info)' },
  { key: 'absent', label: 'Absent', color: 'var(--viz-bad)' },
] as const;

function AttendanceBreakdown({ present, absent, late, excused }: { present: number; absent: number; late: number; excused: number }) {
  const counts = { present, late, excused, absent };
  const total = present + absent + late + excused;

  if (total === 0) {
    return <div className="py-6 text-center text-sm italic text-muted-foreground">No attendance marked yet today</div>;
  }

  const rate = Math.round((present / total) * 100);

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold leading-none tracking-tight text-foreground sm:text-4xl">{rate}%</span>
        <span className="text-xs text-muted-foreground">present rate</span>
      </div>
      <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Attendance: ${present} present, ${late} late, ${excused} excused, ${absent} absent`}>
        {ATTENDANCE_SEGMENTS.filter(s => counts[s.key] > 0).map(s => (
          <div
            key={s.key}
            title={`${s.label}: ${counts[s.key]}`}
            style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:flex sm:flex-wrap">
        {ATTENDANCE_SEGMENTS.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-xs font-semibold text-foreground">{counts[s.key]}</span>
            <span className="text-xs text-muted-foreground">{s.label.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceSnapshot({ collected, unpaid, overdue }: { collected: number; unpaid: number; overdue: number }) {
  const billed = collected + unpaid;
  const rate = billed > 0 ? Math.round((collected / billed) * 100) : null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-xl font-bold leading-none tracking-tight text-foreground sm:text-2xl">{formatCurrency(collected)}</div>
          <div className="mt-1.5 text-[11px] text-muted-foreground sm:text-xs">Collected</div>
        </div>
        <div className="min-w-0 text-right">
          <div className="truncate text-base font-semibold leading-none tracking-tight text-foreground sm:text-lg">{formatCurrency(unpaid)}</div>
          <div className="mt-1.5 text-[11px] text-muted-foreground sm:text-xs">Outstanding</div>
        </div>
      </div>
      {rate !== null ? (
        <>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-primary/15">
            <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{rate}% of billed fees collected</div>
        </>
      ) : (
        <div className="mt-4 text-xs italic text-muted-foreground">No fees billed yet this term</div>
      )}
      <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: overdue > 0 ? 'var(--viz-warn)' : 'var(--viz-good)' }} />
        {overdue > 0 ? (
          <Link href="/dashboard/fees" className="text-xs font-medium text-foreground no-underline hover:text-primary">
            {overdue} {overdue === 1 ? 'invoice' : 'invoices'} overdue — review
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">No overdue invoices</span>
        )}
      </div>
    </div>
  );
}

/**
 * Leads with pass rate rather than the mean mark.
 *
 * The mean blends every subject, exam type and paper difficulty into one
 * number, so it mostly reflects how hard the papers were: a perfectly healthy
 * school reads 46%. It used to be painted with the danger colour below 60,
 * which turned a normal term into a full-width red bar — and the label
 * disagreed with it, calling the same 46% "Fair". Pass rate answers a question
 * an admin can act on: how many learners are at or above the pass mark.
 */
function AcademicSummary({ summary }: { summary: DashboardData['academicSummary'] | null }) {
  if (!summary || summary.markCount === 0 || summary.passRate == null) {
    return <div className="py-6 text-center text-sm italic text-muted-foreground">No exam data yet</div>;
  }

  const { passRate, recentAvg, passMark, markCount } = summary;

  // Red is reserved for a result that genuinely needs attention. The old card
  // went red below 60% of the mean, which is where an ordinary term sits, so a
  // healthy school was met with a full-width red bar every morning. Below 40%
  // of learners reaching the pass mark is a real signal; a little under half is
  // something to watch, not an alarm.
  const tone = passRate >= 70 ? 'var(--viz-good)' : passRate >= 40 ? 'var(--viz-warn)' : 'var(--viz-bad)';
  const label = passRate >= 70 ? 'On track' : passRate >= 40 ? 'Room to improve' : 'Needs attention';

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-bold leading-none tracking-tight text-foreground sm:text-4xl">{passRate}%</span>
        <span className="text-xs text-muted-foreground">of marks at or above {passMark}%</span>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)` }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(passRate, 100)}%`, background: tone }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </span>
        {recentAvg != null && (
          <span className="text-xs text-muted-foreground">
            {recentAvg}% average across {markCount.toLocaleString()} mark{markCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function DashboardPage() {
  const { profile, role, loading } = useAuth();
  const router = useRouter();
  const userName = profile ? `${profile.first_name}` : '';

  useEffect(() => {
    // /student/dashboard is the canonical student home. Students can end up on this
    // shared /dashboard route via the "Dashboard" nav link (which every role has) or
    // a stale Clerk session-claim role that middleware's edge redirect misses — this
    // client-side check reads the real role from AuthProvider (backed by Supabase, not
    // the JWT), so it catches those cases and avoids ever rendering a student-facing
    // dashboard here.
    if (!loading && role === 'STUDENT') {
      router.replace('/student/dashboard');
      return;
    }
    // A user who signed up but never finished redeeming an invite code stays in role
    // 'PENDING'. Nothing else routes them back to onboarding (e.g. "Sign in with
    // Google" from the login page always completes to /dashboard), and 'PENDING'
    // doesn't match isAdmin or any other branch below, so without this they'd land
    // on a permanently blank page with no error and no way forward.
    if (!loading && role === 'PENDING') {
      router.replace('/dashboard/onboarding');
    }
  }, [loading, role, router]);

  if (loading || role === 'STUDENT' || role === 'PENDING') return <div style={{ padding: 'var(--space-6)' }}><LoadingSkeleton /></div>;

  // STAFF (non-teaching staff: bursar, secretary, etc.) is not an admin — it
  // only ever sees the light staff landing below, never the admin dashboard.
  const isAdmin = role === 'ADMIN';

  return (
    <div className="flex-1 p-2 md:p-6 lg:p-8 pt-1">
      {isAdmin && <AdminDashboard userName={userName} />}
      {role === 'CLASS_TEACHER' && <TeacherDashboard variant="class" />}
      {role === 'SUBJECT_TEACHER' && <TeacherDashboard variant="subject" />}
      {role === 'STAFF' && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-1 pt-2 sm:px-2">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 px-5 py-7 text-white shadow-sm sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-white/10" aria-hidden />
            <p className="relative text-xs font-medium text-white/75 sm:text-sm">{profile?.job_title || 'Staff'}</p>
            <h1 className="relative mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Welcome{userName ? `, ${userName}` : ''}</h1>
            <p className="relative mt-1.5 max-w-lg text-sm text-white/85">Keep up with school news here. Your administrator can give you more access when you need it.</p>
          </section>
          <Link href="/dashboard/announcements" className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 no-underline shadow-sm transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell size={20} aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground group-hover:text-primary">Announcements</span>
              <span className="block text-xs text-muted-foreground">Read the latest notices from the school</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}
