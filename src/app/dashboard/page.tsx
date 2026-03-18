"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

/* ── Types ─────────────────────────────────────────────── */
interface KPI { label: string; value: string; sub: string; color?: string; }

/* ── Empty-state placeholder ───────────────────────────── */
function EmptyState({ message }: { message: string }) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center' }}>{message}</p>
        </div>
    );
}

/* ── KPI Card Grid ─────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════
   ADMIN DASHBOARD
   ══════════════════════════════════════════════════════════ */
function AdminDashboard() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [studentsRes, marksRes, reportsRes] = await Promise.all([
                supabase.from('students').select('id', { count: 'exact', head: true }),
                supabase.from('exam_marks').select('percentage'),
                supabase.from('report_cards').select('id', { count: 'exact', head: true }),
            ]);

            const totalStudents = studentsRes.count ?? 0;
            const marks = marksRes.data ?? [];
            const totalReports = reportsRes.count ?? 0;

            let avg = 0, passRate = 0;
            if (marks.length > 0) {
                const sum = marks.reduce((a, m) => a + Number(m.percentage), 0);
                avg = sum / marks.length;
                const passed = marks.filter(m => Number(m.percentage) >= 50).length;
                passRate = (passed / marks.length) * 100;
            }

            setKpis([
                { label: 'Total Students', value: totalStudents.toString(), sub: totalStudents > 0 ? 'Enrolled' : 'No students yet', color: totalStudents > 0 ? 'var(--color-text-muted)' : undefined },
                { label: 'School Average', value: marks.length > 0 ? `${avg.toFixed(1)}%` : '—', sub: marks.length > 0 ? `From ${marks.length} marks` : 'No exam data yet' },
                { label: 'Pass Rate', value: marks.length > 0 ? `${passRate.toFixed(1)}%` : '—', sub: marks.length > 0 ? '≥ 50% threshold' : 'No exam data yet' },
                { label: 'Reports Generated', value: totalReports.toString(), sub: totalReports > 0 ? 'Total' : 'None yet' },
            ]);
            setLoading(false);
        })();
    }, [supabase]);

    if (loading) return <LoadingSkeleton />;

    return (
        <>
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

/* ══════════════════════════════════════════════════════════
   CLASS TEACHER DASHBOARD
   ══════════════════════════════════════════════════════════ */
function ClassTeacherDashboard() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { user } = useAuth();
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [streamId, setStreamId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        (async () => {
            // Find teacher's assigned stream
            const { data: ctData } = await supabase
                .from('class_teachers')
                .select('current_grade_stream_id, grade_streams(full_name)')
                .eq('user_id', user.id)
                .limit(1)
                .single();

            const fetchedStreamId = ctData?.current_grade_stream_id;
            const streamName = (ctData?.grade_streams as { full_name?: string } | null)?.full_name || 'Not assigned';

            if (!fetchedStreamId) {
                setStreamId(null);
                setKpis([
                    { label: 'My Stream', value: '\u2014', sub: 'Not assigned to any stream' },
                    { label: 'Stream Students', value: '\u2014', sub: 'N/A' },
                    { label: 'Stream Average', value: '\u2014', sub: 'N/A' },
                    { label: 'Reports Pending', value: '\u2014', sub: 'N/A' },
                ]);
                setLoading(false);
                return;
            }

            setStreamId(fetchedStreamId);

            // Count students in that stream
            const { count: studentCount } = await supabase
                .from('students')
                .select('id', { count: 'exact', head: true })
                .eq('current_grade_stream_id', fetchedStreamId);

            setKpis([
                { label: 'My Stream', value: streamName, sub: 'Assigned homeroom' },
                { label: 'Stream Students', value: (studentCount ?? 0).toString(), sub: studentCount ? 'Enrolled' : 'No students yet' },
                { label: 'Stream Average', value: '—', sub: 'Enter marks to see' },
                { label: 'Reports Pending', value: '—', sub: 'Generate reports to track' },
            ]);
            setLoading(false);
        })();
    }, [user, supabase]);

    if (loading) return <LoadingSkeleton />;

    return (
        <>
            <KPICards kpis={kpis} />
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)' }}>
                <RecentStreamMarksCard streamId={streamId} />
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
            </div>
        </>
    );
}

/* ══════════════════════════════════════════════════════════
   SUBJECT TEACHER DASHBOARD
   ══════════════════════════════════════════════════════════ */
