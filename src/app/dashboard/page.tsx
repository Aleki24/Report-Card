"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui';
import {
  Users, GraduationCap, Building2, FileText, CalendarCheck, Calendar,
  ArrowRight, BarChart3, ClipboardList, Wallet, Bell, User,
  BookOpen, Heart, ShieldCheck, Search
} from 'lucide-react';

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
  attendanceToday: null;
  upcomingExams: { id: string; name: string; exam_type: string; exam_date: string; subject_name: string; grade_name: string }[];
  recentActivities: { type: string; message: string; timestamp: string; href?: string }[];
}


import { DashboardSkeleton as LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import DashboardBanner from '@/components/dashboard/DashboardBanner';
import DashboardCard from '@/components/dashboard/DashboardCard';
import DashboardSection from '@/components/dashboard/DashboardSection';
import PrimaryActionCard from '@/components/dashboard/PrimaryActionCard';
import CompactNavCard from '@/components/dashboard/CompactNavCard';
import AttentionItem from '@/components/dashboard/AttentionItem';
import ListPanel from '@/components/dashboard/ListPanel';
import EmptyState from '@/components/dashboard/EmptyState';
import MobileStatGrid from '@/components/dashboard/MobileStatGrid';
import MiniCalendar from '@/components/dashboard/MiniCalendar';
import QuickStatsChart from '@/components/dashboard/QuickStatsChart';
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

const primaryActions = [
  { title: 'Mark Entry', description: 'Record student marks', href: '/dashboard/marks', icon: <ClipboardList size={20} />, badge: 'Daily' },
  { title: 'Report Cards', description: 'Generate term reports', href: '/dashboard/reports', icon: <FileText size={20} />, badge: 'Core' },
  { title: 'Attendance', description: 'Track attendance today', href: '/dashboard/attendance', icon: <CalendarCheck size={20} /> },
  { title: 'Exam Results', description: 'Review broadsheets', href: '/dashboard/exam-results', icon: <BarChart3 size={20} /> },
];

const managementActions = [
  { title: 'Students', subtitle: 'Enrollment and records', href: '/dashboard/students', icon: <Users size={18} /> },
  { title: 'Teachers', subtitle: 'Staff management', href: '/dashboard/teachers', icon: <GraduationCap size={18} /> },
  { title: 'Classes', subtitle: 'Grades and streams', href: '/dashboard/classes', icon: <Building2 size={18} /> },
  { title: 'Subjects', subtitle: 'Curriculum setup', href: '/dashboard/subjects', icon: <BookOpen size={18} /> },
  { title: 'Exams', subtitle: 'Exam schedules', href: '/dashboard/exams', icon: <ClipboardList size={18} /> },
  { title: 'Parents', subtitle: 'Guardian directory', href: '/dashboard/parents', icon: <Heart size={18} /> },
  { title: 'Analytics', subtitle: 'Performance insights', href: '/dashboard/analytics', icon: <BarChart3 size={18} /> },
  { title: 'Users & Roles', subtitle: 'Access control', href: '/dashboard/users', icon: <ShieldCheck size={18} /> },
];

function TodayAttentionCard({ exams }: { exams: DashboardData['upcomingExams'] }) {
  const [now] = useState(() => Date.now());
  const upcomingCount = exams.length;
  const soonCount = exams.filter(exam => (new Date(exam.exam_date).getTime() - now) < 3 * 24 * 60 * 60 * 1000).length;

  return (
    <ListPanel title="Today's Attention" actionLabel="Review" actionHref="/dashboard/analytics" className="h-full">
      <div className="flex flex-col gap-3">
        <AttentionItem label="Upcoming exams scheduled" count={upcomingCount} href="/dashboard/exams-marks" tone={soonCount > 0 ? 'warning' : 'info'} />
        <AttentionItem label="Mark entries pending review" count="—" href="/dashboard/exams-marks" tone="warning" />
        <AttentionItem label="Setup tasks remaining" count="0" href="/dashboard/administration" tone="success" />
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
    <div className="relative min-h-full overflow-hidden p-2 sm:p-3 lg:p-4 bg-background text-foreground">
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

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-4 md:gap-6">
        {/* Main Content Area */}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ColoredStatCard title="Total Students" value={data?.totalStudents ?? '0'} icon={<Users size={22} />} color="bg-[#2A9D8F]" href="/dashboard/people" />
              <ColoredStatCard title="Total Teachers" value={data?.totalTeachers ?? '0'} icon={<GraduationCap size={22} />} color="bg-[#E76F51]" href="/dashboard/people" />
              <ColoredStatCard title="Total Classes" value={data?.totalClasses ?? '0'} icon={<BookOpen size={22} />} color="bg-[#4361EE]" href="/dashboard/academic-structure" />
              <ColoredStatCard title="Reports" value={data?.totalReports ?? '0'} icon={<FileText size={22} />} color="bg-[#7209B7]" href="/dashboard/reports" />
            </div>
          </div>

          {/* Today's Attention */}
          <div>
            <h2 className="text-[13px] xs:text-[14px] sm:text-[15px] font-semibold mb-3 xs:mb-4 text-foreground/90">Today's Attention</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <AttentionCard title="Upcoming Exams" icon={<Calendar size={20} />} color="bg-[#6D597A]" href="/dashboard/exams-marks" />
              <AttentionCard title="Mark entries" icon={<ClipboardList size={20} />} color="bg-[#F07167]" href="/dashboard/exams-marks" />
              <AttentionCard title="Fee payments" icon={<Wallet size={20} />} color="bg-[#F4A261]" href="/dashboard/fees" />
              <AttentionCard title="Setup Tasks" icon={<ShieldCheck size={20} />} color="bg-[#5C677D]" href="/dashboard/administration" />
              <AttentionCard title="Pending Review" icon={<Bell size={20} />} color="bg-[#3A5A40]" href="/dashboard/reports" />
            </div>
          </div>

          {/* Primary Quick Actions */}
          <div>
            <h2 className="text-[13px] xs:text-[14px] sm:text-[15px] font-semibold mb-3 xs:mb-4 text-foreground/90">Primary Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <ColorfulActionCard title="Mark Entry" icon={<User size={20} />} color="bg-[#003E5C]" href="/dashboard/exams-marks" />
              <ColorfulActionCard title="Attendance" icon={<CalendarCheck size={20} />} color="bg-[#004E64]" href="/dashboard/attendance" />
              <ColorfulActionCard title="Report Cards" icon={<FileText size={20} />} color="bg-[#005F73]" href="/dashboard/reports" />
              <ColorfulActionCard title="Exam Results" icon={<BarChart3 size={20} />} color="bg-[#0A9396]" href="/dashboard/exams-marks" />
            </div>
          </div>

          {/* Manage School */}
          <div>
            <h2 className="text-[13px] xs:text-[14px] sm:text-[15px] font-semibold mb-3 xs:mb-4 text-foreground/90">Manage School</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <LightActionCard title="Students" icon={<Users size={20} />} bgClass="bg-blue-50 dark:bg-blue-900/20" textClass="text-blue-600 dark:text-blue-400" href="/dashboard/people" />
              <LightActionCard title="Teachers" icon={<GraduationCap size={20} />} bgClass="bg-orange-50 dark:bg-orange-900/20" textClass="text-orange-600 dark:text-orange-400" href="/dashboard/people" />
              <LightActionCard title="Classes" icon={<Building2 size={20} />} bgClass="bg-purple-50 dark:bg-purple-900/20" textClass="text-purple-600 dark:text-purple-400" href="/dashboard/academic-structure" />
              <LightActionCard title="Subjects" icon={<BookOpen size={20} />} bgClass="bg-emerald-50 dark:bg-emerald-900/20" textClass="text-emerald-600 dark:text-emerald-400" href="/dashboard/academic-structure" />
            </div>
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-3 xs:gap-4 lg:border-l lg:border-black/10 lg:pl-7 p-3 xs:p-4 sm:p-5">
          {/* Mini Calendar */}
          <MiniCalendar />

          {/* Quick Stats */}
          <QuickStatsChart />

          {/* Recent Activity */}
          <div className="rounded-2xl border border-black/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-[15px]">Recent Activity</h3>
              <a href="/dashboard/reports" className="text-teal-700 text-[13px] font-medium hover:underline">View all</a>
            </div>
            <div className="flex flex-col">
              {(data?.recentActivities ?? []).slice(0, 3).map((act, i) => (
                <div key={i} className="flex justify-between items-start py-1.5 border-b border-black/5 last:border-0">
                  <span className="text-gray-700 text-[13px] font-medium pr-4">{act.message}</span>
                  <span className="text-gray-500 text-[12px] whitespace-nowrap pt-0.5">{new Date(act.timestamp).toLocaleDateString('en-GB')}</span>
                </div>
              ))}
              {(!data?.recentActivities || data.recentActivities.length === 0) && (
                <div className="text-[13px] text-gray-500 italic py-1.5">No recent activity.</div>
              )}
            </div>
          </div>
          
          {/* Announcements */}
          <Link href="/dashboard/announcements" className="bg-white/60 rounded-full px-5 py-3 flex items-center gap-3 text-teal-800 font-medium hover:bg-white/80 transition-colors shadow-sm mt-2 border border-white no-underline">
            <div className="text-teal-600">
              <Bell size={18} />
            </div>
            <span className="text-[14px]">Announcements</span>
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

function AttentionCard({ title, icon, color, href }: { title: string, icon: React.ReactNode, color: string, href?: string }) {
  const card = (
    <div className={`${color} text-white p-3 xs:p-4 rounded-xl shadow-md flex h-[90px] xs:h-[95px] sm:h-[105px] flex-col items-center justify-center gap-1.5 xs:gap-2 text-center transition-transform hover:-translate-y-1`}>
      <div className="flex h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/20 [&>svg]:h-4 [&>svg]:w-4 xs:[&>svg]:h-[18px] xs:[&>svg]:w-[18px] sm:[&>svg]:h-5 sm:[&>svg]:w-5">{icon}</div>
      <p className="text-[11px] xs:text-[12px] sm:text-[14px] font-semibold leading-tight">{title}</p>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function ColorfulActionCard({ title, icon, color, href }: { title: string, icon: React.ReactNode, color: string, href?: string }) {
  const card = (
    <div className={`${color} text-white p-3 xs:p-4 rounded-xl shadow-md flex h-[100px] xs:h-[110px] sm:h-[120px] flex-col items-center justify-center gap-1.5 xs:gap-2 sm:gap-3 text-center transition-transform hover:-translate-y-1 cursor-pointer`}>
      <div className="w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 flex items-center justify-center relative">
         <div className="absolute top-0 right-0 w-2.5 h-2.5 xs:w-3 xs:h-3 bg-rose-500 rounded-full border-2 border-[#003E5C]"></div>
        {icon}
      </div>
      <div className="text-[12px] xs:text-[13px] sm:text-[15px] font-semibold font-display">{title}</div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function LightActionCard({ title, icon, bgClass, textClass, href }: { title: string, icon: React.ReactNode, bgClass: string, textClass: string, href?: string }) {
  const card = (
    <div className={`${bgClass} p-3 xs:p-4 rounded-xl shadow-md flex h-[90px] xs:h-[95px] sm:h-[105px] flex-col items-center justify-center gap-1.5 xs:gap-2 text-center transition-transform hover:-translate-y-1 cursor-pointer`}>
      <div className={`${textClass} w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10 rounded-full bg-black/5 flex items-center justify-center [&>svg]:h-[14px] [&>svg]:w-[14px] xs:[&>svg]:h-4 xs:[&>svg]:w-4 sm:[&>svg]:h-[18px] sm:[&>svg]:w-[18px]`}>{icon}</div>
      <div className="text-[11px] xs:text-[12px] sm:text-[14px] font-semibold font-display text-foreground">{title}</div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
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
