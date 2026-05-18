"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui';
import {
  Users, GraduationCap, Building2, FileText, CalendarCheck, Calendar,
  ArrowRight, BarChart3, ClipboardList, Wallet, Bell,
  BookOpen, Search, CheckCircle2, Plus, Megaphone
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Announcement {
  title: string;
  time: string;
  desc: string;
  postedBy: string;
}

interface DashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalReports: number;
  attendanceToday: { present: number; absent: number; late: number } | null;
  upcomingExams: { id: string; name: string; exam_type: string; exam_date: string; subject_name: string; grade_name: string }[];
  recentActivities: { type: string; message: string; timestamp: string; href?: string }[];
  overdueFeesCount: number;
  announcementsLast7Days: number;
  recentEnrollmentsLast7: number;
  financeSummary: { totalCollected: number; unpaidBalance: number; overdueCount: number };
  academicSummary: { recentAvg: number | null };
}


import { DashboardSkeleton as LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import ListPanel from '@/components/dashboard/ListPanel';
import EmptyState from '@/components/dashboard/EmptyState';
import MiniCalendar from '@/components/dashboard/MiniCalendar';
import Link from 'next/link';
import { getCurrentTermName } from '@/lib/term-calendar';

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
      <ListPanel title="Upcoming Exams" actionLabel="Schedule" actionHref="/dashboard/exams" className="h-full">
        <EmptyState title="No upcoming exams" description="Scheduled exams will appear here with clear date blocks." />
      </ListPanel>
    );
  }

  const displayExams = exams.slice(0, 5);

  return (
    <ListPanel title="Upcoming Exams" actionLabel="View all" actionHref="/dashboard/exams" className="h-full">
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

// ── Mock Insight Components ─────────────────────────────────
function RecentAnnouncementsCard({ announcements = [] }: { announcements?: Announcement[] }) {
  if (announcements.length === 0) {
    return (
      <ListPanel title="Announcements" actionLabel="Create" actionHref="/dashboard/announcements" className="h-full">
        <EmptyState title="No announcements" description="Share updates with teachers, students, and parents from here." />
      </ListPanel>
    );
  }

  const displayAnnouncements = announcements.slice(0, 5);

  return (
    <ListPanel title="Announcements" actionLabel="View all" actionHref="/dashboard/announcements" className="h-full">
      <div className="flex flex-col gap-3">
        {displayAnnouncements.map((ann, i) => (
          <div key={i} className="rounded-xl border border-border/55 bg-muted/35 p-[5px] transition-colors hover:bg-muted/55">
            <div className="flex justify-between gap-3">
              <div className="min-w-0 truncate text-sm font-medium tracking-tight text-foreground">{ann.title}</div>
              <div className="shrink-0 text-xs text-muted-foreground">{ann.time}</div>
            </div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{ann.desc}</div>
            <div className="mt-1 text-[11px] text-muted-foreground/80">Posted by {ann.postedBy}</div>
          </div>
        ))}
      </div>
    </ListPanel>
  );
}


// ── Admin Dashboard ──────────────────────────────────────────
function AdminDashboard({ greeting, userName }: { greeting: string; userName: string }) {
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

  return (
    <div className="relative h-full overflow-hidden p-2 sm:p-3 lg:p-4 bg-background text-foreground">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-4 xs:mb-6">
        <div className="text-[10px] xs:text-[12px] sm:text-[13px] font-semibold text-foreground uppercase tracking-[0.15em]">
          {getCurrentTermName()} • {new Date().getFullYear()}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (searchQuery.trim()) router.push(`/dashboard/analytics?search=${encodeURIComponent(searchQuery.trim())}`); }}
          className="hidden md:flex items-center flex-1 justify-center mx-6"
        >
          <div className="flex items-center w-full max-w-sm bg-muted/40 rounded-xl overflow-hidden px-0">
            <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border-none outline-none bg-transparent py-2.5 pr-4 text-sm"
            />
          </div>
        </form>
        <div className="flex items-center">
          <div className="text-[14px] xs:text-base sm:text-lg font-semibold font-display flex items-center gap-1.5">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {greetingName} <span>{new Date().getHours() < 12 ? '☀️' : new Date().getHours() < 17 ? '🌤️' : '🌙'}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 md:gap-6 h-full min-h-0">
        {/* Main Content Area — scrollable independently */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="flex flex-col gap-4 xs:gap-5 sm:gap-6">
          
          {/* Greeting */}
          <div>
            <h1 className="text-[1.5rem] xs:text-[1.75rem] sm:text-[2rem] font-bold tracking-tight text-foreground font-display">
              {greeting} dashboard
            </h1>
          </div>

          {/* At a Glance */}
          <div>
            <h2 className="text-[13px] xs:text-[14px] sm:text-[15px] font-semibold mb-3 xs:mb-4 text-foreground/90">At a Glance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <ColoredStatCard title="Total Students" value={data?.totalStudents ?? '0'} icon={<Users size={22} />} color="bg-[#2A9D8F]" href="/dashboard/people" />
              <ColoredStatCard title="Teachers" value={data?.totalTeachers ?? '0'} icon={<GraduationCap size={22} />} color="bg-[#E76F51]" href="/dashboard/people" />
              <ColoredStatCard title="Classes" value={data?.totalClasses ?? '0'} icon={<BookOpen size={22} />} color="bg-[#4361EE]" href="/dashboard/academic-structure" />
              <ColoredStatCard title="Reports" value={data?.totalReports ?? '0'} icon={<FileText size={22} />} color="bg-[#7209B7]" href="/dashboard/reports" />
              <ColoredStatCard title="Present Today" value={data?.attendanceToday?.present ?? 0} icon={<CheckCircle2 size={22} />} color="bg-[#2A9D8F]" href="/dashboard/attendance" />
              <ColoredStatCard title="Overdue Fees" value={data?.overdueFeesCount ?? 0} icon={<Wallet size={22} />} color="bg-[#E76F51]" href="/dashboard/fees" />
            </div>
          </div>

          {/* Analytics Row — 2 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Attendance Chart */}
            <div className="rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Attendance Today</h3>
                <span className="text-xs text-muted-foreground">{totalAttendance(data)} total</span>
              </div>
              <AttendanceDonut present={data?.attendanceToday?.present ?? 0} absent={data?.attendanceToday?.absent ?? 0} late={data?.attendanceToday?.late ?? 0} />
            </div>

            {/* Finance Snapshot */}
            <div className="rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Finance Snapshot</h3>
                <span className="text-xs text-muted-foreground">Current term</span>
              </div>
              <FinanceSnapshot collected={data?.financeSummary?.totalCollected ?? 0} unpaid={data?.financeSummary?.unpaidBalance ?? 0} overdue={data?.financeSummary?.overdueCount ?? 0} />
            </div>

            {/* Academic Performance */}
            <div className="rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Academic Performance</h3>
                <span className="text-xs text-muted-foreground">{data?.upcomingExams.length ?? 0} upcoming exams</span>
              </div>
              <AcademicGauge avg={data?.academicSummary?.recentAvg ?? null} />
            </div>

            {/* Alerts compact */}
            <div className="rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Alerts &amp; Action Items</h3>
                <a href="/dashboard/analytics" className="text-xs text-primary font-medium hover:underline">Review all</a>
              </div>
              <AlertList upcomingExams={data?.upcomingExams ?? []} overdueFees={data?.overdueFeesCount ?? 0} enrollments={data?.recentEnrollmentsLast7 ?? 0} announcements={data?.announcementsLast7Days ?? 0} reports={data?.totalReports ?? 0} />
            </div>

          </div>

          {/* Quick Actions — unique items not covered above */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <QuickActionBtn icon={<Plus size={16} />} label="Add Student" href="/dashboard/people" color="bg-[#2A9D8F]" />
            <QuickActionBtn icon={<GraduationCap size={16} />} label="Add Teacher" href="/dashboard/people" color="bg-[#E76F51]" />
            <QuickActionBtn icon={<Wallet size={16} />} label="Record Payment" href="/dashboard/fees" color="bg-[#F4A261]" />
            <QuickActionBtn icon={<FileText size={16} />} label="Generate Reports" href="/dashboard/reports" color="bg-[#4361EE]" />
          </div>

          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-[280px] lg:w-[300px] shrink-0 flex flex-col gap-3 xs:gap-4 lg:border-l lg:border-border lg:pl-7 p-3 xs:p-4 sm:p-5">
          {/* Mini Calendar */}
          <MiniCalendar />

          {/* This Week Summary */}
          <div className="rounded-2xl border border-border p-4">
            <h3 className="font-display font-semibold text-foreground text-[15px] mb-3">This Week</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center rounded-xl bg-muted/30 p-2.5">
                <span className="text-lg font-bold text-foreground">{data?.upcomingExams.length ?? 0}</span>
                <span className="text-[11px] text-muted-foreground">Exams</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-muted/30 p-2.5">
                <span className="text-lg font-bold text-foreground">{data?.overdueFeesCount ?? 0}</span>
                <span className="text-[11px] text-muted-foreground">Overdue Fees</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-muted/30 p-2.5">
                <span className="text-lg font-bold text-foreground">{data?.recentEnrollmentsLast7 ?? 0}</span>
                <span className="text-[11px] text-muted-foreground">Enrollments</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-muted/30 p-2.5">
                <span className="text-lg font-bold text-foreground">{data?.announcementsLast7Days ?? 0}</span>
                <span className="text-[11px] text-muted-foreground">Announcements</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground text-[15px]">Recent Activity</h3>
              <a href="/dashboard/reports" className="text-primary text-[13px] font-medium hover:underline">View all</a>
            </div>
            <div className="flex flex-col">
              {(data?.recentActivities ?? []).slice(0, 3).map((act, i) => (
                <div key={i} className="flex justify-between items-start py-1.5 border-b border-border last:border-0">
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
        </div>
      </div>
    </div>
  );
}

function ColoredStatCard({ title, value, icon, color, href }: { title: string, value: string | number, icon: React.ReactNode, color: string, href?: string }) {
  const card = (
    <div className={`${color} text-white p-3 xs:p-4 rounded-xl shadow-md flex h-[100px] xs:h-[110px] sm:h-[120px] flex-col items-center justify-center gap-1.5 xs:gap-2 text-center transition-transform hover:-translate-y-1`}>
      <div className="opacity-80 scale-[0.8] xs:scale-100">{icon}</div>
      <div className="text-[11px] xs:text-[12px] sm:text-[13px] font-semibold opacity-90">{title}</div>
      <div className="text-[20px] xs:text-[24px] sm:text-[28px] font-display font-bold leading-none">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function QuickActionBtn({ icon, label, href, color }: { icon: React.ReactNode; label: string; href: string; color: string }) {
  return (
    <Link href={href} className={`${color} text-white flex items-center gap-2.5 rounded-xl px-4 py-3 sm:py-3.5 no-underline transition-transform hover:-translate-y-0.5 shadow-sm`}>
      <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-white/20 shrink-0">{icon}</div>
      <span className="text-sm sm:text-[15px] font-bold leading-tight text-pretty">{label}</span>
    </Link>
  );
}

function totalAttendance(data: DashboardData | null): string {
  const a = data?.attendanceToday;
  if (!a) return '0';
  return String(a.present + a.absent + a.late);
}

function AttendanceDonut({ present, absent, late }: { present: number; absent: number; late: number }) {
  const total = present + absent + late || 1;
  const rate = Math.round((present / total) * 100);
  const data = [
    { name: 'Present', value: present, color: '#10b981' },
    { name: 'Absent', value: absent, color: '#ef4444' },
    { name: 'Late', value: late, color: '#f59e0b' },
  ].filter(d => d.value > 0);
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={2} strokeWidth={0}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-foreground">{rate}%</div>
          <div className="text-[11px] text-muted-foreground">attendance</div>
        </div>
      </div>
      <div className="flex gap-5 mt-1">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">{present}</span><span className="text-xs text-muted-foreground/60">present</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="text-xs text-muted-foreground">{absent}</span><span className="text-xs text-muted-foreground/60">absent</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-xs text-muted-foreground">{late}</span><span className="text-xs text-muted-foreground/60">late</span></div>
      </div>
    </div>
  );
}

function FinanceSnapshot({ collected, unpaid, overdue }: { collected: number; unpaid: number; overdue: number }) {
  const data = [
    { name: 'Collected', amount: collected, fill: '#10b981' },
    { name: 'Outstanding', amount: unpaid, fill: '#f87171' },
  ];
  return (
    <div>
      <div className="flex items-center justify-around mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-600">{formatCurrency(collected)}</div>
          <div className="text-[11px] text-muted-foreground">Collected</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-500">{formatCurrency(unpaid)}</div>
          <div className="text-[11px] text-muted-foreground">Outstanding</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-500">{overdue}</div>
          <div className="text-[11px] text-muted-foreground">Overdue</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <ReBarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => formatCurrency(Number(v))} />
          <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [formatCurrency(Number(v)), 'Amount']} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={50}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AcademicGauge({ avg }: { avg: number | null }) {
  if (avg == null) return <div className="text-center py-8 text-sm text-muted-foreground italic">No exam data yet</div>;
  const color = avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444';
  const label = avg >= 80 ? 'Excellent' : avg >= 60 ? 'Good' : avg >= 40 ? 'Fair' : 'Needs improvement';
  const data = [{ value: avg, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={[{ value: avg }, { value: 100 - avg }]} cx="50%" cy="50%" innerRadius={32} outerRadius={52} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
              <Cell fill={color} />
              <Cell fill="var(--color-muted)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-foreground">{avg}%</div>
          <div className="text-[11px] text-muted-foreground">average</div>
        </div>
      </div>
      <div className={`mt-1 text-xs font-medium px-3 py-1 rounded-full ${
        avg >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
        avg >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
      }`}>{label}</div>
    </div>
  );
}

function AlertList({ upcomingExams, overdueFees, enrollments, announcements, reports }: { upcomingExams: DashboardData['upcomingExams']; overdueFees: number; enrollments: number; announcements: number; reports: number }) {
  const [now] = useState(() => Date.now());
  const soonExams = upcomingExams.filter(e => (new Date(e.exam_date).getTime() - now) < 3 * 24 * 60 * 60 * 1000).length;
  const items = [
    { label: 'Upcoming exams', count: upcomingExams.length, sub: soonExams > 0 ? `${soonExams} soon` : null, href: '/dashboard/exams-marks', color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Overdue fees', count: overdueFees, sub: 'past due date', href: '/dashboard/fees', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'New enrollments', count: enrollments, sub: 'this week', href: '/dashboard/people', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Announcements', count: announcements, sub: 'this week', href: '/dashboard/announcements', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Report cards', count: reports, sub: 'total generated', href: '/dashboard/reports', color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  ];
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <Link key={i} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors hover:bg-muted/60">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg}`}>
            <span className={`text-xs font-bold ${item.color}`}>{item.count}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{item.label}</div>
            {item.sub && <div className="text-xs text-muted-foreground">{item.sub}</div>}
          </div>
          <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
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
        <QuickAction label="View My Results" desc="View and download report cards" href="/dashboard/my-results" icon={<FileText size={18} />} />
        <QuickAction label="My Analytics" desc="Subject performance breakdown" href="/dashboard/analytics" icon={<BarChart3 size={18} />} />
      </div>
    </>
  );
}

const roleGreetings: Record<string, string> = {
  ADMIN: 'School Overview',
  CLASS_TEACHER: 'My Homeroom',
  SUBJECT_TEACHER: 'My Subjects',
  STUDENT: 'My Performance',
};

export default function DashboardPage() {
  const { profile, role, loading } = useAuth();
  const greeting = role ? roleGreetings[role] || 'Dashboard' : 'Dashboard';
  const userName = profile ? `${profile.first_name}` : '';

  if (loading) return <div style={{ padding: 'var(--space-6)' }}><LoadingSkeleton /></div>;

  const isAdmin = role === 'ADMIN' || !role;

  return (
    <div className="flex-1 min-h-0 h-full p-2 md:p-6 lg:p-8 pt-6">
      {isAdmin && <AdminDashboard greeting={greeting} userName={userName} />}
      {role === 'CLASS_TEACHER' && <ClassTeacherDashboard />}
      {role === 'SUBJECT_TEACHER' && <SubjectTeacherDashboard />}
      {role === 'STUDENT' && <StudentDashboard />}
    </div>
  );
}
