"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface KPI { label: string; value: string; sub: string; color?: string; }

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
      <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center' }}>{message}</p>
    </div>
  );
}

function KPICards({ kpis }: { kpis: KPI[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      {kpis.map((k, i) => (
        <div className="stat-card" key={i}>
          <div className="stat-label">{k.label}</div>
          <div className="stat-value">{k.value}</div>
          <div style={{ fontSize: 12, color: k.color || 'var(--color-text-muted)' }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      {[1, 2, 3, 4].map(i => (
        <div className="stat-card" key={i} style={{ opacity: 0.5 }}>
          <div className="stat-label">Loading...</div>
          <div className="stat-value">—</div>
        </div>
      ))}
    </div>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────
function AdminDashboard() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Fetch school-scoped students count
        const studentsRes = await fetch('/api/school/data?type=students');
        const studentsJson = await studentsRes.json();
        const totalStudents = (studentsJson.data || []).length;

        // Fetch school-scoped exam marks via a dedicated endpoint
        const marksRes = await fetch('/api/school/stats');
        const marksJson = await marksRes.json();
        const marks = marksJson.marks || [];
        const totalReports = marksJson.totalReports || 0;

        let avg = 0, passRate = 0;
        if (marks.length > 0) {
          const sum = marks.reduce((a: number, m: any) => a + Number(m.percentage), 0);
          avg = sum / marks.length;
          const passed = marks.filter((m: any) => Number(m.percentage) >= 50).length;
          passRate = (passed / marks.length) * 100;
        }

        setKpis([
          { label: 'Total Students', value: totalStudents.toString(), sub: totalStudents > 0 ? 'Enrolled' : 'No students yet' },
          { label: 'School Average', value: marks.length > 0 ? `${avg.toFixed(1)}%` : '—', sub: marks.length > 0 ? `From ${marks.length} marks` : 'No exam data yet' },
          { label: 'Pass Rate', value: marks.length > 0 ? `${passRate.toFixed(1)}%` : '—', sub: marks.length > 0 ? '≥ 50% threshold' : 'No exam data yet' },
          { label: 'Reports Generated', value: totalReports.toString(), sub: totalReports > 0 ? 'Total' : 'None yet' },
        ]);
      } catch (err) {
        console.error('Admin dashboard fetch error:', err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-1">Welcome to the Admin Dashboard</h3>
          <ul className="list-disc pl-4 space-y-1 opacity-90">
            <li>Ensure you setup the <strong>Academic Structure</strong> and <strong>Calendar</strong> in Settings first.</li>
            <li>Create <strong>Users</strong> (Teachers/Students) and assign them to their respective roles and classes.</li>
            <li>Monitor school-wide performance through the analytics module.</li>
          </ul>
        </div>
      </div>
      <KPICards kpis={kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>👥</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Manage Users</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
            Invite teachers, add students, and manage roles
          </p>
          <a href="/dashboard/users" style={{ textDecoration: 'none' }}>
            <button className="btn-primary">Go to Users →</button>
          </a>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>School Analytics</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
            View performance trends and subject statistics
          </p>
          <a href="/dashboard/analytics" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary bg-[var(--color-surface-raised)] border border-[var(--color-border)]">View Analytics →</button>
          </a>
        </div>
      </div>
    </>
  );
}

// ── Class Teacher Dashboard ──────────────────────────────────
function ClassTeacherDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/school/stats?role=class_teacher');
        const json = await res.json();
        const streamName = json.streamName || '—';
        const studentCount = json.studentCount || 0;

        setKpis([
          { label: 'My Stream', value: streamName, sub: 'Assigned homeroom' },
          { label: 'Stream Students', value: studentCount.toString(), sub: studentCount ? 'Enrolled' : 'No students yet' },
          { label: 'Stream Average', value: '—', sub: 'Enter marks to see' },
          { label: 'Reports Pending', value: '—', sub: 'Generate reports to track' },
        ]);
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
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-1">Class Teacher Guide</h3>
          <ul className="list-disc pl-4 space-y-1 opacity-90">
            <li>As a Class Teacher, you manage the students in your assigned homeroom stream.</li>
            <li>You are responsible for generating the final <strong>Report Cards</strong> at the end of the term.</li>
            <li>Use the <strong>Generate Reports</strong> section below to compile marks across all subjects for your class.</li>
          </ul>
        </div>
      </div>
      <KPICards kpis={kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📋</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Generate Reports</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
            Generate report cards for all students in your homeroom
          </p>
          <a href="/dashboard/reports" style={{ textDecoration: 'none' }}>
            <button className="btn-primary">Go to Reports →</button>
          </a>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Class Analytics</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
            View performance trends for your class
          </p>
          <a href="/dashboard/analytics" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary bg-[var(--color-surface-raised)] border border-[var(--color-border)]">View Analytics →</button>
          </a>
        </div>
      </div>
    </>
  );
}

// ── Subject Teacher Dashboard ────────────────────────────────
function SubjectTeacherDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/school/stats?role=subject_teacher');
        const json = await res.json();
        setKpis([
          { label: 'My Exams', value: (json.examCount || 0).toString(), sub: (json.examCount || 0) > 0 ? 'Created' : 'No exams yet' },
          { label: 'Subject Average', value: json.avg || '—', sub: json.markCount > 0 ? `From ${json.markCount} marks` : 'Enter marks to see' },
          { label: 'Students Assessed', value: (json.markCount || 0).toString(), sub: json.markCount > 0 ? 'Total mark entries' : 'No data yet' },
          { label: 'Pending Entry', value: '—', sub: 'Create exams to track' },
        ]);
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
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-1">Subject Teacher Guide</h3>
          <ul className="list-disc pl-4 space-y-1 opacity-90">
            <li>As a Subject Teacher, you create exams and enter marks for the subjects you teach.</li>
            <li>Go to <strong>Exams</strong> to schedule a new assessment for your subjects.</li>
            <li>Use the <strong>Enter Marks</strong> section below to record student scores.</li>
          </ul>
        </div>
      </div>
      <KPICards kpis={kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📝</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Enter Marks</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>Create exams and enter student marks</p>
          <a href="/dashboard/marks" style={{ textDecoration: 'none' }}>
            <button className="btn-primary">Mark Entry →</button>
          </a>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Subject Analytics</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>View your subject&apos;s performance</p>
          <a href="/dashboard/analytics" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary bg-[var(--color-surface-raised)] border border-[var(--color-border)]">View Analytics →</button>
          </a>
        </div>
      </div>
    </>
  );
}

// ── Student Dashboard ────────────────────────────────────────
function StudentDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/school/stats?role=student');
        const json = await res.json();
        setKpis([
          { label: 'My Average', value: json.avg ? `${json.avg}%` : '—', sub: json.markCount > 0 ? `From ${json.markCount} marks` : 'No marks yet', color: json.avg >= 50 ? 'var(--color-success)' : 'var(--color-warning)' },
          { label: 'Best Subject', value: json.bestSubject || '—', sub: json.bestScore ? `${json.bestScore}% average` : 'N/A', color: 'var(--color-success)' },
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
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-lg flex items-start gap-3 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div className="text-sm">
          <h3 className="font-semibold mb-1">Student Guide</h3>
          <ul className="list-disc pl-4 space-y-1 opacity-90">
            <li>Welcome to your personalized student dashboard!</li>
            <li>View your academic progress, track your performance over time, and download your <strong>Report Cards</strong>.</li>
            <li>Check the <strong>My Analytics</strong> section to see detailed subject breakdowns.</li>
          </ul>
        </div>
      </div>
      <KPICards kpis={kpis} />
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📄</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>View My Reports</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>View and download your report cards</p>
          <a href="/dashboard/my-results" style={{ textDecoration: 'none' }}>
            <button className="btn-primary">My Results →</button>
          </a>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
          <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>My Analytics</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>See how you are performing across subjects</p>
          <a href="/dashboard/analytics" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary bg-[var(--color-surface-raised)] border border-[var(--color-border)]">View Analytics →</button>
          </a>
        </div>
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

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>
          {loading ? 'Dashboard' : greeting}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          {loading ? 'Loading...' : userName ? `Welcome back, ${userName}. Here's your overview.` : 'Overview of student performance and key metrics'}
        </p>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {role === 'ADMIN' && <AdminDashboard />}
          {role === 'CLASS_TEACHER' && <ClassTeacherDashboard />}
          {role === 'SUBJECT_TEACHER' && <SubjectTeacherDashboard />}
          {role === 'STUDENT' && <StudentDashboard />}
          {!role && <AdminDashboard />}
        </>
      )}
    </div>
  );
}
