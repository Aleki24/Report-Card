import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useCurrentUser } from '@/lib/UserContext';
import { useApiQuery } from '@/lib/useApiQuery';
import {
    Button, ButtonRow, Card, DateBadge, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView,
    ProgressBar, Screen, SectionLabel, StatGrid, StatTile, Badge,
} from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import {
    TONE_COLORS, formatCurrency, formatLongToday, getGreeting, getTimeAgo, isSoon,
    passRateLabel, passRateTone, pluralize, shortCurriculumLabel,
} from '@/lib/format';
import { currentTermNumber } from '@/lib/academics';
import type { ClassTeacherStats, StaffDashboardSummary, SubjectTeacherStats } from '@/lib/types';

export default function StaffDashboardScreen() {
    const { role, profile } = useCurrentUser();
    const firstName = profile?.first_name ?? '';

    if (role === 'STAFF') return <StaffWelcome name={firstName} jobTitle={profile?.job_title ?? null} />;
    if (role === 'ADMIN') return <AdminDashboard name={firstName} />;
    return <TeacherDashboard name={firstName} kind={role === 'CLASS_TEACHER' ? 'class_teacher' : 'subject_teacher'} />;
}

// ── Shared pieces ──────────────────────────────────────────

function Hero({ name, children }: { name: string; children?: React.ReactNode }) {
    return (
        <View style={styles.hero}>
            <Text style={styles.heroGreeting}>
                {getGreeting()}, {name || 'there'}
            </Text>
            <Text style={styles.heroDate}>
                {formatLongToday()} · Term {currentTermNumber()}
            </Text>
            {children ? <View style={styles.heroActions}>{children}</View> : null}
        </View>
    );
}

function HeroButton({ label, href, solid }: { label: string; href: Href; solid?: boolean }) {
    const router = useRouter();
    return (
        <Text onPress={() => router.push(href)} style={[styles.heroButton, solid ? styles.heroButtonSolid : styles.heroButtonGhost]}>
            {label}
        </Text>
    );
}

function UpcomingExams({ exams }: { exams: StaffDashboardSummary['upcomingExams'] }) {
    return (
        <>
            <SectionLabel>Upcoming exams</SectionLabel>
            <ListCard>
                {exams.length === 0 ? (
                    <EmptyState title="No upcoming exams" description="Scheduled exams will appear here." />
                ) : (
                    exams.slice(0, 5).map((exam) => {
                        const soon = isSoon(exam.exam_date);
                        return (
                            <ListRow
                                key={exam.id}
                                left={<DateBadge date={exam.exam_date} highlight={soon} />}
                                title={exam.name}
                                subtitle={`${exam.subject_name} · ${exam.grade_name}`}
                                right={soon ? <Badge label="SOON" variant="warning" /> : undefined}
                            />
                        );
                    })
                )}
            </ListCard>
        </>
    );
}

function RecentActivity({ activities }: { activities: StaffDashboardSummary['recentActivities'] }) {
    return (
        <>
            <SectionLabel>Recent activity</SectionLabel>
            <ListCard>
                {activities.length === 0 ? (
                    <EmptyState title="No recent activity" description="Marks, enrolments and report cards will be listed here." />
                ) : (
                    activities.slice(0, 6).map((a, i) => (
                        <ListRow key={`${a.timestamp}-${i}`} title={a.message} right={<Text style={styles.muted}>{getTimeAgo(a.timestamp)}</Text>} />
                    ))
                )}
            </ListCard>
        </>
    );
}

interface QuickLink {
    label: string;
    desc: string;
    href: Href;
}

function QuickActions({ links }: { links: readonly QuickLink[] }) {
    const router = useRouter();
    return (
        <>
            <SectionLabel>Quick actions</SectionLabel>
            <ListCard>
                {links.map((l) => (
                    <ListRow key={l.label} title={l.label} subtitle={l.desc} onPress={() => router.push(l.href)} />
                ))}
            </ListCard>
        </>
    );
}

