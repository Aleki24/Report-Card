"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui';
import {
  Users, GraduationCap, Building2, FileText, CalendarCheck, Calendar,
  ArrowRight, ArrowUpRight, BarChart3, ClipboardList, Wallet, Bell,
  BookOpen, Search, CheckCircle2, Plus
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
  academicSummary: { recentAvg: number | null };
  hasLogo: boolean;
}


import { DashboardSkeleton as LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import ListPanel from '@/components/dashboard/ListPanel';
import EmptyState from '@/components/dashboard/EmptyState';
import MiniCalendar from '@/components/dashboard/MiniCalendar';
import Link from 'next/link';
import { getCurrentTermName } from '@/lib/term-calendar';
import { SetupNotifier } from '@/components/dashboard/SetupNotifier';

function WelcomeBanner({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-purple-500/10 border border-border rounded-2xl p-5 mb-6 flex items-start gap-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
      </div>
      <div className="text-[13px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground font-display text-[15px]">{title}</strong>
        <ul className="mt-2 pl-5 list-disc opacity-85">
          {items.map((item, i) => (
            <li key={i} className="mb-1">{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

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

function RecentActivitiesCard({ activities }: { activities: DashboardData['recentActivities'] }) {
  if (activities.length === 0) {
    return (
      <ListPanel title="Recent Activity" className="h-full">
        <EmptyState title="No recent activity" description="Activity such as marks, students, and report cards will be listed here." />
      </ListPanel>
    );
  }

  const displayActivities = activities.slice(0, 5);

  return (
    <ListPanel title="Recent Activity" actionLabel="View all" actionHref="/dashboard/reports" className="h-full">
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
    <div className="relative h-full overflow-hidden px-2 sm:px-3 lg:px-4 pb-2 sm:pb-3 lg:pb-4 bg-background text-foreground flex flex-col">
      <SetupNotifier
        hasLogo={data?.hasLogo ?? false}
        totalTeachers={data?.totalTeachers ?? 0}
        totalStudents={data?.totalStudents ?? 0}
        totalUsers={data?.totalUsers ?? 0}
        role="ADMIN"
      />
      {/* Top Header Bar */}
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-5">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-2xl">
            {greeting}, {greetingName} <span aria-hidden>{hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙'}</span>
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-[13px]">
            {todayLabel} &middot; {getCurrentTermName()}
          </p>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) router.push(`/dashboard/analytics?search=${encodeURIComponent(searchQuery.trim())}`); }}
          className="hidden md:block"
        >
          <div className="flex w-64 items-center rounded-xl border border-border/60 bg-card/80 transition-colors focus-within:border-primary/50 lg:w-72">
            <span className="flex shrink-0 items-center justify-center pl-3 text-muted-foreground">
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder="Search students, analytics…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border-none bg-transparent py-2 pl-2 pr-4 text-sm outline-none placeholder:text-muted-foreground/80"
            />
          </div>
        </form>
      </div>

      <div className="flex gap-4 md:gap-6 flex-1 min-h-0 overflow-hidden">

        {/* Main Content Area — scrollable independently, full width on mobile */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-4 xs:pb-6">
          <div className="flex flex-col gap-4 xs:gap-5 sm:gap-6">

          {/* At a Glance */}
          <section>
            <SectionTitle>At a glance</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiTile title="Students" value={data?.totalStudents ?? 0} icon={<Users size={17} />} href="/dashboard/people" />
              <KpiTile title="Teachers" value={data?.totalTeachers ?? 0} icon={<GraduationCap size={17} />} href="/dashboard/people?tab=teachers" />
              <KpiTile title="Classes" value={data?.totalClasses ?? 0} icon={<BookOpen size={17} />} href="/dashboard/classes" />
              <KpiTile title="Reports" value={data?.totalReports ?? 0} icon={<FileText size={17} />} href="/dashboard/reports" />
              <KpiTile title="Present today" value={data?.attendanceToday?.present ?? 0} icon={<CheckCircle2 size={17} />} href="/dashboard/attendance" />
              <KpiTile title="Overdue fees" value={data?.overdueFeesCount ?? 0} icon={<Wallet size={17} />} href="/dashboard/fees" alert={(data?.overdueFeesCount ?? 0) > 0} />
            </div>
          </section>

          {/* Insights — 2 columns */}
          <section>
            <SectionTitle>Today&apos;s picture</SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 xs:gap-4">
              <InsightCard title="Attendance today" meta={`${totalAttendance(data)} marked`}>
                <AttendanceBreakdown present={data?.attendanceToday?.present ?? 0} absent={data?.attendanceToday?.absent ?? 0} late={data?.attendanceToday?.late ?? 0} excused={data?.attendanceToday?.excused ?? 0} />
              </InsightCard>

              <InsightCard title="Fee collection" meta="Current term">
                <FinanceSnapshot collected={data?.financeSummary?.totalCollected ?? 0} unpaid={data?.financeSummary?.unpaidBalance ?? 0} overdue={data?.financeSummary?.overdueCount ?? 0} />
              </InsightCard>

              <InsightCard title="Academic performance" meta={`${data?.upcomingExams.length ?? 0} upcoming exams`}>
                <AcademicSummary avg={data?.academicSummary?.recentAvg ?? null} />
              </InsightCard>

              <InsightCard title="Needs attention" action={{ label: 'Review all', href: '/dashboard/analytics' }}>
                <AlertList upcomingExams={data?.upcomingExams ?? []} overdueFees={data?.overdueFeesCount ?? 0} enrollments={data?.recentEnrollmentsLast7 ?? 0} announcements={data?.announcementsLast7Days ?? 0} reports={data?.totalReports ?? 0} />
              </InsightCard>
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <SectionTitle>Quick actions</SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-3">
              <QuickActionBtn icon={<Plus size={16} />} label="Add Student" href="/dashboard/people" />
              <QuickActionBtn icon={<GraduationCap size={16} />} label="Add Teacher" href="/dashboard/people?tab=teachers" />
              <QuickActionBtn icon={<Wallet size={16} />} label="Record Payment" href="/dashboard/fees" />
              <QuickActionBtn icon={<FileText size={16} />} label="Generate Reports" href="/dashboard/reports" />
            </div>
          </section>

          </div>

          {/* Mobile sidebar content — at bottom below md */}
          <div className="md:hidden flex flex-col gap-3 xs:gap-4 pb-3 xs:pb-4 mt-5">
            <SideRail data={data} />
          </div>
        </div>

        {/* Right Sidebar — hidden below md, visible from md up */}
        <div className="hidden md:flex w-[280px] lg:w-[300px] shrink-0 overflow-y-auto min-h-0 pb-2 flex-col gap-3 xs:gap-4 md:border-l md:border-border/60 md:pl-6">
          <SideRail data={data} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  );
}

function KpiTile({ title, value, icon, href, alert = false }: { title: string; value: string | number; icon: React.ReactNode; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="group block no-underline">
      <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:p-4">
        <div className="flex items-start justify-between">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${alert ? 'bg-destructive/15 text-destructive' : 'bg-primary/12 text-primary'}`}>
            {icon}
          </div>
          <ArrowUpRight size={14} className="text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>
        <div className="mt-3 text-xl font-bold leading-none tracking-tight text-foreground sm:text-2xl">{value}</div>
        <div className="mt-1.5 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{title}</div>
      </div>
    </Link>
  );
}

function InsightCard({ title, meta, action, children }: { title: string; meta?: string; action?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm xs:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {action ? (
          <Link href={action.href} className="text-xs font-medium text-primary hover:underline">{action.label}</Link>
        ) : meta ? (
          <span className="text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {children}
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

function AcademicSummary({ avg }: { avg: number | null }) {
  if (avg == null) return <div className="py-6 text-center text-sm italic text-muted-foreground">No exam data yet</div>;
  const sev = avg >= 80 ? 'var(--viz-good)' : avg >= 60 ? 'var(--viz-warn)' : 'var(--viz-bad)';
  const label = avg >= 80 ? 'Excellent' : avg >= 60 ? 'Good' : avg >= 40 ? 'Fair' : 'Needs improvement';
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold leading-none tracking-tight text-foreground sm:text-4xl">{avg}%</span>
        <span className="text-xs text-muted-foreground">school average, recent exams</span>
      </div>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${sev} 18%, transparent)` }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(avg, 100)}%`, background: sev }} />
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sev }} />
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
    </div>
  );
}

function AlertList({ upcomingExams, overdueFees, enrollments, announcements, reports }: { upcomingExams: DashboardData['upcomingExams']; overdueFees: number; enrollments: number; announcements: number; reports: number }) {
  const [now] = useState(() => Date.now());
  const soonExams = upcomingExams.filter(e => (new Date(e.exam_date).getTime() - now) < 3 * 24 * 60 * 60 * 1000).length;
  const items = [
    { label: 'Upcoming exams', count: upcomingExams.length, sub: soonExams > 0 ? `${soonExams} soon` : null, href: '/dashboard/exams-marks' },
    { label: 'Overdue fees', count: overdueFees, sub: 'past due date', href: '/dashboard/fees' },
    { label: 'New enrollments', count: enrollments, sub: 'this week', href: '/dashboard/people' },
    { label: 'Announcements', count: announcements, sub: 'this week', href: '/dashboard/announcements' },
    { label: 'Report cards', count: reports, sub: 'total generated', href: '/dashboard/reports' },
  ];
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
      <MiniCalendar />

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
      <Link href="/dashboard/announcements" className="bg-primary text-primary-foreground rounded-xl px-4 py-3 flex items-center gap-3 font-semibold hover:opacity-90 transition-opacity shadow-sm no-underline">
        <Bell size={18} />
        <span className="text-sm">Announcements</span>
        {(data?.announcementsLast7Days ?? 0) > 0 && (
          <span className="ml-auto bg-white/25 text-white text-[11px] font-bold rounded-full px-2 py-0.5">{data?.announcementsLast7Days}</span>
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
      <WelcomeBanner
        title="Class Teacher Guide"
        items={[
          'Manage students in your assigned homeroom stream.',
          'Generate final Report Cards at the end of the term.',
          'Use Generate Reports to compile marks across all subjects.',
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? Building2 : i === 1 ? GraduationCap : i === 2 ? BarChart3 : FileText} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
          <RecentActivitiesCard activities={data?.recentActivities ?? []} />
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-[15px] font-semibold mb-1 font-body">Quick Actions</h3>
          <QuickAction label="Generate Reports" desc="Report cards for your class" href="/dashboard/reports" icon={<FileText size={18} />} />
          <QuickAction label="Class Analytics" desc="Performance trends" href="/dashboard/analytics" icon={<BarChart3 size={18} />} />
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
            { label: 'Pending Entry', value: '—', sub: 'Create exams to track' },
          ]);
        }
      } catch {
        setKpis([
          { label: 'My Exams', value: '—', sub: 'No exams yet' },
          { label: 'Subject Average', value: '—', sub: 'Enter marks to see' },
          { label: 'Students Assessed', value: '0', sub: 'No data yet' },
          { label: 'Pending Entry', value: '—', sub: 'Create exams to track' },
        ]);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      <WelcomeBanner
        title="Subject Teacher Guide"
        items={[
          'Create exams and enter marks for the subjects you teach.',
          'Schedule new assessments via the Exams section.',
          'Use Enter Marks below to record student scores.',
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? Calendar : i === 1 ? BarChart3 : i === 2 ? GraduationCap : ClipboardList} />
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
          <QuickAction label="Subject Analytics" desc="Subject performance" href="/dashboard/analytics" icon={<BarChart3 size={18} />} />
          <QuickAction label="View Exams" desc="Manage assessments" href="/dashboard/exams-marks" icon={<Calendar size={18} />} />
          <QuickAction label="Exam Results" desc="View broadsheet" href="/dashboard/exams-marks" icon={<FileText size={18} />} />
        </div>
      </div>
    </>
  );
}

// ── Student Dashboard ────────────────────────────────────────
function StudentDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<{ label: string; value: string; sub: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/school/stats?role=student');
        const json = await res.json();
        setKpis([
          { label: 'My Average', value: json.avg ? `${json.avg}%` : '—', sub: json.markCount > 0 ? `From ${json.markCount} marks` : 'No marks yet' },
          { label: 'Best Subject', value: json.bestSubject || '—', sub: json.bestScore ? `${json.bestScore}% average` : 'N/A' },
          { label: 'Stream Position', value: json.position || '—', sub: json.positionSub || 'N/A' },
          { label: 'Exams Taken', value: (json.markCount || 0).toString(), sub: 'Total entries' },
        ]);
      } catch {
        setKpis([
          { label: 'My Average', value: '—', sub: 'No marks yet' },
          { label: 'Best Subject', value: '—', sub: 'N/A' },
          { label: 'Stream Position', value: '—', sub: 'N/A' },
          { label: 'Exams Taken', value: '0', sub: 'No data yet' },
        ]);
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      <WelcomeBanner
        title="Student Guide"
        items={[
          'View your academic progress and track your performance.',
          'Download your Report Cards from the My Results section.',
          'Check Analytics for detailed subject breakdowns.',
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? BarChart3 : i === 1 ? GraduationCap : i === 2 ? Users : Calendar} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickAction label="View My Results" desc="View and download report cards" href="/student/results" icon={<FileText size={18} />} />
        <QuickAction label="My Analytics" desc="Subject performance breakdown" href="/dashboard/analytics" icon={<BarChart3 size={18} />} />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { profile, role, loading } = useAuth();
  const userName = profile ? `${profile.first_name}` : '';

  if (loading) return <div style={{ padding: 'var(--space-6)' }}><LoadingSkeleton /></div>;

  const isAdmin = role === 'ADMIN' || !role;

  return (
    <div className="flex-1 min-h-0 h-full p-2 md:p-6 lg:p-8 pt-1">
      {isAdmin && <AdminDashboard userName={userName} />}
      {role === 'CLASS_TEACHER' && <ClassTeacherDashboard />}
      {role === 'SUBJECT_TEACHER' && <SubjectTeacherDashboard />}
      {role === 'STUDENT' && <StudentDashboard />}
    </div>
  );
}
