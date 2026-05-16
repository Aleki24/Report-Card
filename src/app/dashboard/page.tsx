"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardHeader, CardTitle, CardContent, Button, Select, Badge } from '@/components/ui';
import {
  Users, GraduationCap, Building2, FileText, CalendarCheck, Calendar,
  ArrowRight, Plus, BarChart3, Settings, ClipboardList, Activity, Wallet, Bell, User,
  PanelRightOpen, PanelRightClose
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalReports: number;
  attendanceToday: null;
  upcomingExams: { id: string; name: string; exam_type: string; exam_date: string; subject_name: string; grade_name: string }[];
  recentActivities: { type: string; message: string; timestamp: string; href?: string }[];
}

interface ActivityIconMap {
  [key: string]: React.ReactNode;
}

import { DashboardSkeleton as LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';

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
  if (exams.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle><Calendar size={16} /> Upcoming Exams</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">No upcoming exams scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  const displayExams = exams.slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle><Calendar size={16} /> Upcoming Exams</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {displayExams.map(exam => {
          const date = new Date(exam.exam_date);
          const formatted = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          const isSoon = (date.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;
          return (
            <div
              key={exam.id}
              className={`flex items-center gap-3 rounded-md border hover:bg-muted transition-colors ${isSoon ? 'bg-amber-500/10 border-amber-500/20' : 'bg-muted/60 border-border/50'}`}
              style={{ padding: '5px' }}
            >
              <div className="min-w-[48px] text-center">
                <div className={`text-[11px] font-semibold ${isSoon ? 'text-amber-500' : 'text-muted-foreground'}`}>{formatted}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-foreground">{exam.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {exam.subject_name} &middot; {exam.grade_name}
                </div>
              </div>
              {isSoon && <Badge variant="warning">SOON</Badge>}
            </div>
          );
        })}
        {exams.length > 5 && (
          <div className="mt-4 pt-3 border-t border-border text-center">
            <a href="/dashboard/exams" className="text-primary text-[13px] font-medium hover:underline">View all exams</a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivitiesCard({ activities }: { activities: DashboardData['recentActivities'] }) {
  const iconMap: ActivityIconMap = {
    report: <FileText size={14} />,
    student: <GraduationCap size={14} />,
    mark: <ClipboardList size={14} />,
  };
  const colorMap: { [key: string]: string } = {
    report: 'text-emerald-500',
    student: 'text-amber-500',
    mark: 'text-red-500',
  };
  const bgMap: { [key: string]: string } = {
    report: 'bg-emerald-500/10',
    student: 'bg-amber-500/10',
    mark: 'bg-red-500/10',
  };

  if (activities.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle><Activity size={16} /> Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">No recent activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  const displayActivities = activities.slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle><Activity size={16} /> Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {displayActivities.map((act, i) => {
          const date = new Date(act.timestamp);
          const timeAgo = getTimeAgo(date);
          const actColor = colorMap[act.type] || 'text-primary';
          const actBg = bgMap[act.type] || 'bg-primary/10';
          return (
            <div
              key={i}
              className="flex flex-col gap-1 bg-muted/60 rounded-md border border-border/50 hover:bg-muted transition-colors"
              style={{ padding: '5px' }}
            >
              <div className="text-[13px] font-medium text-foreground">{act.message}</div>
              <div className="text-[11px] text-muted-foreground">{timeAgo}</div>
            </div>
          );
        })}
        {activities.length > 5 && (
          <div className="mt-4 pt-3 border-t border-border text-center">
            <button className="text-primary text-[13px] font-medium hover:underline bg-transparent border-none cursor-pointer">View all activity</button>
          </div>
        )}
      </CardContent>
    </Card>
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
    <a href={href} className="no-underline block group h-full">
      <div className="flex items-center gap-6 px-8 py-8 h-full rounded-xl bg-muted border border-border cursor-pointer transition-all duration-200 hover:border-primary hover:-translate-y-[1px]">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">{label}</div>
          <div className="text-[13px] text-muted-foreground leading-snug">{desc}</div>
        </div>
        <ArrowRight size={20} className="text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all ml-3" />
      </div>
    </a>
  );
}