// ── Admin ──────────────────────────────────────────────────

const ADMIN_LINKS: readonly QuickLink[] = [
    { label: 'Enter marks', desc: 'Record exam scores', href: '/staff/exams' },
    { label: 'Add student or teacher', desc: 'People and accounts', href: '/staff/people' },
    { label: 'Record payment', desc: 'Fees and receipts', href: '/staff/fees' },
    { label: 'Generate reports', desc: 'Report cards and mark sheets', href: '/staff/reports' },
    { label: 'View analytics', desc: 'How each class is doing', href: '/staff/analytics' },
];

function AdminDashboard({ name }: { name: string }) {
    const router = useRouter();
    const { data, loading, error, refresh, refreshing } = useApiQuery<StaffDashboardSummary>('/api/school/dashboard', { raw: true });

    if (loading) return <LoadingView />;

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <Hero name={name}>
                <HeroButton label="📄 Report cards" href="/staff/reports" solid />
                <HeroButton label="📝 Enter marks" href="/staff/exams" />
            </Hero>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            {data ? (
                <>
                    <SetupChecklist data={data} />

                    <SectionLabel>At a glance</SectionLabel>
                    <StatGrid>
                        <StatTile label="Students" value={data.totalStudents} onPress={() => router.push('/staff/people')} />
                        <StatTile label="Teachers" value={data.totalTeachers} onPress={() => router.push('/staff/people?tab=teachers')} />
                        <StatTile label="Classes" value={data.totalClasses} onPress={() => router.push('/staff/classes')} />
                        <StatTile label="Reports" value={data.totalReports} onPress={() => router.push('/staff/reports')} />
                        {/* Always shown: zero outstanding is the good news. */}
                        <StatTile
                            label="Marks outstanding"
                            value={data.examsAwaitingMarks}
                            tone={data.examsAwaitingMarks > 0 ? colors.warning : undefined}
                            onPress={() => router.push('/staff/exams')}
                        />
                        {data.hasAttendanceData ? (
                            <StatTile label="Present today" value={data.attendanceToday?.present ?? 0} tone={colors.success} onPress={() => router.push('/staff/attendance')} />
                        ) : null}
                        {data.hasFeeData ? (
                            <StatTile
                                label="Overdue fees"
                                value={data.overdueFeesCount}
                                tone={data.overdueFeesCount > 0 ? colors.danger : undefined}
                                onPress={() => router.push('/staff/fees')}
                            />
                        ) : null}
                    </StatGrid>

                    <SectionLabel action={<Text style={styles.link} onPress={() => router.push('/staff/analytics')}>Analytics ›</Text>}>
                        How classes are doing
                    </SectionLabel>
                    <ClassPerformanceList classes={data.classPerformance} />

                    <SectionLabel action={<Text style={styles.link} onPress={() => router.push('/staff/exams')}>Enter marks ›</Text>}>
                        Marks outstanding
                    </SectionLabel>
                    <OutstandingMarks total={data.examsAwaitingMarks} byClass={data.unmarkedByClass} />

                    <SectionLabel>Academic performance</SectionLabel>
                    <AcademicSummary summary={data.academicSummary} />

                    <SectionLabel>Needs attention</SectionLabel>
                    <NeedsAttention data={data} />

                    {data.hasAttendanceData && data.attendanceToday ? (
                        <>
                            <SectionLabel>Attendance today</SectionLabel>
                            <AttendanceBreakdown counts={data.attendanceToday} />
                        </>
                    ) : null}

                    {data.hasFeeData ? (
                        <>
                            <SectionLabel>Fee collection · current term</SectionLabel>
                            <FinanceSnapshot {...data.financeSummary} />
                        </>
                    ) : null}

                    <UpcomingExams exams={data.upcomingExams} />
                    <RecentActivity activities={data.recentActivities} />
                </>
            ) : null}

            <QuickActions links={ADMIN_LINKS} />
        </Screen>
    );
}

