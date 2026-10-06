import React from 'react';
import { HomeScreen } from './Hero';
import {
    BarChart3, BookOpen, Briefcase, CalendarCheck, CircleCheck, ClipboardList, FileText, GraduationCap, Megaphone,
    UserPlus, Users, Wallet,
} from 'lucide-react-native';
import type { DashboardData } from '@shared/dashboard';
import { totalAttendanceCount } from '@shared/dashboard';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { hueForHref } from '@/lib/hues';
import { ErrorBanner } from '@/components/ui';
import { OperationsOverview } from '@/components/OperationsOverview';
import { PendingSchoolsNotice } from '@/components/platform/PendingSchools';
import { GradeResults } from './GradeResults';
import { DashboardHero } from './Hero';
import { DashboardSkeleton } from './Skeleton';
import { InsightCard, KpiTile, QuickActionGrid, Reveal, SectionTitle, type QuickAction } from './kit';
import {
    AcademicSummary, AttendanceBreakdown, ClassPerformanceList, FinanceSnapshot, RecentActivity, SetupChecklist, TodoList, UpcomingRounds,
} from './AdminSections';

const QUICK_ACTIONS: readonly QuickAction[] = ([
    { label: 'Enter marks', href: '/staff/exams', icon: ClipboardList },
    { label: 'Report cards', href: '/staff/reports', icon: FileText },
    { label: 'Attendance', href: '/staff/attendance', icon: CalendarCheck },
    { label: 'Add learner', href: '/staff/people', icon: UserPlus },
    { label: 'Add staff', href: '/staff/people?tab=teachers', icon: GraduationCap },
    { label: 'Announce', href: '/staff/announcements', icon: Megaphone },
    { label: 'Assignment', href: '/staff/assignments', icon: Briefcase },
    { label: 'Record payment', href: '/staff/fees', icon: Wallet },
] as const).map((a) => ({ ...a, hue: hueForHref(a.href) }));

/**
 * The school's command centre, the web's admin dashboard: where the school is
 * in its term, what needs doing, the figures once, every common task, then
 * how classes are doing and what's coming up.
 */
export function AdminHome({ name }: { name: string }) {
    const { profile } = useCurrentUser();
    const { data, loading, error, refresh, refreshing } = useApiQuery<DashboardData>('/api/school/dashboard', { raw: true });

    if (loading && !data) return <DashboardSkeleton />;

    const passRate = data?.academicSummary.markCount ? data.academicSummary.passRate : null;
    const marked = data?.attendanceToday ? totalAttendanceCount(data.attendanceToday) : 0;
    const presentRate = marked > 0 && data?.attendanceToday ? Math.round((data.attendanceToday.present / marked) * 100) : null;
    const billed = (data?.financeSummary.totalCollected ?? 0) + (data?.financeSummary.unpaidBalance ?? 0);
    const collectedRate = billed > 0 ? Math.round(((data?.financeSummary.totalCollected ?? 0) / billed) * 100) : null;
    const passMark = data?.academicSummary.passMark ?? 50;
    let i = 0;

    return (
        <HomeScreen onRefresh={refresh} refreshing={refreshing}>
            <PendingSchoolsNotice />
            {data ? <SetupChecklist data={data} schoolKey={profile?.school_id ?? 'school'} /> : null}
            <Reveal index={i++}>
                <DashboardHero
                    name={name}
                    term={data?.term ?? null}
                    canEditTerms
                    search
                />
            </Reveal>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            {data ? (
                <>
                    <Reveal index={i++}>
                        <SectionTitle title="Needs your attention" />
                        <TodoList data={data} />
                    </Reveal>

                    <Reveal index={i++}>
                        <OperationsOverview>
                            <KpiTile title="Learners" value={data.totalStudents.toLocaleString()} icon={Users} hue="blue" href="/staff/people" />
                            <KpiTile title="Teachers" value={data.totalTeachers} icon={GraduationCap} hue="violet" href="/staff/people?tab=teachers" />
                            <KpiTile title="Classes" value={data.totalClasses} icon={BookOpen} hue="amber" href="/staff/classes" />
                            {passRate != null ? (
                                <KpiTile title={`Pass rate (≥${passMark}%)`} value={`${passRate}%`} icon={BarChart3} hue="sky" href="/staff/analytics" tone={passRate >= 70 ? 'good' : passRate >= 40 ? 'warn' : 'bad'} />
                            ) : null}
                            {data.hasAttendanceData && presentRate != null ? (
                                <KpiTile title="Present today" value={`${presentRate}%`} icon={CircleCheck} hue="teal" href="/staff/attendance" tone="good" />
                            ) : null}
                            {data.hasFeeData && collectedRate != null ? (
                                <KpiTile title="Fees collected" value={`${collectedRate}%`} icon={Wallet} hue="emerald" href="/staff/fees" tone={collectedRate >= 80 ? 'good' : 'warn'} />
                            ) : null}
                        </OperationsOverview>
                    </Reveal>

                    <Reveal index={i++}>
                        <SectionTitle title="Quick actions" />
                        <QuickActionGrid actions={QUICK_ACTIONS} />
                    </Reveal>

                    <Reveal index={i++}>
                        <GradeResults passMark={passMark} />
                    </Reveal>

                    <Reveal index={i++} style={{ marginTop: 20 }}>
                        <InsightCard
                            title="How classes are doing"
                            meta={`${(data.classPerformance ?? []).filter((c) => c.markCount > 0).length} with marks · weakest first`}
                            action={{ label: 'Analytics', href: '/staff/analytics' }}
                        >
                            <ClassPerformanceList classes={data.classPerformance ?? []} passMark={passMark} />
                        </InsightCard>
                        <InsightCard title="Coming up" meta="Next three weeks" action={{ label: 'Exams', href: '/staff/exams' }}>
                            <UpcomingRounds rounds={data.upcomingRounds ?? []} />
                        </InsightCard>
                        <InsightCard title="Academic performance" meta="This year">
                            <AcademicSummary summary={data.academicSummary} />
                        </InsightCard>
                        {data.hasAttendanceData && data.attendanceToday ? (
                            <InsightCard title="Attendance today" meta={`${marked.toLocaleString()} marked`} action={{ label: 'Register', href: '/staff/attendance' }}>
                                <AttendanceBreakdown counts={data.attendanceToday} />
                            </InsightCard>
                        ) : null}
                        {data.hasFeeData ? (
                            <InsightCard title="Fee collection" meta="Current term" action={{ label: 'Fees', href: '/staff/fees' }}>
                                <FinanceSnapshot collected={data.financeSummary.totalCollected} unpaid={data.financeSummary.unpaidBalance} overdue={data.financeSummary.overdueCount} />
                            </InsightCard>
                        ) : null}
                        <InsightCard title="Recent activity">
                            <RecentActivity activities={data.recentActivities} />
                        </InsightCard>
                    </Reveal>
                </>
            ) : null}
        </HomeScreen>
    );
}