// ── Chart Components ─────────────────────────────────────────
function AttendanceChartCard({ data }: { data: any }) {
  const attendanceData = data || [
    { name: 'Present', value: 0, color: '#10B981' },
    { name: 'Late', value: 0, color: '#F59E0B' },
    { name: 'Absent', value: 0, color: '#EF4444' },
  ];

  const total = attendanceData.reduce((sum: number, item: any) => sum + item.value, 0);
  const presentPct = total > 0 ? Math.round((attendanceData[0].value / total) * 100) : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row justify-between items-center mb-4 space-y-0">
        <CardTitle className="text-[16px]">Attendance Overview</CardTitle>
        <Select className="py-1 px-2 text-[13px] h-auto min-h-0 w-auto">
          <option>This Week</option>
          <option>This Month</option>
        </Select>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-[140px] h-[140px] relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceData}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {attendanceData.map((entry: any, index: any) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => `${val}%`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold">{presentPct}%</div>
              <div className="text-[11px] text-muted-foreground">Overall</div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col gap-3 w-full">
            {attendanceData.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-[13px] font-medium">{item.name}</span>
                </div>
                <div className="text-[13px] text-muted-foreground">{item.value}%</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      
      <div className="mt-4 pt-4 border-t border-border px-6 pb-6 flex justify-between items-center">
        <a href="/dashboard/attendance" className="text-[13px] text-primary font-medium no-underline flex items-center gap-1 hover:underline">
           View full attendance report
        </a>
        <ArrowRight size={14} className="text-muted-foreground" />
      </div>
    </Card>
  );
}

function FeeCollectionOverviewCard({ collected = 0, total = 0, outstanding = 0, overdue = 0 }) {
  const percent = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row justify-between items-center mb-4 space-y-0">
        <CardTitle className="text-[16px]">Fee Collection Overview</CardTitle>
        <Select className="py-1 px-2 text-[13px] h-auto min-h-0 w-auto">
          <option>This Month</option>
        </Select>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-6">
          <div>
            <div className="text-[12px] text-emerald-500 font-semibold mb-1">Collected</div>
            <div className="text-2xl font-bold">KES {collected.toLocaleString()}</div>
            <div className="text-[12px] text-muted-foreground mt-1">{percent}% of total</div>
          </div>
          <div className="md:text-right">
            <div className="text-[12px] text-muted-foreground font-semibold mb-1">Total Fees</div>
            <div className="text-2xl font-bold">KES {total.toLocaleString()}</div>
          </div>
        </div>
        
        <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
        
        <div className="flex flex-col md:flex-row md:justify-between gap-4 mt-6">
          <div>
            <div className="text-[12px] text-foreground font-semibold mb-1">Outstanding</div>
            <div className="text-lg font-bold">KES {outstanding.toLocaleString()}</div>
          </div>
          <div className="md:text-right">
            <div className="text-[12px] text-red-500 font-semibold mb-1">Overdue</div>
            <div className="text-lg font-bold text-red-500">KES {overdue.toLocaleString()}</div>
          </div>
        </div>
      </CardContent>

      <div className="mt-4 pt-4 border-t border-border px-6 pb-6 flex justify-between items-center">
        <a href="/dashboard/finance" className="text-[13px] text-primary font-medium no-underline flex items-center gap-1 hover:underline">
           View finance dashboard
        </a>
        <ArrowRight size={14} className="text-muted-foreground" />
      </div>
    </Card>
  );
}