function SetupChecklist({ data }: { data: StaffDashboardSummary }) {
    const router = useRouter();
    const steps: { label: string; done: boolean; href: Href }[] = [
        { label: 'Upload your school logo', done: data.hasLogo, href: '/staff/settings' },
        { label: 'Add teachers', done: data.totalTeachers > 0, href: '/staff/people?tab=teachers' },
        { label: 'Add students', done: data.totalStudents > 0, href: '/staff/people' },
    ];
    const remaining = steps.filter((s) => !s.done);
    if (remaining.length === 0) return null;
    return (
        <Card style={{ marginBottom: spacing.md, borderColor: colors.primary }}>
            <Text style={styles.cardTitle}>Finish setting up · {steps.length - remaining.length} of {steps.length} done</Text>
            {remaining.map((s) => (
                <Text key={s.label} style={[styles.link, { marginTop: spacing.sm }]} onPress={() => router.push(s.href)}>
                    ○ {s.label} ›
                </Text>
            ))}
        </Card>
    );
}

function ClassPerformanceList({ classes }: { classes: StaffDashboardSummary['classPerformance'] }) {
    const withMarks = classes.filter((c) => c.markCount > 0);
    if (withMarks.length === 0) {
        return (
            <Card>
                <EmptyState title="No marks recorded yet" description="Once exams are marked, each class will appear here." />
            </Card>
        );
    }
    // Weakest first (the API sorts that way): a struggling class is the reason to look.
    return (
        <ListCard>
            {withMarks.slice(0, 6).map((c) => {
                const tone = passRateTone(c.passRate);
                const curriculum = shortCurriculumLabel(c.levelCode);
                return (
                    <View key={c.id} style={styles.perfRow}>
                        <View style={styles.perfHeader}>
                            <Text style={styles.perfName} numberOfLines={1}>
                                {c.name}
                                {curriculum ? <Text style={styles.muted}>  {curriculum}</Text> : null}
                            </Text>
                            <Text style={[styles.perfRate, { color: TONE_COLORS[tone] }]}>{c.passRate ?? '—'}%</Text>
                        </View>
                        <ProgressBar value={c.passRate ?? 0} color={TONE_COLORS[tone]} />
                        <Text style={styles.perfMeta}>
                            {pluralize(c.students, 'learner')} · mean {c.mean ?? '—'}% · {pluralize(c.markCount, 'mark')}
                        </Text>
                    </View>
                );
            })}
        </ListCard>
    );
}

function OutstandingMarks({ total, byClass }: { total: number; byClass: StaffDashboardSummary['unmarkedByClass'] }) {
    if (total === 0) {
        return (
            <Card>
                <Text style={styles.cardTitle}>All caught up ✓</Text>
                <Text style={styles.muted}>Every exam sat this year has marks entered.</Text>
            </Card>
        );
    }
    return (
        <ListCard>
            <ListRow title={`${pluralize(total, 'exam')} sat, not entered`} subtitle="Grouped by class, most behind first" />
            {byClass.slice(0, 6).map((c) => (
                <ListRow
                    key={c.label}
                    title={c.label}
                    subtitle={shortCurriculumLabel(c.levelCode)}
                    right={<Badge label={String(c.count)} variant="warning" />}
                />
            ))}
        </ListCard>
    );
}

/**
 * Leads with pass rate, not the mean: the mean mostly reflects how hard the
 * papers were, while pass rate says how many learners reached the pass mark.
 */
