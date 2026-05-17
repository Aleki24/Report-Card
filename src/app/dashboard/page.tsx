"use client";

import React, { useEffect, useState } from 'react';
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
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors hover:bg-muted/55 ${isSoon ? 'border-amber-500/25 bg-amber-500/10' : 'border-border/55 bg-muted/35'}`}
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
              className="flex items-start justify-between gap-3 rounded-xl border border-border/55 bg-muted/35 px-3 py-3 transition-colors hover:bg-muted/55"
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
      <div className="flex h-full items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/50 hover:shadow-md">
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
          <div key={i} className="rounded-xl border border-border/55 bg-muted/35 px-3 py-3 transition-colors hover:bg-muted/55">
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
        <AttentionItem label="Upcoming exams scheduled" count={upcomingCount} href="/dashboard/exams" tone={soonCount > 0 ? 'warning' : 'info'} />
        <AttentionItem label="Mark entries pending review" count="—" href="/dashboard/marks" tone="warning" />
        <AttentionItem label="Attendance to confirm today" count="—" href="/dashboard/attendance" tone="info" />
        <AttentionItem label="Fee payments to follow up" count="—" href="/dashboard/fees" tone="danger" />
        <AttentionItem label="Setup tasks remaining" count="0" href="/dashboard/settings" tone="success" />
      </div>
    </ListPanel>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────
function AdminDashboard({ greeting, userName }: { greeting: string; userName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="relative min-h-full overflow-hidden rounded-[2rem] bg-background/40 p-3 sm:p-4 lg:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-[0.09] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute left-8 top-10 text-3xl opacity-10">☀️</div>
      <div className="pointer-events-none absolute bottom-12 right-10 text-4xl opacity-10">📐</div>

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{greeting}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">School command center</h1>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex h-10 min-w-[260px] items-center gap-2 rounded-xl border border-border/70 bg-card/90 px-3 text-sm text-muted-foreground shadow-sm">
              <Search size={16} />
              <span>Search students, reports, classes…</span>
            </div>
            <select className="h-10 rounded-xl border border-border/70 bg-card/90 px-3 text-sm font-medium tracking-tight text-foreground shadow-sm outline-none focus:ring-2 focus:ring-primary/40">
              <option>2024–2025 • Term 1</option>
              <option>2024–2025 • Term 2</option>
              <option>2024–2025 • Term 3</option>
            </select>
            <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/90 text-muted-foreground shadow-sm transition-all hover:-translate-y-px hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-card bg-red-500" />
            </button>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/90 text-foreground shadow-sm transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <User size={18} />
            </button>
          </div>
        </div>

        <DashboardBanner
          greeting={`Good morning, ${greetingName} 👋`}
          summary="Here's what's happening in your school today. Review attention items first, then jump into the daily workflows your team uses most."
          meta="Current year • Term 1"
        />

        <DashboardSection title="At a Glance" description="Fast metrics for the current school setup and daily operations.">
          <MobileStatGrid>
            <StatCard label="Total Students" value={data?.totalStudents ?? '—'} sub="Enrolled learners" icon={Users} iconClassName="bg-violet-500/10 text-violet-500" />
            <StatCard label="Total Teachers" value={data?.totalTeachers ?? '—'} sub="Active staff" icon={GraduationCap} iconClassName="bg-primary/10 text-primary" />
            <StatCard label="Total Classes" value={data?.totalClasses ?? '—'} sub="All streams" icon={Building2} iconClassName="bg-blue-500/10 text-blue-500" />
            <StatCard label="Reports Generated" value={data?.totalReports ?? '—'} sub="This term" icon={FileText} iconClassName="bg-emerald-500/10 text-emerald-500" />
          </MobileStatGrid>
        </DashboardSection>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div className="flex flex-col gap-6">
            <TodayAttentionCard exams={data?.upcomingExams ?? []} />

            <DashboardSection title="Primary Quick Actions" description="Daily workflows for marks, reports, attendance, and results.">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
                {primaryActions.map(action => (
                  <PrimaryActionCard key={action.title} {...action} />
                ))}
              </div>
            </DashboardSection>

            <DashboardSection title="Manage School" description="Secondary navigation for people, academics, operations, and access.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {managementActions.map(action => (
                  <CompactNavCard key={action.title} {...action} />
                ))}
              </div>
            </DashboardSection>

            <DashboardSection title="Operations Overview" description="Lightweight finance and attendance entry points.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <CompactNavCard title="Fee Collection" subtitle="Track payments and balances" href="/dashboard/fees" icon={<Wallet size={18} />} />
                <CompactNavCard title="Attendance" subtitle="Daily class tracking" href="/dashboard/attendance" icon={<CalendarCheck size={18} />} />
              </div>
            </DashboardSection>
          </div>

          <div className="flex flex-col gap-6">
            <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
            <RecentActivitiesCard activities={data?.recentActivities ?? []} />
            <RecentAnnouncementsCard announcements={[]} />
            <DashboardCard className="overflow-hidden p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold tracking-tight text-foreground">Setup Progress</h3>
                <span className="text-sm font-bold text-primary">0%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-0 rounded-full bg-primary transition-all duration-500" />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Complete school profile, academic structure, and access settings when ready.</p>
            </DashboardCard>
          </div>
        </div>
      </div>
    </div>
  );
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
          <QuickAction label="My Students" desc="View class roster" href="/dashboard/students" icon={<GraduationCap size={18} />} />
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
          <QuickAction label="Enter Marks" desc="Record exam scores" href="/dashboard/marks" icon={<ClipboardList size={18} />} />
          <QuickAction label="Subject Analytics" desc="Subject performance" href="/dashboard/analytics" icon={<BarChart3 size={18} />} />
          <QuickAction label="View Exams" desc="Manage assessments" href="/dashboard/exams" icon={<Calendar size={18} />} />
          <QuickAction label="Exam Results" desc="View broadsheet" href="/dashboard/exam-results" icon={<FileText size={18} />} />
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