// ── Mock Insight Components ─────────────────────────────────
function RecentAnnouncementsCard({ announcements = [] }: { announcements?: any[] }) {
  if (announcements.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle><FileText size={16} /> Recent Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">No recent announcements.</p>
        </CardContent>
      </Card>
    );
  }

  const displayAnnouncements = announcements.slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle><FileText size={16} /> Recent Announcements</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {displayAnnouncements.map((ann, i) => (
          <div key={i} className="flex flex-col gap-1 bg-muted/60 rounded-md border border-border/50 hover:bg-muted transition-colors" style={{ padding: '5px' }}>
            <div className="flex justify-between items-center">
              <div className="text-[13px] font-medium text-foreground">{ann.title}</div>
              <div className="text-[11px] text-muted-foreground">{ann.time}</div>
            </div>
            <div className="text-[12px] text-muted-foreground">{ann.desc}</div>
            <div className="text-[11px] text-muted-foreground/80">Posted by {ann.postedBy}</div>
          </div>
        ))}
        {announcements.length > 5 && (
          <div className="mt-4 pt-3 border-t border-border text-center">
            <button className="text-primary text-[13px] font-medium hover:underline bg-transparent border-none cursor-pointer">View all</button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StudentsNeedingAttentionCard({ issues = [] }: { issues?: any[] }) {
  if (issues.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle><Users size={16} /> Students Needing Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">No students currently flagged.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle><Users size={16} /> Students Needing Attention</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {issues.map((issue, i) => (
          <div key={i} className="flex items-start gap-4 p-5 bg-muted rounded-xl border border-border">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${issue.type === 'attendance' ? 'bg-amber-500' : issue.type === 'fees' ? 'bg-red-500' : 'bg-[var(--color-accent)]'}`} />
            <div className="text-[14px] text-foreground">{issue.text}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SystemSetupProgressCard({ progress = 0 }: { progress?: number }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle><Settings size={16} /> Setup Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[13px] font-medium">Overall Progress</div>
          <div className="text-[13px] font-semibold text-primary">{progress}%</div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4 flex">
          <div className="bg-[var(--color-accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[13px] text-muted-foreground">No pending setup tasks.</div>
      </CardContent>
    </Card>
  );
}

function AcademicPerformanceCard({ stats = null }: { stats?: any }) {
  if (!stats) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle><BarChart3 size={16} /> Academic Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">No academic data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle><BarChart3 size={16} /> Academic Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex justify-between pb-2 border-b border-border">
          <div className="text-[13px] text-muted-foreground">Average Performance</div>
          <div className="text-[13px] font-semibold">72%</div>
        </div>
        <div className="flex justify-between pb-2 border-b border-border">
          <div className="text-[13px] text-muted-foreground">Best Class</div>
          <div className="text-[13px] font-semibold text-emerald-500">Grade 6</div>
        </div>
        <div className="flex justify-between pb-2 border-b border-border">
          <div className="text-[13px] text-muted-foreground">Lowest Subject</div>
          <div className="text-[13px] font-semibold text-red-500">Mathematics</div>
        </div>
        <div className="flex justify-between">
          <div className="text-[13px] text-muted-foreground">Reports Generated</div>
          <div className="text-[13px] font-semibold">120</div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-border text-center">
          <a href="/dashboard/analytics" className="text-primary text-[13px] font-medium hover:underline">Analytics</a>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────
function AdminDashboard({ greeting, userName }: { greeting: string; userName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityCollapsed, setActivityCollapsed] = useState(false);

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

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 items-start h-full ${activityCollapsed ? '' : ''}`}>
      
      {/* ─── Left Column (2/3 width) ─── */}
      <div className="flex flex-col gap-6 min-w-0 w-full md:col-span-2 xl:col-span-3">
        
        {/* Header: Title + Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">
              {greeting}
            </h1>
            <p className="text-muted-foreground text-[13px] mt-1 leading-relaxed">
              {userName ? `Welcome back, ${userName}! 👋 Here's your school overview.` : 'Overview of student performance and key metrics'}
            </p>
          </div>
          <div className="hidden md:flex gap-3 items-center">
            <div className="flex items-center justify-between gap-2 bg-muted border border-border rounded-md text-[13px] font-medium min-w-[140px]" style={{ padding: '5px' }}>
              <span className="text-muted-foreground whitespace-nowrap">Year:</span>
              <select className="bg-transparent border-none font-semibold outline-none cursor-pointer text-foreground text-right w-full">
                <option>2024–2025</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2 bg-muted border border-border rounded-md text-[13px] font-medium min-w-[140px]" style={{ padding: '5px' }}>
              <span className="text-muted-foreground whitespace-nowrap">Term:</span>
              <select className="bg-transparent border-none font-semibold outline-none cursor-pointer text-foreground text-right w-full">
                <option>Term 1</option>
                <option>Term 2</option>
                <option>Term 3</option>
              </select>
            </div>
            <button className="w-9 h-9 rounded-md border border-border bg-muted flex items-center justify-center relative cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <Bell size={18} />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[var(--color-surface)]" />
            </button>
            <button className="w-9 h-9 rounded-md border border-border bg-muted flex items-center justify-center cursor-pointer text-foreground hover:bg-card transition-colors">
              <User size={18} />
            </button>
          </div>
        </div>

        {/* Overview Section */}
        <div>
          <div className="mb-5">
            <h2 className="text-[17px] font-semibold text-foreground font-body">Overview</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">Key metrics and performance indicators</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Total Students" value={data?.totalStudents ?? '—'} sub="" icon={Users} iconClassName="bg-violet-500/10 text-violet-500" />
            <StatCard label="Total Teachers" value={data?.totalTeachers ?? '—'} sub="Active staff" icon={GraduationCap} iconClassName="bg-primary/10 text-primary" />
            <StatCard label="Total Classes" value={data?.totalClasses ?? '—'} sub="All streams" icon={Building2} iconClassName="bg-blue-500/10 text-blue-500" />
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-[15px] font-semibold flex items-center gap-2 font-body" style={{ marginBottom: '20px' }}>
            <Activity size={16} /> Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <QuickAction label="Students" desc="Manage enrollment" href="/dashboard/students" icon={<Users size={18} />} />
            <QuickAction label="Teachers" desc="Staff management" href="/dashboard/teachers" icon={<GraduationCap size={18} />} />
            <QuickAction label="Classes" desc="Streams & grades" href="/dashboard/classes" icon={<Building2 size={18} />} />
            <QuickAction label="Subjects" desc="Curriculum setup" href="/dashboard/subjects" icon={<FileText size={18} />} />
            <QuickAction label="Exams" desc="Schedule exams" href="/dashboard/exams" icon={<ClipboardList size={18} />} />
            <QuickAction label="Mark Entry" desc="Record scores" href="/dashboard/marks" icon={<ClipboardList size={18} />} />
            <QuickAction label="Exam Results" desc="View broadsheet" href="/dashboard/exam-results" icon={<BarChart3 size={18} />} />
            <QuickAction label="Report Cards" desc="Generate reports" href="/dashboard/reports" icon={<FileText size={18} />} />
            <QuickAction label="Attendance" desc="Track daily" href="/dashboard/attendance" icon={<CalendarCheck size={18} />} />
            <QuickAction label="Parents" desc="Guardian info" href="/dashboard/parents" icon={<Users size={18} />} />
            <QuickAction label="Analytics" desc="Performance trends" href="/dashboard/analytics" icon={<BarChart3 size={18} />} />
            <QuickAction label="Users & Roles" desc="Manage access" href="/dashboard/users" icon={<Users size={18} />} />
            {/* Setup Progress — spans remaining columns */}
            <a href="/dashboard/settings" className="no-underline block group lg:col-span-2 xl:col-span-4">
              <div className="flex items-center gap-6 px-8 py-8 rounded-xl bg-muted border border-border cursor-pointer transition-all hover:border-primary hover:-translate-y-[1px]">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <Settings size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[13px] font-semibold text-foreground">Setup Progress</div>
                    <div className="text-[12px] font-semibold text-primary">0%</div>
                  </div>
                  <div className="h-1.5 bg-card rounded-full overflow-hidden">
                    <div className="w-0 h-full bg-[var(--color-accent)] transition-all duration-300" />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Complete school setup in Settings</div>
                </div>
                <ArrowRight size={14} className="text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </a>
          </div>
        </div>

        {/* School Activity Section */}
        <div>
          <div className="mb-5">
            <h2 className="text-[17px] font-semibold text-foreground font-body">School Activity</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">Attendance and fee collection overview</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <QuickAction label="Fee Collection" desc="Track payments" href="/dashboard/students" icon={<Wallet size={18} />} />
            <QuickAction label="Attendance" desc="Daily tracking" href="/dashboard/attendance" icon={<CalendarCheck size={18} />} />
          </div>
        </div>

        {/* Extra margin at the bottom */}
        <div className="pb-10"></div>
      </div>

      {/* ─── Right Sidebar Column / Edge Tab ─── */}
      {activityCollapsed ? (
        /* Collapsed: thin vertical edge tab */
        <div
          className="flex flex-col items-center justify-center gap-2 p-3 bg-muted border border-border rounded-l-xl cursor-pointer hover:bg-primary/10 transition-colors h-[200px] sticky top-6 right-0 text-muted-foreground"
          onClick={() => setActivityCollapsed(false)}
          title="Open Recent Activity"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          <PanelRightOpen size={16} className="rotate-90" />
          <span className="text-[13px] font-medium tracking-wider">Recent Activity</span>
        </div>
      ) : (
        /* Expanded: full sidebar */
        <div className="flex flex-col gap-6 w-full md:col-span-1 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-[17px] font-semibold font-body">Recent Activity</h2>
            <button
              onClick={() => setActivityCollapsed(true)}
              title="Collapse activity panel"
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
            >
              <PanelRightClose size={16} />
            </button>
          </div>
          <RecentAnnouncementsCard announcements={[]} />
          <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
          <RecentActivitiesCard activities={data?.recentActivities ?? []} />
        </div>
      )}

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