function AcademicSummary({ summary }: { summary: StaffDashboardSummary['academicSummary'] }) {
    if (summary.markCount === 0 || summary.passRate == null) {
        return (
            <Card>
                <EmptyState title="No exam data yet" />
            </Card>
        );
    }
    const tone = TONE_COLORS[passRateTone(summary.passRate)];
    return (
        <Card>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Text style={styles.bigNumber}>{summary.passRate}%</Text>
                <Text style={styles.muted}>of marks at or above {summary.passMark}%</Text>
            </View>
            <View style={{ marginTop: spacing.md }}>
                <ProgressBar value={summary.passRate} color={tone} />
            </View>
            <Text style={[styles.muted, { marginTop: spacing.sm }]}>
                <Text style={{ color: tone, fontWeight: '700' }}>{passRateLabel(summary.passRate)}</Text>
                {summary.recentAvg != null ? ` · ${summary.recentAvg}% average across ${pluralize(summary.markCount, 'mark')}` : ''}
            </Text>
        </Card>
    );
}

/** Rows drop out when they have nothing to say, except the two always worth stating. */
function NeedsAttention({ data }: { data: StaffDashboardSummary }) {
    const router = useRouter();
    const soon = data.upcomingExams.filter((e) => isSoon(e.exam_date)).length;
    const items: { label: string; count: number; sub: string | null; href: Href; always: boolean }[] = [
        { label: 'Marks outstanding', count: data.examsAwaitingMarks, sub: 'exams sat, not entered', href: '/staff/exams', always: true },
        { label: 'Upcoming exams', count: data.upcomingExams.length, sub: soon > 0 ? `${soon} soon` : null, href: '/staff/exams', always: true },
        { label: 'Subjects without a grading system', count: data.subjectsWithoutGradingSystem, sub: 'no grade can be awarded', href: '/staff/subjects', always: false },
        { label: 'New enrolments', count: data.recentEnrollmentsLast7, sub: 'this week', href: '/staff/people', always: false },
        { label: 'Overdue fees', count: data.overdueFeesCount, sub: 'past due date', href: '/staff/fees', always: data.hasFeeData },
        { label: 'Announcements', count: data.announcementsLast7Days, sub: 'this week', href: '/staff/announcements', always: false },
        { label: 'Report cards', count: data.totalReports, sub: 'total generated', href: '/staff/reports', always: false },
    ];
    return (
        <ListCard>
            {items
                .filter((i) => i.always || i.count > 0)
                .map((i) => (
                    <ListRow
                        key={i.label}
                        left={
                            <View style={[styles.countBox, i.count > 0 && { backgroundColor: colors.infoBg }]}>
                                <Text style={[styles.countText, i.count > 0 && { color: colors.primary }]}>{i.count}</Text>
                            </View>
                        }
                        title={i.label}
                        subtitle={i.sub}
                        onPress={() => router.push(i.href)}
                    />
                ))}
        </ListCard>
    );
}

// Present and absent never sit side by side, so the bar reads under red–green colour blindness.
const ATTENDANCE_SEGMENTS = [
    { key: 'present', label: 'Present', color: colors.success },
    { key: 'late', label: 'Late', color: colors.warning },
    { key: 'excused', label: 'Excused', color: colors.info },
    { key: 'absent', label: 'Absent', color: colors.danger },
] as const;

function AttendanceBreakdown({ counts }: { counts: StaffDashboardSummary['attendanceToday'] & object }) {
    const total = counts.present + counts.absent + counts.late + counts.excused;
    if (total === 0) {
        return (
            <Card>
                <EmptyState title="No attendance marked yet today" />
            </Card>
        );
    }
    return (
        <Card>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <Text style={styles.bigNumber}>{Math.round((counts.present / total) * 100)}%</Text>
                <Text style={styles.muted}>present · {total} marked</Text>
            </View>
            <View style={styles.stackedBar}>
                {ATTENDANCE_SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
                    <View key={s.key} style={{ flex: counts[s.key], backgroundColor: s.color }} />
                ))}
            </View>
            <View style={styles.legend}>
                {ATTENDANCE_SEGMENTS.map((s) => (
                    <View key={s.key} style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: s.color }]} />
                        <Text style={styles.legendText}>
                            <Text style={{ fontWeight: '700', color: colors.foreground }}>{counts[s.key]}</Text> {s.label.toLowerCase()}
                        </Text>
                    </View>
                ))}
            </View>
        </Card>
    );
}

