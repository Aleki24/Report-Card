import React, { useState } from 'react';
import { HomeScreen } from './Hero';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
    ArrowRight, BarChart3, BookOpenCheck, CalendarCheck, ChevronDown, CircleCheck, ClipboardList, FileText, GraduationCap,
    Inbox, Megaphone, NotebookPen, PenLine, Send, Users,
} from 'lucide-react-native';
import type { DashboardData } from '@shared/dashboard';
import { useApiQuery } from '@/lib/useApiQuery';
import { hueForHref } from '@/lib/hues';
import type { ClassTeacherStats, SubjectTeacherStats } from '@/lib/types';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { OperationsOverview } from '@/components/OperationsOverview';
import { DashboardHero, type HeroAction } from './Hero';
import { DashboardSkeleton } from './Skeleton';
import { MarkingPanel, markEntryRoute, useMarking } from './MarkingProgress';
import { InsightCard, KpiTile, LinkRow, Reveal } from './kit';
import { UpcomingRounds } from './AdminSections';

type Variant = 'class' | 'subject';

const QUICK_LINKS: Record<Variant, readonly { label: string; desc: string; href: `/staff${string}`; icon: typeof PenLine }[]> = {
    class: [
        { label: 'Enter or correct marks', desc: 'Type, fix or remove marks', href: '/staff/exams', icon: PenLine },
        { label: 'Class results', desc: 'Broadsheet and rankings', href: '/staff/exams?tab=results', icon: BarChart3 },
        { label: 'Report cards', desc: 'Generate and send to parents', href: '/staff/reports', icon: FileText },
        { label: 'Attendance', desc: 'Mark today’s register', href: '/staff/attendance', icon: CalendarCheck },
        { label: 'My students', desc: 'Your class roster', href: '/staff/people', icon: Users },
    ],
    subject: [
        { label: 'Enter or correct marks', desc: 'Type, fix or remove marks', href: '/staff/exams', icon: PenLine },
        { label: 'Results', desc: 'Broadsheet and subject averages', href: '/staff/exams?tab=results', icon: BarChart3 },
        { label: 'Release results', desc: 'Let learners see their marks', href: '/staff/exams?tab=publish', icon: Send },
        { label: 'Assignments', desc: 'Set work for your classes', href: '/staff/assignments', icon: NotebookPen },
        { label: 'Announcements', desc: 'Post to your classes', href: '/staff/announcements', icon: Megaphone },
    ],
};