function SubjectTeacherDashboard() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { user } = useAuth();
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        (async () => {
            // Count exams created by this teacher
            const { count: examCount } = await supabase
                .from('exams')
                .select('id', { count: 'exact', head: true })
                .eq('created_by_teacher_id', user.id);

            // Get average from marks on exams this teacher created
            const { data: teacherExams } = await supabase
                .from('exams')
                .select('id')
                .eq('created_by_teacher_id', user.id);

            let avg = '—';
            let markCount = 0;
            if (teacherExams && teacherExams.length > 0) {
                const examIds = teacherExams.map(e => e.id);
                const { data: marks } = await supabase
                    .from('exam_marks')
                    .select('percentage')
                    .in('exam_id', examIds);

                if (marks && marks.length > 0) {
                    markCount = marks.length;
                    const sum = marks.reduce((a, m) => a + Number(m.percentage), 0);
                    avg = `${(sum / marks.length).toFixed(1)}%`;
                }
            }

            setKpis([
                { label: 'My Exams', value: (examCount ?? 0).toString(), sub: (examCount ?? 0) > 0 ? 'Created' : 'No exams yet' },
                { label: 'Subject Average', value: avg, sub: markCount > 0 ? `From ${markCount} marks` : 'Enter marks to see' },
                { label: 'Students Assessed', value: markCount.toString(), sub: markCount > 0 ? 'Total mark entries' : 'No data yet' },
                { label: 'Pending Entry', value: '—', sub: 'Create exams to track' },
            ]);
            setLoading(false);
        })();
    }, [user, supabase]);

    if (loading) return <LoadingSkeleton />;

    return (
        <>
            <KPICards kpis={kpis} />
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
                    <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📝</div>
                    <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Enter Marks</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                        Create exams and enter student marks
                    </p>
                    <a href="/dashboard/marks" style={{ textDecoration: 'none' }}>
                        <button className="btn-primary">Mark Entry →</button>
                    </a>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
                    <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
                    <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>Subject Analytics</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                        View your subject's performance
                    </p>
                    <a href="/dashboard/analytics" style={{ textDecoration: 'none' }}>
                        <button className="btn-secondary bg-[var(--color-surface-raised)] border border-[var(--color-border)]">View Analytics →</button>
                    </a>
                </div>
            </div>
        </>
    );
}

/* ══════════════════════════════════════════════════════════
   STUDENT DASHBOARD
   ══════════════════════════════════════════════════════════ */
function StudentDashboard() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { user } = useAuth();
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        (async () => {
            // Look up the student record from auth user.id
            const { data: studentRecord } = await supabase
                .from('students')
                .select('id')
                .eq('user_id', user.id)
                .limit(1)
                .single();

            if (!studentRecord) {
                setKpis([
                    { label: 'My Average', value: '—', sub: 'No student record found' },
                    { label: 'Best Subject', value: '—', sub: 'N/A' },
                    { label: 'Stream Position', value: '—', sub: 'N/A' },
                    { label: 'Exams Taken', value: '0', sub: 'No data yet' },
                ]);
                setLoading(false);
                return;
            }

            // Get all marks for this student
            const { data: marks } = await supabase
                .from('exam_marks')
                .select('percentage, exams(subject_id, subjects(name))')
                .eq('student_id', studentRecord.id);

            if (!marks || marks.length === 0) {
                setKpis([
                    { label: 'My Average', value: '—', sub: 'No marks yet' },
                    { label: 'Best Subject', value: '—', sub: 'N/A' },
                    { label: 'Stream Position', value: '—', sub: 'N/A' },
                    { label: 'Exams Taken', value: '0', sub: 'No data yet' },
                ]);
                setLoading(false);
                return;
            }

            // Calculate overall average
            const sum = marks.reduce((a, m) => a + Number(m.percentage), 0);
            const avg = sum / marks.length;

            // Find best subject  
            const subjectAvgs: Record<string, { total: number; count: number; name: string }> = {};
            for (const m of marks) {
                const exam = m.exams as { subject_id?: string; subjects?: { name?: string } | null } | null;
                const subName = exam?.subjects?.name || 'Unknown';
                const subId = exam?.subject_id || 'unknown';
                if (!subjectAvgs[subId]) subjectAvgs[subId] = { total: 0, count: 0, name: subName };
                subjectAvgs[subId].total += Number(m.percentage);
                subjectAvgs[subId].count++;
            }
            let bestSubject = '—';
            let bestAvg = 0;
            for (const [, val] of Object.entries(subjectAvgs)) {
                const subjAvg = val.total / val.count;
                if (subjAvg > bestAvg) {
                    bestAvg = subjAvg;
                    bestSubject = val.name;
                }
            }

            setKpis([
                { label: 'My Average', value: `${avg.toFixed(1)}%`, sub: `From ${marks.length} marks`, color: avg >= 50 ? 'var(--color-success)' : 'var(--color-warning)' },
                { label: 'Best Subject', value: bestSubject, sub: `${bestAvg.toFixed(0)}% average`, color: 'var(--color-success)' },
                { label: 'Stream Position', value: '—', sub: 'Coming soon' },
                { label: 'Exams Taken', value: marks.length.toString(), sub: 'Total entries' },
            ]);
            setLoading(false);
        })();
    }, [user, supabase]);

    if (loading) return <LoadingSkeleton />;

    return (
        <>
            <KPICards kpis={kpis} />
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 'var(--space-6)' }}>
                <LatestStudentResultsCard />
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
                    <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📄</div>
                    <h3 style={{ fontSize: 16, marginBottom: 'var(--space-2)', fontWeight: 600 }}>View My Reports</h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                        View and download your report cards
                    </p>
                    <a href="/dashboard/my-results" style={{ textDecoration: 'none' }}>
                        <button className="btn-primary">My Results →</button>
                    </a>
                </div>
            </div>
        </>
    );
}