function FinanceSnapshot({ totalCollected, unpaidBalance, overdueCount }: StaffDashboardSummary['financeSummary']) {
    const billed = totalCollected + unpaidBalance;
    const rate = billed > 0 ? Math.round((totalCollected / billed) * 100) : null;
    return (
        <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                <View>
                    <Text style={styles.moneyBig}>{formatCurrency(totalCollected)}</Text>
                    <Text style={styles.muted}>Collected</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.moneySmall}>{formatCurrency(unpaidBalance)}</Text>
                    <Text style={styles.muted}>Outstanding</Text>
                </View>
            </View>
            {rate !== null ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                    <ProgressBar value={rate} />
                    <Text style={styles.muted}>{rate}% of billed fees collected</Text>
                </View>
            ) : (
                <Text style={[styles.muted, { marginTop: spacing.md }]}>No fees billed yet this term</Text>
            )}
            <Text style={[styles.muted, { marginTop: spacing.sm }]}>
                {overdueCount > 0 ? `⚠️ ${pluralize(overdueCount, 'invoice')} overdue` : 'No overdue invoices'}
            </Text>
        </Card>
    );
}

// ── Class & subject teachers ───────────────────────────────

const TEACHER_LINKS: Record<'class_teacher' | 'subject_teacher', readonly QuickLink[]> = {
    class_teacher: [
        { label: 'Enter marks', desc: 'Record exam scores for your class', href: '/staff/exams' },
        { label: 'Class results', desc: 'Broadsheet and rankings', href: '/staff/exams?tab=results' },
        { label: 'Take attendance', desc: 'Daily class register', href: '/staff/attendance' },
        { label: 'Generate reports', desc: 'Report cards for your class', href: '/staff/reports' },
        { label: 'My students', desc: 'Class roster', href: '/staff/people' },
    ],
    subject_teacher: [
        { label: 'Enter marks', desc: 'Record exam scores', href: '/staff/exams' },
        { label: 'Exam results', desc: 'Scores and subject averages', href: '/staff/exams?tab=results' },
        { label: 'Release results', desc: 'Publish marks you have entered', href: '/staff/exams?tab=publish' },
        { label: 'Assignments', desc: 'Set work for your classes', href: '/staff/assignments' },
    ],
};

function TeacherDashboard({ name, kind }: { name: string; kind: 'class_teacher' | 'subject_teacher' }) {
    const summary = useApiQuery<StaffDashboardSummary>('/api/school/dashboard', { raw: true });
    const stats = useApiQuery<ClassTeacherStats | SubjectTeacherStats>(`/api/school/stats?role=${kind}`, { raw: true });

    if (summary.loading || stats.loading) return <LoadingView />;

    const refresh = () => {
        summary.refresh();
        stats.refresh();
    };
    const error = summary.error ?? stats.error;

    return (
        <Screen onRefresh={refresh} refreshing={summary.refreshing || stats.refreshing}>
            <Hero name={name}>
                <HeroButton label="📝 Enter marks" href="/staff/exams" solid />
                {kind === 'class_teacher' ? <HeroButton label="📅 Attendance" href="/staff/attendance" /> : <HeroButton label="📚 Assignments" href="/staff/assignments" />}
            </Hero>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            {stats.data ? (
                kind === 'class_teacher' ? (
                    <ClassTeacherKpis stats={stats.data as ClassTeacherStats} />
                ) : (
                    <SubjectTeacherKpis stats={stats.data as SubjectTeacherStats} />
                )
            ) : null}

            {summary.data ? (
                <>
                    <UpcomingExams exams={summary.data.upcomingExams} />
                    <RecentActivity activities={summary.data.recentActivities} />
                </>
            ) : null}

            <QuickActions links={TEACHER_LINKS[kind]} />
        </Screen>
    );
}