/** The web's "How to…" guide, folded away until wanted. */
function HowTo({ variant }: { variant: Variant }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const [open, setOpen] = useState(false);
    const steps = [
        ['Open an exam', 'tap it under My marking, or go to Exams & Marks and pick the exam, class and subject.'],
        ['Enter marks', 'type each learner’s score, then Save. Work is kept on your phone if the network drops.'],
        ['Correct a mistake', 'open the same exam; saved marks are already filled in. Type over the wrong score and save.'],
        ['Release results', 'on Release, release a subject so learners can see it. You can still correct marks afterwards.'],
        ...(variant === 'class' ? [['Report cards', 'at term end, open Report Cards to generate your class’s cards and send them to parents.']] : []),
    ];
    return (
        <View style={styles.howto}>
            <Pressable onPress={() => setOpen((o) => !o)} style={styles.howtoHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                <BookOpenCheck size={18} color={colors.primary} />
                <Text style={styles.howtoTitle}>{variant === 'class' ? 'How to run your class' : 'How to enter and correct marks'}</Text>
                <ChevronDown size={18} color={colors.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </Pressable>
            {open ? steps.map(([title, body], n) => (
                <View key={title} style={styles.howtoStep}>
                    <View style={styles.howtoNum}><Text style={styles.howtoNumText}>{n + 1}</Text></View>
                    <Text style={styles.howtoBody}><Text style={styles.howtoStrong}>{title}: </Text>{body}</Text>
                </View>
            )) : null}
        </View>
    );
}

/**
 * Home for class and subject teachers: it leads with getting marks in, and
 * the next mark sheet is one tap away.
 */
export function TeacherHome({ name, variant }: { name: string; variant: Variant }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const summary = useApiQuery<DashboardData>('/api/school/dashboard', { raw: true });
    const stats = useApiQuery<ClassTeacherStats & SubjectTeacherStats>(`/api/school/stats?role=${variant === 'class' ? 'class_teacher' : 'subject_teacher'}`, { raw: true });
    // Work learners have handed in that still needs a grade: something to act on today.
    const submissions = useApiQuery<{ grade: number | null }[]>('/api/school/submissions');
    const toGrade = submissions.data ? submissions.data.filter((s) => s.grade === null).length : null;
    const marking = useMarking();

    if ((summary.loading && !summary.data) || (stats.loading && !stats.data)) return <DashboardSkeleton />;

    const streamName = stats.data?.streamName && stats.data.streamName !== '—' ? stats.data.streamName : null;
    const avg = variant === 'class' ? stats.data?.streamAvg : stats.data?.avg;
    const avgText = avg && avg !== '—' ? `${avg}%` : '—';
    const markingLine = marking.loading
        ? null
        : marking.left > 0
            ? `You have ${marking.left.toLocaleString()} mark${marking.left === 1 ? '' : 's'} left to enter this term.`
            : marking.items.length > 0 ? 'All your marks are in for this term. Kazi nzuri!' : 'No exams to mark yet this term.';
    const actions: HeroAction[] = [
        marking.next
            ? { label: `Continue: ${marking.next.subjectName} · ${marking.next.className}`, icon: PenLine, href: markEntryRoute(marking.next), primary: true }
            : { label: 'Enter or correct marks', icon: PenLine, href: '/staff/exams', primary: true },
        variant === 'class'
            ? { label: 'Report cards', icon: FileText, href: '/staff/reports' }
            : { label: 'View results', icon: BarChart3, href: '/staff/exams?tab=results' },
    ];
    const reportsPending = variant === 'class' ? stats.data?.reportsPending ?? 0 : 0;
    let i = 0;

    return (
        <HomeScreen onRefresh={() => { summary.refresh(); stats.refresh(); }} refreshing={summary.refreshing || stats.refreshing}>
            <Reveal index={i++}>
                <DashboardHero name={name} term={summary.data?.term ?? null} canEditTerms={false} summary={markingLine} actions={actions} />
            </Reveal>
            <Reveal index={i++}>
                <OperationsOverview>
                    <KpiTile
                        title="Marks to enter" value={marking.loading ? '…' : marking.left.toLocaleString()} icon={ClipboardList} hue="amber"
                        href={marking.next ? markEntryRoute(marking.next) : '/staff/exams'}
                        tone={!marking.loading && marking.left > 0 ? 'warn' : undefined}
                    />
                    <KpiTile
                        title="Exams fully marked" value={marking.loading ? '…' : `${marking.complete}/${marking.items.length}`} icon={CircleCheck} hue="emerald" href="/staff/exams"
                        tone={!marking.loading && marking.items.length > 0 && marking.complete === marking.items.length ? 'good' : undefined}
                    />
                    {variant === 'class' ? (
                        <>
                            <KpiTile title={streamName ? `Learners in ${streamName}` : 'Learners'} value={stats.data?.studentCount ?? 0} icon={GraduationCap} hue="orange" href="/staff/people" />
                            <KpiTile title="Class average" value={avgText} icon={BarChart3} hue="violet" href="/staff/exams?tab=results" />
                        </>
                    ) : (
                        <>
                            <KpiTile title="Subject average" value={avgText} icon={BarChart3} hue="violet" href="/staff/exams?tab=results" />
                            <KpiTile title="Work to grade" value={toGrade == null ? '…' : toGrade.toLocaleString()} icon={Inbox} hue="sky" href="/staff/assignments?tab=submissions" tone={toGrade ? 'warn' : undefined} />
                        </>
                    )}
                </OperationsOverview>
            </Reveal>

            {reportsPending > 0 ? (
                <Reveal index={i++}>
                    <Pressable onPress={() => router.push('/staff/reports')} style={[styles.banner, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]} accessibilityRole="link">
                        <FileText size={18} color={colors.warning} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.bannerTitle}>{reportsPending} report card{reportsPending === 1 ? '' : 's'}</Text>
                            <Text style={styles.bannerBody}>still to generate this year</Text>
                        </View>
                        <ArrowRight size={16} color={colors.warning} />
                    </Pressable>
                </Reveal>
            ) : null}

            <Reveal index={i++} style={{ marginTop: spacing.xl }}>
                <MarkingPanel marking={marking} />
                <InsightCard title="Quick actions">
                    <View style={styles.links}>
                        {QUICK_LINKS[variant].map((l, n, all) => (
                            <LinkRow key={l.label} label={l.label} desc={l.desc} icon={l.icon} hue={hueForHref(l.href)} href={l.href} last={n === all.length - 1} />
                        ))}
                    </View>
                </InsightCard>
                <InsightCard title="Coming up" meta="Next three weeks" action={{ label: 'Exams', href: '/staff/exams' }}>
                    <UpcomingRounds rounds={summary.data?.upcomingRounds ?? []} />
                </InsightCard>
                <HowTo variant={variant} />
            </Reveal>
        </HomeScreen>
    );
}

const useStyles = makeStyles((colors) => ({
    banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, marginTop: spacing.md },
    bannerTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    bannerBody: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    links: { marginHorizontal: -spacing.md, marginBottom: -spacing.sm },
    howto: { backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
    howtoHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    howtoTitle: { flex: 1, fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    howtoStep: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    howtoNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    howtoNumText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary },
    howtoBody: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted },
    howtoStrong: { fontFamily: fonts.bold, color: colors.foreground },
}));