/* ── Recent Stream Marks Card (Class Teacher) ──────────── */
function RecentStreamMarksCard({ streamId }: { streamId: string | null }) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [marks, setMarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!streamId) { setLoading(false); return; }
        (async () => {
            // Get students in this stream, then their recent marks
            const { data: students } = await supabase
                .from('students')
                .select('id')
                .eq('current_grade_stream_id', streamId);

            if (!students || students.length === 0) { setLoading(false); return; }

            const studentIds = students.map(s => s.id);
            const { data } = await supabase
                .from('exam_marks')
                .select('percentage, grade_symbol, created_at, students!inner(admission_number, users(first_name, last_name)), exams(name, subjects(name))')
                .in('student_id', studentIds)
                .order('created_at', { ascending: false })
                .limit(5);

            setMarks(data || []);
            setLoading(false);
        })();
    }, [streamId, supabase]);

    if (loading) return <div className="card p-6 text-center text-[var(--color-text-muted)] text-sm">Loading recent marks...</div>;

    if (!streamId || marks.length === 0) {
        return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
                <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📝</div>
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center' }}>No recent marks entered for your stream yet.</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-4)' }}>Recent Marks</h3>
            <div className="flex flex-col gap-2">
                {marks.map((m: any, i: number) => {
                    const student = m.students;
                    const name = student?.users ? `${student.users.first_name} ${student.users.last_name}` : student?.admission_number || 'Student';
                    const exam = m.exams as any;
                    const subject = exam?.subjects?.name || exam?.name || 'Exam';
                    const badgeClass = Number(m.percentage) >= 80 ? 'badge-success' : Number(m.percentage) >= 50 ? 'badge-warning' : 'badge-danger';
                    return (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-[var(--color-surface-raised)] transition-colors">
                            <div>
                                <div className="text-sm font-medium">{name}</div>
                                <div className="text-xs text-[var(--color-text-muted)]">{subject}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`badge ${badgeClass}`}>{m.grade_symbol || '-'}</span>
                                <span className="text-sm font-mono">{Number(m.percentage).toFixed(0)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Latest Student Results Card ───────────────────────── */
function LatestStudentResultsCard() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const { user } = useAuth();
    const [marks, setMarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        (async () => {
            // Look up the student record from auth user.id
            const { data: studentRecord } = await supabase
                .from('students')
                .select('id')
                .eq('user_id', user.id)
                .limit(1)
                .single();

            if (!studentRecord) { setLoading(false); return; }

            const { data } = await supabase
                .from('exam_marks')
                .select('percentage, grade_symbol, raw_score, created_at, exams(name, max_score, subjects(name))')
                .eq('student_id', studentRecord.id)
                .order('created_at', { ascending: false })
                .limit(3);

            setMarks(data || []);
            setLoading(false);
        })();
    }, [user, supabase]);

    if (loading) return <div className="card p-6 text-center text-[var(--color-text-muted)] text-sm">Loading results...</div>;

    if (marks.length === 0) {
        return (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
                <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center' }}>Your latest results will appear here as teachers enter marks.</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 'var(--space-4)' }}>Latest Results</h3>
            <div className="flex flex-col gap-2">
                {marks.map((m: any, i: number) => {
                    const exam = m.exams as any;
                    const subject = exam?.subjects?.name || exam?.name || 'Exam';
                    const badgeClass = Number(m.percentage) >= 80 ? 'badge-success' : Number(m.percentage) >= 50 ? 'badge-warning' : 'badge-danger';
                    return (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-[var(--color-surface-raised)] transition-colors">
                            <div>
                                <div className="text-sm font-medium">{subject}</div>
                                <div className="text-xs text-[var(--color-text-muted)] font-mono">{Number(m.raw_score)}/{Number(exam?.max_score || 100)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`badge ${badgeClass}`}>{m.grade_symbol || '-'}</span>
                                <span className="text-sm font-mono">{Number(m.percentage).toFixed(0)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Loading Skeleton ──────────────────────────────────── */
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

/* ── Role Labels ───────────────────────────────────────── */
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
            {/* Page Header */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>
                    {loading ? 'Dashboard' : `${greeting}`}
                </h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    {loading
                        ? 'Loading...'
                        : userName
                            ? `Welcome back, ${userName}. Here's your overview.`
                            : 'Overview of student performance and key metrics'
                    }
                </p>
            </div>

            {/* Role-specific content */}
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
