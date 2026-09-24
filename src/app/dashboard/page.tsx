"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Avatar } from '@/components/Avatar';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui';
import {
  Users, GraduationCap, Building2, FileText, CalendarCheck, Calendar,
  ArrowRight, BarChart3, ClipboardList, Wallet, Bell,
  BookOpen, Search, CheckCircle2, Plus, MessageSquare,
} from 'lucide-react';

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
}


import { DashboardSkeleton as LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import ListPanel from '@/components/dashboard/ListPanel';
import EmptyState from '@/components/dashboard/EmptyState';
import KpiTile from '@/components/dashboard/KpiTile';
import KpiCarousel from '@/components/dashboard/KpiCarousel';
import GradeResultsCard from '@/components/dashboard/GradeResultsCard';
import InsightCard from '@/components/dashboard/InsightCard';
import SectionTitle from '@/components/dashboard/SectionTitle';
import Link from 'next/link';
import { getCurrentTermName } from '@/lib/term-calendar';
import { SetupChecklist } from '@/components/dashboard/SetupChecklist';
import type { SetupStatus } from '@/lib/setup-status';
import ClassPerformanceList, { type ClassPerformance } from '@/components/dashboard/ClassPerformanceList';
import OutstandingMarks from '@/components/dashboard/OutstandingMarks';
import { InfoGuide } from '@/components/ui/InfoGuide';

function UpcomingExamsCard({ exams }: { exams: DashboardData['upcomingExams'] }) {
  const [now] = useState(() => Date.now());

  if (exams.length === 0) {
    return (
      <ListPanel title="Upcoming Exams" actionLabel="Schedule" actionHref="/dashboard/exams-marks" className="h-full">
        <EmptyState title="No upcoming exams" description="Scheduled exams will appear here with clear date blocks." />
      </ListPanel>
    );
  }

  const displayExams = exams.slice(0, 5);

  return (
    <ListPanel title="Upcoming Exams" actionLabel="View all" actionHref="/dashboard/exams-marks" className="h-full">
      <div className="flex flex-col gap-3">
        {displayExams.map(exam => {
          const date = new Date(exam.exam_date);
          const month = date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
          const day = date.toLocaleDateString('en-GB', { day: '2-digit' });
          const isSoon = (date.getTime() - now) < 3 * 24 * 60 * 60 * 1000;
          return (
            <div
              key={exam.id}
              className={`flex items-center gap-3 rounded-xl border p-[5px] transition-colors hover:bg-muted/55 ${isSoon ? 'border-amber-500/25 bg-amber-500/10' : 'border-border/55 bg-muted/35'}`}
            >
              <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border bg-card/80 ${isSoon ? 'border-amber-500/30 text-amber-600' : 'border-border/60 text-muted-foreground'}`}>
                <span className="text-[10px] font-bold leading-none tracking-[0.12em]">{month}</span>
                <span className="text-base font-bold leading-none tracking-tight">{day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold tracking-tight text-foreground">{exam.name}</div>
                <div className="truncate text-xs leading-relaxed text-muted-foreground">
                  {exam.subject_name} &middot; {exam.grade_name}
                </div>
              </div>
              {isSoon && <Badge variant="warning">SOON</Badge>}
            </div>
          );
        })}
      </div>
    </ListPanel>
  );
}

function RecentActivitiesCard({ activities, viewAllHref }: { activities: DashboardData['recentActivities']; viewAllHref?: string }) {
  if (activities.length === 0) {
    return (
      <ListPanel title="Recent Activity" className="h-full">
        <EmptyState title="No recent activity" description="Activity such as marks, students, and report cards will be listed here." />
      </ListPanel>
    );
  }

  const displayActivities = activities.slice(0, 5);

  return (
    <ListPanel title="Recent Activity" actionLabel={viewAllHref ? 'View all' : undefined} actionHref={viewAllHref} className="h-full">
      <div className="flex flex-col gap-3">
        {displayActivities.map((act, i) => {
          const date = new Date(act.timestamp);
          const timeAgo = getTimeAgo(date);
          return (
            <div
              key={i}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/55 bg-muted/35 p-[5px] transition-colors hover:bg-muted/55"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium tracking-tight text-foreground">{act.message}</div>
                <div className="text-xs leading-relaxed text-muted-foreground">School activity update</div>
              </div>
              <div className="shrink-0 text-xs font-medium text-muted-foreground">{timeAgo}</div>
            </div>
          );
        })}
      </div>
    </ListPanel>
  );
}

function getTimeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function QuickAction({ label, desc, href, icon }: { label: string; desc: string; href: string; icon: React.ReactNode }) {
  return (
    <a href={href} className="group block h-full no-underline">
      <div className="flex h-full items-center gap-3 rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/50 hover:shadow-md">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">{label}</div>
          <div className="text-xs leading-relaxed text-muted-foreground">{desc}</div>
        </div>
        <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
      </div>
    </a>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────
function AdminDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const { profile, role } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/school/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSkeleton />;

  const greetingName = userName || 'Admin';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="relative px-2 sm:px-3 lg:px-4 pb-2 sm:pb-3 lg:pb-4 bg-background text-foreground flex flex-col">
      <SetupChecklist
        hasLogo={data?.hasLogo ?? false}
        totalTeachers={data?.totalTeachers ?? 0}
        totalStudents={data?.totalStudents ?? 0}
        totalUsers={data?.totalUsers ?? 0}
        setup={data?.setup ?? null}
      />
      {/* Top Bar — search + profile */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Dashboard</span>
        <div className="flex min-w-0 items-center gap-3">
          <form
            onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) router.push(`/dashboard/people?search=${encodeURIComponent(searchQuery.trim())}`); }}
            className="hidden md:block"
          >
            <div className="flex w-64 items-center rounded-xl border border-border/60 bg-card/80 transition-colors focus-within:border-primary/50 lg:w-72">
              <span className="flex shrink-0 items-center justify-center pl-3 text-muted-foreground">
                <Search size={15} />
              </span>
              <input
                type="text"
                placeholder="Search students…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-none bg-transparent py-2 pl-2 pr-4 text-sm outline-none placeholder:text-muted-foreground/80"
              />
            </div>
          </form>
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar
              imageUrl={profile?.imageUrl}
              firstName={profile?.first_name ?? 'A'}
              lastName={profile?.last_name}
              size={36}
              fontSize={13}
              background="linear-gradient(to bottom right, #2563eb, #7c3aed)"
            />
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
                {profile ? `${profile.first_name} ${profile.last_name}` : greetingName}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {role?.replace('_', ' ') ?? 'Admin'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results awaiting approval — teachers have published, admin must approve
          before report cards can be generated / downloaded. */}
      {/* Hero Banner */}
      <div className="relative mb-4 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-5 py-5 shadow-sm sm:mb-5 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -right-16 bottom-[-48px] h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <div className="relative min-w-0">
          <h1 className="font-display text-lg font-bold tracking-tight text-white sm:text-2xl">
            {greeting}, {greetingName} <span aria-hidden>{hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙'}</span>
          </h1>
          <p className="mt-0.5 text-xs text-white/80 sm:text-[13px]">
            {todayLabel} &middot; {getCurrentTermName()} &middot; Your school is running smoothly this term.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/reports" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md sm:text-sm">
              <FileText size={15} /> Generate Report Cards
            </Link>
            <Link href="/dashboard/reports" className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors duration-200 hover:bg-white/20 sm:text-sm">
              <MessageSquare size={15} /> Send SMS Results
            </Link>
          </div>
        </div>
      </div>

      {/* At a Glance — full-width rail from the sidebar to the right edge, max 3 visible */}
      <section className="mb-4 shrink-0 sm:mb-5">
        <SectionTitle>At a glance</SectionTitle>
        <KpiCarousel>
          <KpiTile title="Students" value={data?.totalStudents ?? 0} icon={<Users size={17} />} href="/dashboard/people" tone="blue" />
          <KpiTile title="Teachers" value={data?.totalTeachers ?? 0} icon={<GraduationCap size={17} />} href="/dashboard/people?tab=teachers" tone="purple" />
          <KpiTile title="Classes" value={data?.totalClasses ?? 0} icon={<BookOpen size={17} />} href="/dashboard/classes" tone="blue" />
          <KpiTile title="Reports" value={data?.totalReports ?? 0} icon={<FileText size={17} />} href="/dashboard/reports" tone="purple" />
          {/* Marks outstanding is the one number here that is always real and
              always actionable, so it takes a permanent slot. Attendance and
              fees only appear once the school has started using them. */}
          <KpiTile title="Marks outstanding" value={data?.examsAwaitingMarks ?? 0} icon={<ClipboardList size={17} />} href="/dashboard/exams-marks" tone={(data?.examsAwaitingMarks ?? 0) > 0 ? 'amber' : undefined} />
          {data?.hasAttendanceData && (
            <KpiTile title="Present today" value={data?.attendanceToday?.present ?? 0} icon={<CheckCircle2 size={17} />} href="/dashboard/attendance" tone="green" />
          )}
          {data?.hasFeeData && (
            <KpiTile title="Overdue fees" value={data?.overdueFeesCount ?? 0} icon={<Wallet size={17} />} href="/dashboard/fees" alert={(data?.overdueFeesCount ?? 0) > 0} tone={(data?.overdueFeesCount ?? 0) > 0 ? 'red' : undefined} />
          )}
        </KpiCarousel>
      </section>

      <div className="flex items-start gap-4 md:gap-6">

        {/* Main Content Area — full width on mobile; the page itself scrolls */}
        <div className="min-w-0 flex-1 pb-4 xs:pb-6">
          <div className="flex flex-col gap-4 xs:gap-5 sm:gap-6">

          {/* Exam results by class — ‹ › cycles grades/streams, dropdown filters exams */}
          <section>
            <SectionTitle>Class results</SectionTitle>
            <GradeResultsCard />
          </section>

          {/* Insights — 2 columns */}
          <section>
            <SectionTitle>Today&apos;s picture</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-4">
              <InsightCard title="How classes are doing" meta={`${(data?.classPerformance ?? []).filter(c => c.markCount > 0).length} with marks`} action={{ label: 'Analytics', href: '/dashboard/analytics' }}>
                <ClassPerformanceList classes={data?.classPerformance ?? []} passMark={data?.academicSummary?.passMark ?? 50} />
              </InsightCard>

              <InsightCard title="Marks outstanding" meta="Exams sat, not entered" action={{ label: 'Enter marks', href: '/dashboard/exams-marks' }}>
                <OutstandingMarks total={data?.examsAwaitingMarks ?? 0} byClass={data?.unmarkedByClass ?? []} />
              </InsightCard>

              <InsightCard title="Academic performance" meta={`${data?.upcomingExams.length ?? 0} upcoming exams`}>
                <AcademicSummary summary={data?.academicSummary ?? null} />
              </InsightCard>

              <InsightCard title="Needs attention" action={{ label: 'Review all', href: '/dashboard/analytics' }}>
                <AlertList
                  upcomingExams={data?.upcomingExams ?? []}
                  overdueFees={data?.hasFeeData ? data?.overdueFeesCount ?? 0 : null}
                  enrollments={data?.recentEnrollmentsLast7 ?? 0}
                  announcements={data?.announcementsLast7Days ?? 0}
                  reports={data?.totalReports ?? 0}
                  awaitingMarks={data?.examsAwaitingMarks ?? 0}
                  ungradedSubjects={data?.subjectsWithoutGradingSystem ?? 0}
                />
              </InsightCard>

              {/* Only once the school has actually used these. */}
              {data?.hasAttendanceData && (
                <InsightCard title="Attendance today" meta={`${totalAttendance(data)} marked`}>
                  <AttendanceBreakdown present={data?.attendanceToday?.present ?? 0} absent={data?.attendanceToday?.absent ?? 0} late={data?.attendanceToday?.late ?? 0} excused={data?.attendanceToday?.excused ?? 0} />
                </InsightCard>
              )}

              {data?.hasFeeData && (
                <InsightCard title="Fee collection" meta="Current term">
                  <FinanceSnapshot collected={data?.financeSummary?.totalCollected ?? 0} unpaid={data?.financeSummary?.unpaidBalance ?? 0} overdue={data?.financeSummary?.overdueCount ?? 0} />
                </InsightCard>
              )}
            </div>
          </section>

          </div>

          {/* Mobile sidebar content — at bottom below md */}
          <div className="md:hidden flex flex-col gap-3 xs:gap-4 pb-3 xs:pb-4 mt-5">
            <SideRail data={data} />
          </div>
        </div>

        {/* Right Sidebar — hidden below md, visible from md up */}
        <div className="hidden md:flex w-[280px] lg:w-[300px] shrink-0 pb-2 flex-col gap-3 xs:gap-4 md:border-l md:border-border/60 md:pl-6">
          <SideRail data={data} />
        </div>
      </div>
    </div>
  );
}

function QuickActionBtn({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/90 px-3 py-2.5 no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:px-4 sm:py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary sm:h-8 sm:w-8">{icon}</div>
      <span className="text-xs font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-sm">{label}</span>
      <ArrowRight size={14} className="ml-auto shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

function totalAttendance(data: DashboardData | null): string {
  const a = data?.attendanceToday;
  if (!a) return '0';
  return String(a.present + a.absent + a.late + a.excused);
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

/**
 * Items that need doing, weakest link first.
 *
 * Every row here used to render whether or not the underlying feature was in
 * use, so an admin read "Overdue fees 0 · Announcements 0" every morning —
 * across all 41 schools on this instance there is not one fee row and not one
 * announcement. A count of zero for something you have never switched on is
 * not information. Rows now drop out when they have nothing to say, except the
 * two that are always worth stating even at zero: marks outstanding (zero
 * means nobody is behind, which is the good news) and upcoming exams.
 */
function AlertList({ upcomingExams, overdueFees, enrollments, announcements, reports, awaitingMarks, ungradedSubjects }: { awaitingMarks: number; upcomingExams: DashboardData['upcomingExams']; overdueFees: number | null; enrollments: number; announcements: number; reports: number; ungradedSubjects: number }) {
  const [now] = useState(() => Date.now());
  const soonExams = upcomingExams.filter(e => (new Date(e.exam_date).getTime() - now) < 3 * 24 * 60 * 60 * 1000).length;
  const items = [
    // An exam sat but never marked is the thing an admin can act on today.
    { label: 'Marks outstanding', count: awaitingMarks, sub: 'exams sat, not entered', href: '/dashboard/exams-marks', alwaysShow: true },
    { label: 'Upcoming exams', count: upcomingExams.length, sub: soonExams > 0 ? `${soonExams} soon` : null, href: '/dashboard/exams-marks', alwaysShow: true },
    // A subject with no grading system cannot be graded on a report card
    // either, so this is a setup gap rather than a statistic.
    { label: 'Subjects without a grading system', count: ungradedSubjects, sub: 'no grade can be awarded', href: '/dashboard/settings?tab=grading', alwaysShow: false },
    { label: 'New enrollments', count: enrollments, sub: 'this week', href: '/dashboard/people', alwaysShow: false },
    { label: 'Overdue fees', count: overdueFees ?? 0, sub: 'past due date', href: '/dashboard/fees', alwaysShow: overdueFees !== null },
    { label: 'Announcements', count: announcements, sub: 'this week', href: '/dashboard/announcements', alwaysShow: false },
    { label: 'Report cards', count: reports, sub: 'total generated', href: '/dashboard/reports', alwaysShow: false },
  ].filter(item => item.alwaysShow || item.count > 0);
  return (
    <div className="-mx-1 space-y-0.5">
      {items.map((item, i) => (
        <Link key={i} href={item.href} className="group flex items-center gap-3 rounded-xl px-2 py-2 no-underline transition-colors hover:bg-muted/60">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.count > 0 ? 'bg-primary/12' : 'bg-muted/60'}`}>
            <span className={`text-xs font-bold ${item.count > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{item.count}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{item.label}</div>
            {item.sub && <div className="text-xs text-muted-foreground">{item.sub}</div>}
          </div>
          <ArrowRight size={14} className="shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  );
}

function SideRail({ data }: { data: DashboardData | null }) {
  return (
    <>
      {/* Quick Actions */}
      <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
        <h3 className="font-display font-semibold text-foreground text-[15px] mb-3">Quick Actions</h3>
        <div className="flex flex-col gap-2">
          <QuickActionBtn icon={<Plus size={16} />} label="Add Student" href="/dashboard/people" />
          <QuickActionBtn icon={<GraduationCap size={16} />} label="Add Teacher" href="/dashboard/people?tab=teachers" />
          <QuickActionBtn icon={<Wallet size={16} />} label="Record Payment" href="/dashboard/fees" />
          <QuickActionBtn icon={<FileText size={16} />} label="Generate Reports" href="/dashboard/reports" />
          <QuickActionBtn icon={<BarChart3 size={16} />} label="View Analytics" href="/dashboard/analytics" />
        </div>
      </div>

      {/* This Week Summary */}
      <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
        <h3 className="font-display font-semibold text-foreground text-[15px] mb-3">This Week</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center rounded-xl bg-muted/40 p-2.5">
            <span className="text-lg font-bold text-foreground">{data?.upcomingExams.length ?? 0}</span>
            <span className="text-[11px] text-muted-foreground">Exams</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-muted/40 p-2.5">
            <span className="text-lg font-bold text-foreground">{data?.overdueFeesCount ?? 0}</span>
            <span className="text-[11px] text-muted-foreground">Overdue Fees</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-muted/40 p-2.5">
            <span className="text-lg font-bold text-foreground">{data?.recentEnrollmentsLast7 ?? 0}</span>
            <span className="text-[11px] text-muted-foreground">Enrollments</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-muted/40 p-2.5">
            <span className="text-lg font-bold text-foreground">{data?.announcementsLast7Days ?? 0}</span>
            <span className="text-[11px] text-muted-foreground">Announcements</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground text-[15px]">Recent Activity</h3>
          <Link href="/dashboard/reports" className="text-primary text-[13px] font-medium hover:underline">View all</Link>
        </div>
        <div className="flex flex-col">
          {(data?.recentActivities ?? []).slice(0, 3).map((act, i) => (
            <div key={i} className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
              <span className="text-foreground/80 text-[13px] font-medium pr-4">{act.message}</span>
              <span className="text-muted-foreground text-[12px] whitespace-nowrap pt-0.5">{new Date(act.timestamp).toLocaleDateString('en-GB')}</span>
            </div>
          ))}
          {(!data?.recentActivities || data.recentActivities.length === 0) && (
            <div className="text-[13px] text-muted-foreground italic py-1.5">No recent activity.</div>
          )}
        </div>
      </div>

      {/* Announcements */}
      <Link href="/dashboard/announcements" className="bg-primary text-primary-foreground rounded-2xl px-4 py-3.5 flex items-center gap-3 font-semibold hover:opacity-90 transition-opacity shadow-sm no-underline">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Bell size={16} />
        </span>
        <span className="text-sm leading-none">Announcements</span>
        {(data?.announcementsLast7Days ?? 0) > 0 && (
          <span className="ml-auto shrink-0 bg-white/25 text-white text-[11px] font-bold rounded-full px-2 py-0.5 leading-none">{data?.announcementsLast7Days}</span>
        )}
      </Link>
    </>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

// ── Class Teacher Dashboard ──────────────────────────────────
function ClassTeacherDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [kpis, setKpis] = useState<{ label: string; value: string; sub: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [dashboardRes, statsRes] = await Promise.all([
          fetch('/api/school/dashboard'),
          fetch('/api/school/stats?role=class_teacher'),
        ]);
        if (dashboardRes.ok) {
          const json = await dashboardRes.json();
          setData(json);
        }
        if (statsRes.ok) {
          const json = await statsRes.json();
          setKpis([
            { label: 'My Stream', value: json.streamName || '—', sub: 'Assigned homeroom' },
            { label: 'Stream Students', value: (json.studentCount || 0).toString(), sub: json.studentCount ? 'Enrolled' : 'No students yet' },
            { label: 'Stream Average', value: json.streamAvg !== '—' ? `${json.streamAvg}%` : '—', sub: json.streamAvg !== '—' ? 'Class average' : 'Enter marks to see' },
            { label: 'Reports Pending', value: (json.reportsPending || 0).toString(), sub: json.reportsPending > 0 ? 'Need generation' : 'All done!' },
          ]);
        }
      } catch {
        setKpis([
          { label: 'My Stream', value: '—', sub: 'Not assigned' },
          { label: 'Stream Students', value: '—', sub: 'N/A' },
          { label: 'Stream Average', value: '—', sub: 'N/A' },
          { label: 'Reports Pending', value: '—', sub: 'N/A' },
        ]);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      <InfoGuide title="Class Teacher Guide — how to run your class">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li><strong>Enter marks:</strong> open <strong>Exams &amp; Marks</strong>, pick the class, subject and exam, then type scores straight down the list — drafts autosave and sync when the network returns.</li>
          <li><strong>Track attendance:</strong> use <strong>Attendance</strong> to mark your stream daily; absentees&apos; guardians can be notified by SMS.</li>
          <li><strong>Manage your roster:</strong> add or update students in your stream from <strong>People</strong>.</li>
          <li><strong>Generate report cards:</strong> at term end, open <strong>Report Cards</strong> → <em>Generate Reports</em> to compile every subject into one branded card, then export or send to parents.</li>
          <li><strong>Communicate:</strong> post <strong>Announcements</strong> (optionally by SMS) and set <strong>Assignments</strong> for your class.</li>
        </ol>
      </InfoGuide>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? Building2 : i === 1 ? GraduationCap : i === 2 ? BarChart3 : FileText} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
          <RecentActivitiesCard activities={data?.recentActivities ?? []} viewAllHref="/dashboard/reports" />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-[15px] font-semibold mb-1 font-body">Quick Actions</h3>
          <QuickAction label="Generate Reports" desc="Report cards for your class" href="/dashboard/reports" icon={<FileText size={18} />} />
          <QuickAction label="Class Results" desc="Broadsheet and rankings" href="/dashboard/exams-marks?tab=results" icon={<BarChart3 size={18} />} />
          <QuickAction label="Track Attendance" desc="Daily class attendance" href="/dashboard/attendance" icon={<CalendarCheck size={18} />} />
          <QuickAction label="My Students" desc="View class roster" href="/dashboard/people" icon={<GraduationCap size={18} />} />
        </div>
      </div>
    </>
  );
}

// ── Subject Teacher Dashboard ────────────────────────────────
function SubjectTeacherDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<{ label: string; value: string; sub: string }[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [dashboardRes, statsRes] = await Promise.all([
          fetch('/api/school/dashboard'),
          fetch('/api/school/stats?role=subject_teacher'),
        ]);
        if (dashboardRes.ok) {
          const json = await dashboardRes.json();
          setData(json);
        }
        if (statsRes.ok) {
          const json = await statsRes.json();
          setKpis([
            { label: 'My Exams', value: (json.examCount || 0).toString(), sub: (json.examCount || 0) > 0 ? 'Created' : 'No exams yet' },
            { label: 'Subject Average', value: json.avg || '—', sub: json.markCount > 0 ? `From ${json.markCount} marks` : 'Enter marks to see' },
            { label: 'Students Assessed', value: (json.markCount || 0).toString(), sub: json.markCount > 0 ? 'Total mark entries' : 'No data yet' },
          ]);
        }
      } catch {
        setKpis([
          { label: 'My Exams', value: '—', sub: 'No exams yet' },
          { label: 'Subject Average', value: '—', sub: 'Enter marks to see' },
          { label: 'Students Assessed', value: '0', sub: 'No data yet' },
        ]);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      <InfoGuide title="Subject Teacher Guide — how to assess your subjects">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li><strong>Find your exam:</strong> in <strong>Exams &amp; Marks</strong> → <em>Mark Entry &amp; Setup</em>, pick the term, exam and a subject you teach. Exams are set up by your admin — ask them if one is missing. For multi-paper subjects, set the paper structure (P1/P2/P3) once.</li>
          <li><strong>Enter marks:</strong> load the whole class and type scores down the column — <em>Enter</em> jumps to the next student. Entries autosave locally and sync automatically when you&apos;re back online.</li>
          <li><strong>Review results:</strong> open <em>Results &amp; Reports</em> to see the broadsheet, subject averages and rankings.</li>
          <li><strong>Communicate:</strong> set <strong>Assignments</strong> and post <strong>Announcements</strong> for the classes you teach.</li>
        </ol>
      </InfoGuide>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? Calendar : i === 1 ? BarChart3 : GraduationCap} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
          <RecentActivitiesCard activities={data?.recentActivities ?? []} />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-[15px] font-semibold mb-1 font-body">Quick Actions</h3>
          <QuickAction label="Enter Marks" desc="Record exam scores" href="/dashboard/exams-marks" icon={<ClipboardList size={18} />} />
          <QuickAction label="Exam Results" desc="Broadsheet and subject averages" href="/dashboard/exams-marks?tab=results" icon={<BarChart3 size={18} />} />
          <QuickAction label="Publish Results" desc="Send marks for approval" href="/dashboard/exams-marks?tab=publish" icon={<Calendar size={18} />} />
          <QuickAction label="Assignments" desc="Set work for your classes" href="/dashboard/assignments" icon={<FileText size={18} />} />
        </div>
      </div>
    </>
  );
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
      {role === 'CLASS_TEACHER' && <ClassTeacherDashboard />}
      {role === 'SUBJECT_TEACHER' && <SubjectTeacherDashboard />}
      {role === 'STAFF' && (
        <div className="max-w-xl mx-auto mt-8 card p-8 text-center">
          <h2 className="text-xl font-bold font-display mb-2">Welcome{userName ? `, ${userName}` : ''} 👋</h2>
          <p className="text-sm text-muted-foreground mb-1">
            {profile?.job_title ? `You're signed in as ${profile.job_title}.` : "You're signed in as staff."}
          </p>
          <p className="text-sm text-muted-foreground">
            Use <strong>Announcements</strong> in the menu to stay up to date. Your administrator can grant you more access when needed.
          </p>
        </div>
      )}
    </div>
  );
}
