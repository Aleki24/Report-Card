"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import StatCard from '@/components/dashboard/StatCard';
import {
  Users, GraduationCap, Building2, FileText, CalendarCheck, Calendar,
  ArrowRight, Plus, BarChart3, Settings, ClipboardList, Activity, Wallet, Bell, User
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

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" style={{ gap: 'var(--space-4)' }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="stat-card" style={{ opacity: 0.4, minHeight: 80 }}>
            <div className="stat-label">Loading...</div>
            <div className="stat-value">—</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 'var(--space-6)' }}>
        <div className="lg:col-span-2 card" style={{ padding: 'var(--space-6)', minHeight: 200 }}>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Loading...</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-6)', minHeight: 200 }}>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Loading...</div>
        </div>
      </div>
    </div>
  );
}

function WelcomeBanner({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(139,92,246,0.06) 100%)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5) var(--space-6)',
        marginBottom: 'var(--space-6)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-4)',
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: 'var(--color-accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)' }}>{title}</strong>
        <ul style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-5)', opacity: 0.85 }}>
          {items.map((item, i) => (
            <li key={i} style={{ marginBottom: 'var(--space-1)' }}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function UpcomingExamsCard({ exams }: { exams: DashboardData['upcomingExams'] }) {
  if (exams.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Calendar size={16} /> Upcoming Exams
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No upcoming exams scheduled.</p>
      </div>
    );
  }

  const displayExams = exams.slice(0, 5);

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Calendar size={16} /> Upcoming Exams
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {displayExams.map(exam => {
          const date = new Date(exam.exam_date);
          const formatted = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          const isSoon = (date.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;
          return (
            <div
              key={exam.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: isSoon ? 'rgba(245,158,11,0.08)' : 'var(--color-surface-raised)',
                border: isSoon ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
              }}
            >
              <div style={{ minWidth: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: isSoon ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{formatted}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{exam.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {exam.subject_name} &middot; {exam.grade_name}
                </div>
              </div>
              {isSoon && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-warning)', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: '999px' }}>
                  SOON
                </span>
              )}
            </div>
          );
        })}
      </div>
      {exams.length > 5 && (
        <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <a href="/dashboard/exams" style={{ color: 'var(--color-accent)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>View all exams</a>
        </div>
      )}
    </div>
  );
}

function RecentActivitiesCard({ activities }: { activities: DashboardData['recentActivities'] }) {
  const iconMap: ActivityIconMap = {
    report: <FileText size={14} />,
    student: <GraduationCap size={14} />,
    mark: <ClipboardList size={14} />,
  };
  const colorMap: { [key: string]: string } = {
    report: 'var(--color-accent)',
    student: 'var(--color-warning)',
    mark: 'var(--color-danger)',
  };

  if (activities.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Activity size={16} /> Recent Activity
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No recent activity yet.</p>
      </div>
    );
  }

  const displayActivities = activities.slice(0, 5);

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Activity size={16} /> Recent Activity
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {displayActivities.map((act, i) => {
          const date = new Date(act.timestamp);
          const timeAgo = getTimeAgo(date);
          const actColor = colorMap[act.type] || 'var(--color-accent)';
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                background: actColor + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: actColor,
              }}>
                {iconMap[act.type] || <Activity size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{act.message}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{timeAgo}</div>
              </div>
            </div>
          );
        })}
      </div>
      {activities.length > 5 && (
        <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>View all activity</button>
        </div>
      )}
    </div>
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
    <a href={href} style={{ textDecoration: 'none' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-sm)',
          background: 'var(--color-accent-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--color-accent)',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{desc}</div>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
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
    <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Attendance Overview</h3>
        <select style={{ fontSize: 13, padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
          <option>This Week</option>
          <option>This Month</option>
        </select>
      </div>
      
      <div className="attendance-chart-layout">
        <div style={{ width: 140, height: 140, position: 'relative' }}>
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
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{presentPct}%</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Overall</div>
          </div>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {attendanceData.map((item: any) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{item.value}%</div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/dashboard/attendance" style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
           View full attendance report
        </a>
        <ArrowRight size={14} style={{ color: 'var(--color-text-muted)' }} />
      </div>
    </div>
  );
}

function FeeCollectionOverviewCard({ collected = 0, total = 0, outstanding = 0, overdue = 0 }) {
  const percent = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;

  return (
    <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Fee Collection Overview</h3>
        <select style={{ fontSize: 13, padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
          <option>This Month</option>
        </select>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="fee-overview-top">
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600, marginBottom: '4px' }}>Collected</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>KES {collected.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: '4px' }}>{percent}% of total</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>Total Fees</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>KES {total.toLocaleString()}</div>
          </div>
        </div>
        
        <div style={{ height: 10, background: 'var(--color-surface-raised)', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${percent}%`, background: 'var(--color-success)' }} />
        </div>
        
        <div className="fee-overview-bottom">
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: '4px' }}>Outstanding</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>KES {outstanding.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--color-danger)', fontWeight: 600, marginBottom: '4px' }}>Overdue</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-danger)' }}>KES {overdue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/dashboard/finance" style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
           View finance dashboard
        </a>
        <ArrowRight size={14} style={{ color: 'var(--color-text-muted)' }} />
      </div>
    </div>
  );
}

// ── Mock Insight Components ─────────────────────────────────
function RecentAnnouncementsCard({ announcements = [] }: { announcements?: any[] }) {
  if (announcements.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <FileText size={16} /> Recent Announcements
        </h3>
        <div style={{ marginTop: 'var(--space-4)', fontSize: 13, color: 'var(--color-text-muted)' }}>No recent announcements.</div>
      </div>
    );
  }

  const displayAnnouncements = announcements.slice(0, 5);

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <FileText size={16} /> Recent Announcements
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {displayAnnouncements.map((ann, i) => (
          <div key={i} style={{ padding: 'var(--space-3)', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{ann.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ann.time}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>{ann.desc}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Posted by {ann.postedBy}</div>
          </div>
        ))}
      </div>
      {announcements.length > 5 && (
        <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>View all</button>
        </div>
      )}
    </div>
  );
}

function StudentsNeedingAttentionCard({ issues = [] }: { issues?: any[] }) {
  if (issues.length === 0) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)', height: '100%' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Users size={16} /> Students Needing Attention
        </h3>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No students currently flagged.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 'var(--space-5)', height: '100%' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Users size={16} /> Students Needing Attention
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {issues.map((issue, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: issue.type === 'attendance' ? 'var(--color-warning)' : issue.type === 'fees' ? 'var(--color-danger)' : 'var(--color-accent)', marginTop: 6, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{issue.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemSetupProgressCard({ progress = 0 }: { progress?: number }) {
  return (
    <div className="card" style={{ padding: 'var(--space-5)', height: '100%' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Settings size={16} /> Setup Progress
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Overall Progress</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent)' }}>{progress}%</div>
      </div>
      <div style={{ height: 6, background: 'var(--color-surface-raised)', borderRadius: '999px', overflow: 'hidden', marginBottom: 'var(--space-4)', display: 'flex' }}>
        <div style={{ width: `${progress}%`, background: 'var(--color-accent)' }} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No pending setup tasks.</div>
    </div>
  );
}

function AcademicPerformanceCard({ stats = null }: { stats?: any }) {
  if (!stats) {
    return (
      <div className="card" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <BarChart3 size={16} /> Academic Summary
        </h3>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No academic data available yet.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <BarChart3 size={16} /> Academic Summary
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Average Performance</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>72%</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Best Class</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>Grade 6</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Lowest Subject</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>Mathematics</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Reports Generated</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>120</div>
        </div>
      </div>
      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
        <a href="/dashboard/analytics" style={{ color: 'var(--color-accent)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Analytics</a>
      </div>
    </div>
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

  return (
    <div className="dashboard-grid" style={{ gap: 'var(--space-6)', alignItems: 'start' }}>
      
      {/* ─── Left Column (2/3 width) ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 }}>
        
        {/* Header: Title + Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="dashboard-title">
              {greeting}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              {userName ? `Welcome back, ${userName}! 👋 Here's your school overview.` : 'Overview of student performance and key metrics'}
            </p>
          </div>
          <div className="hidden md:flex" style={{ gap: 'var(--space-3)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', padding: '6px 14px', borderRadius: '999px', fontSize: 13, fontWeight: 500 }}>
              Academic Year:
              <select style={{ background: 'transparent', border: 'none', fontWeight: 600, outline: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                <option>2024–2025</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', padding: '6px 14px', borderRadius: '999px', fontSize: 13, fontWeight: 500 }}>
              Term:
              <select style={{ background: 'transparent', border: 'none', fontWeight: 600, outline: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                <option>Term 1</option>
                <option>Term 2</option>
                <option>Term 3</option>
              </select>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
              <Bell size={18} />
              <span style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)', border: '2px solid var(--color-surface)' }} />
            </button>
            <button style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--color-border)', background: 'var(--color-surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
              <User size={18} />
            </button>
          </div>
        </div>

        {/* Overview Section */}
        <div className="dashboard-section-card">
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>Overview</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>Key metrics and performance indicators</p>
          </div>
          <div className="overview-stat-grid">
            <StatCard label="Total Students" value={data?.totalStudents ?? '—'} sub="" icon={Users} iconBg="var(--color-surface-raised)" iconColor="#6366f1" />
            <StatCard label="Total Teachers" value={data?.totalTeachers ?? '—'} sub="Active staff" icon={GraduationCap} iconBg="var(--color-surface-raised)" iconColor="#10b981" />
            <StatCard label="Total Classes" value={data?.totalClasses ?? '—'} sub="All streams" icon={Building2} iconBg="var(--color-surface-raised)" iconColor="#3b82f6" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-section-card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-body)' }}>
            <Activity size={16} /> Quick Actions
          </h3>
          <div className="quick-actions-grid">
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
            <a href="/dashboard/settings" className="setup-progress-link" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-accent-glow)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'var(--color-accent)',
                }}>
                  <Settings size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>Setup Progress</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' }}>0%</div>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-surface)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: '0%', height: '100%', background: 'var(--color-accent)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Complete school setup in Settings</div>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              </div>
            </a>
          </div>
        </div>

        {/* School Activity Section */}
        <div className="dashboard-section-card">
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>School Activity</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>Attendance and fee collection overview</p>
          </div>
          <div className="activity-grid">
            <QuickAction label="Fee Collection" desc="Track payments" href="/dashboard/students" icon={<Wallet size={18} />} />
            <QuickAction label="Attendance" desc="Daily tracking" href="/dashboard/attendance" icon={<CalendarCheck size={18} />} />
          </div>
        </div>

        {/* Insights */}
        <StudentsNeedingAttentionCard issues={[]} />
        <AcademicPerformanceCard stats={null} />
      </div>

      {/* ─── Right Sidebar Column (1/3 width) ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, fontFamily: 'var(--font-body)' }}>Recent Activity</h2>
          <button style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <Settings size={16} />
          </button>
        </div>
        <RecentAnnouncementsCard announcements={[]} />
        <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
        <RecentActivitiesCard activities={data?.recentActivities ?? []} />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? Building2 : i === 1 ? GraduationCap : i === 2 ? BarChart3 : FileText} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', gridColumn: 'span 2' }}>
          <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
          <RecentActivitiesCard activities={data?.recentActivities ?? []} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-1)' }}>Quick Actions</h3>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? Calendar : i === 1 ? BarChart3 : i === 2 ? GraduationCap : ClipboardList} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', gridColumn: 'span 2' }}>
          <UpcomingExamsCard exams={data?.upcomingExams ?? []} />
          <RecentActivitiesCard activities={data?.recentActivities ?? []} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-1)' }}>Quick Actions</h3>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {kpis.map((k, i) => (
          <StatCard key={i} label={k.label} value={k.value} sub={k.sub} icon={i === 0 ? BarChart3 : i === 1 ? GraduationCap : i === 2 ? Users : Calendar} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)' }}>
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
    <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
      {isAdmin && <AdminDashboard greeting={greeting} userName={userName} />}
      {role === 'CLASS_TEACHER' && <ClassTeacherDashboard />}
      {role === 'SUBJECT_TEACHER' && <SubjectTeacherDashboard />}
      {role === 'STUDENT' && <StudentDashboard />}
    </div>
  );
}