function ClassTeacherKpis({ stats }: { stats: ClassTeacherStats }) {
    const hasAvg = stats.streamAvg !== '—';
    return (
        <>
            <SectionLabel>{stats.streamName && stats.streamName !== '—' ? stats.streamName : 'Your class'}</SectionLabel>
            <StatGrid>
                <StatTile label="My stream" value={stats.streamName || '—'} sub="Assigned homeroom" />
                <StatTile label="Stream students" value={stats.studentCount} sub={stats.studentCount ? 'Enrolled' : 'No students yet'} />
                <StatTile label="Stream average" value={hasAvg ? `${stats.streamAvg}%` : '—'} sub={hasAvg ? 'Class average' : 'Enter marks to see'} />
                <StatTile label="Reports pending" value={stats.reportsPending} sub={stats.reportsPending > 0 ? 'Need generation' : 'All done!'} />
            </StatGrid>
        </>
    );
}

function SubjectTeacherKpis({ stats }: { stats: SubjectTeacherStats }) {
    return (
        <>
            <SectionLabel>Your subjects</SectionLabel>
            <StatGrid>
                <StatTile label="My exams" value={stats.examCount} sub={stats.examCount > 0 ? 'Created' : 'No exams yet'} />
                <StatTile label="Subject average" value={stats.avg !== '—' ? `${stats.avg}%` : '—'} sub={stats.markCount > 0 ? `From ${pluralize(stats.markCount, 'mark')}` : 'Enter marks to see'} />
                <StatTile label="Students assessed" value={stats.markCount} sub={stats.markCount > 0 ? 'Total mark entries' : 'No data yet'} />
            </StatGrid>
        </>
    );
}

// ── Non-teaching staff ─────────────────────────────────────

function StaffWelcome({ name, jobTitle }: { name: string; jobTitle: string | null }) {
    const router = useRouter();
    return (
        <Screen>
            <Hero name={name} />
            <Card>
                <Text style={styles.cardTitle}>Welcome{name ? `, ${name}` : ''} 👋</Text>
                <Text style={styles.muted}>{jobTitle ? `You're signed in as ${jobTitle}.` : "You're signed in as staff."}</Text>
                <Text style={[styles.muted, { marginTop: spacing.sm }]}>
                    Use Announcements to stay up to date. Your administrator can grant you more access when needed.
                </Text>
                <ButtonRow>
                    <Button label="Open announcements" onPress={() => router.push('/staff/announcements')} />
                </ButtonRow>
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
    heroGreeting: { color: colors.white, fontSize: 20, fontWeight: '800' },
    heroDate: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
    heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    heroButton: { borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.md, fontSize: 13, fontWeight: '700', overflow: 'hidden' },
    heroButtonSolid: { backgroundColor: colors.white, color: colors.primaryDark },
    heroButtonGhost: { backgroundColor: 'rgba(255,255,255,0.15)', color: colors.white },
    link: { color: colors.primary, fontSize: 12, fontWeight: '700' },
    muted: { fontSize: 12, color: colors.muted },
    cardTitle: { fontSize: 14, fontWeight: '800', color: colors.foreground, marginBottom: 2 },
    bigNumber: { fontSize: 32, fontWeight: '800', color: colors.foreground },
    moneyBig: { fontSize: 20, fontWeight: '800', color: colors.foreground },
    moneySmall: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    perfRow: { padding: spacing.md, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    perfHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    perfName: { fontSize: 14, fontWeight: '700', color: colors.foreground, flex: 1 },
    perfRate: { fontSize: 14, fontWeight: '800' },
    perfMeta: { fontSize: 11, color: colors.muted },
    countBox: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
    countText: { fontSize: 13, fontWeight: '800', color: colors.muted },
    stackedBar: { flexDirection: 'row', height: 12, borderRadius: 999, overflow: 'hidden', gap: 2, marginTop: spacing.md },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontSize: 12, color: colors.muted },
    dot: { width: 10, height: 10, borderRadius: 5 },
});
