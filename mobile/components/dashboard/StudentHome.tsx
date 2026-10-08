import { useDownload } from '@/lib/useDownload';
import { HomeScreen } from './Hero';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
    ArrowDownRight, ArrowUpRight, BookOpen, CalendarCheck, Clock3, DownloadCloud, FileText, GraduationCap,
    Megaphone, Minus, TrendingUp, Wallet,
} from 'lucide-react-native';
import { localToday, type StudentAssignment } from '@shared/assignments';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { useSchoolPassMark } from '@/lib/usePassMark';
import { daysUntil, gradeTone, errorMessage, fileSafe, formatCurrency, getTimeAgo, pluralize } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme, type Palette } from '@/lib/theme';
import type { DashboardData, FeeRecord } from '@/lib/types';
import { Notice } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { AssignmentItem, sortHomework } from '@/components/student/AssignmentItem';
import { useFileViewer } from '@/components/FileViewer';
import { viewableAttachment } from '@/lib/viewableFile';
import { StudyGoals } from '@/components/student/StudyGoals';
import { HeroActions, HeroChip, HeroFrame, type HeroAction } from './Hero';
import { DashboardSkeleton } from './Skeleton';
import { ScoreRing, TrendChart } from './charts';
import { InsightCard, KpiGrid, KpiTile, Meter, Reveal, SectionTitle } from './kit';

const STUDENT_HERO = ['#2563eb', '#4f46e5', '#7c3aed'] as const;
const STUDENT_HERO_DARK = ['#1e3a8a', '#3730a3', '#5b21b6'] as const;

function relativeDay(days: number): string {
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
}

/** Up to this many pieces show at first; the rest are a tap away. */
const HOMEWORK_PREVIEW = 6;

function HomeworkPanel({ assignments, onChanged }: { assignments: readonly StudentAssignment[]; onChanged: () => void }) {
    const styles = useStyles();
    const [showAll, setShowAll] = useState(false);
    const sorted = useMemo(() => sortHomework(assignments), [assignments]);
    const shown = showAll ? sorted : sorted.slice(0, HOMEWORK_PREVIEW);
    return (
        <InsightCard title="Homework" meta={sorted.length ? `${pluralize(sorted.filter((a) => !a.submission).length, 'piece')} to hand in · tap one to read it` : undefined}>
            {sorted.length === 0 ? <Text style={styles.quiet}>No homework set for you right now.</Text> : shown.map((a, i) => (
                <AssignmentItem key={a.id} assignment={a} divider={i > 0} onChanged={onChanged} />
            ))}
            {sorted.length > HOMEWORK_PREVIEW ? (
                <Pressable onPress={() => setShowAll(!showAll)} style={styles.showAll} accessibilityRole="button">
                    <Text style={styles.handIn}>{showAll ? 'Show less' : `Show all ${sorted.length}`}</Text>
                </Pressable>
            ) : null}
        </InsightCard>
    );
}

/**
 * The learner's home, the web's student dashboard: how they're doing (ring,
 * change since last term), what's next (exams, homework), latest results,
 * progress over time, school news, goals and notes.
 */
export function StudentHome() {
    const download = useDownload();
    const { colors, scheme } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const toast = useToast();
    const viewer = useFileViewer();
    const { profile } = useCurrentUser();
    const passMark = useSchoolPassMark();
    const dash = useApiQuery<DashboardData>('/api/school/student/dashboard');
    const fees = useApiQuery<FeeRecord[]>('/api/school/fees');
    const [downloading, setDownloading] = useState(false);

    if (dash.loading && !dash.data) return <DashboardSkeleton />;

    const data = dash.data;
    const stats = data?.stats;
    const trends = data?.trends ?? [];
    const latest = data?.latestResults ?? [];
    const exams = data?.upcomingExams ?? [];
    const feeRows = fees.data ?? [];
    const feesBalance = feeRows.reduce((sum, f) => sum + (f.balance || 0), 0);
    const hasResults = (stats?.examsTaken ?? 0) > 0;
    const average = hasResults ? stats?.averageScore ?? null : null;
    const current = trends.at(-1);
    const previous = trends.at(-2);
    const delta = current && previous ? Math.round((current.overallAverage - previous.overallAverage) * 10) / 10 : null;
    const className = data?.profile?.grade_streams?.full_name ?? null;
    const nextExam = exams.map((e) => ({ e, d: daysUntil(e.exam_date) })).filter((x) => x.d >= 0).sort((a, b) => a.d - b.d)[0];
    const today = localToday();
    const dueSoon = (data?.assignments ?? []).filter((a) => !a.submission && (Date.parse(a.dueDate) - Date.parse(today)) / 86_400_000 <= 2).length;
    const report = data?.latestReport ?? null;
    const studentId = data?.profile?.id;

    const downloadReport = async () => {
        if (!report || !studentId) return;
        setDownloading(true);
        try {
            await download(
                withQuery(`/api/reports/student/${studentId}`, { term: report.terms?.id, year: report.academic_years?.id }),
                `Report_card_${fileSafe(`${report.terms?.name ?? ''}_${report.academic_years?.name ?? ''}`)}.pdf`,
            );
        } catch (err) {
            toast.error(errorMessage(err, 'The report card did not download.'));
        } finally {
            setDownloading(false);
        }
    };

    const actions: HeroAction[] = [
        { label: 'My results', icon: GraduationCap, href: '/student/results', primary: true },
        report && studentId
            ? { label: downloading ? 'Downloading…' : `${report.terms?.name ?? 'Latest'} report card`, icon: DownloadCloud, href: '/student/results', onPress: () => void downloadReport() }
            : { label: 'My subjects', icon: BookOpen, href: '/student/subjects' },
    ];
    const DeltaIcon = delta == null ? null : delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
    const refresh = () => { dash.refresh(); fees.refresh(); };
    let i = 0;

    return (
        <HomeScreen onRefresh={refresh} refreshing={dash.refreshing}>
            <Reveal index={i++}>
                <HeroFrame
                    name={profile?.first_name ?? ''}
                    gradient={scheme === 'dark' ? STUDENT_HERO_DARK : STUDENT_HERO}
                    eyebrow={[new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), data?.currentTerm?.name, className].filter(Boolean).join(' · ')}
                    aside={average != null ? <ScoreRing value={average} size={84} /> : undefined}
                >
                    {average != null ? (
                        <View style={styles.deltaRow}>
                            {DeltaIcon ? <DeltaIcon size={15} color="#ffffff" /> : null}
                            <Text style={styles.deltaText}>
                                {delta == null ? 'Your first term on record' : delta > 0 ? `Up ${delta} points` : delta < 0 ? `Down ${Math.abs(delta)} points` : 'No change'}
                                {previous ? <Text style={styles.deltaVs}>  vs {previous.termName} {previous.yearName}</Text> : null}
                            </Text>
                        </View>
                    ) : null}
                    {nextExam || dueSoon > 0 ? (
                        <View style={styles.chips}>
                            {nextExam ? <HeroChip icon={Clock3} label={`${nextExam.e.subject_name} exam ${relativeDay(nextExam.d).toLowerCase()}`} /> : null}
                            {dueSoon > 0 ? <HeroChip icon={FileText} label={`${pluralize(dueSoon, 'piece')} of homework to hand in`} warm /> : null}
                        </View>
                    ) : null}
                    <HeroActions actions={actions} />
                </HeroFrame>
            </Reveal>

            {dash.error ? <Notice tone="danger" message="Some of your data couldn’t be loaded. Pull down to try again." /> : null}

            <Reveal index={i++}>
                <SectionTitle title="At a glance" />
                <KpiGrid>
                    <KpiTile title={current ? `${current.termName} average` : 'Average score'} value={average != null ? `${average}%` : '—'} icon={TrendingUp} hue="blue" href="/student/results" />
                    <KpiTile title="Subjects" value={stats?.subjectsCount ?? 0} icon={BookOpen} hue="emerald" href="/student/subjects" />
                    <KpiTile title="Results released" value={stats?.examsTaken ?? 0} icon={GraduationCap} hue="violet" href="/student/results" />
                    {(stats?.attendanceRecords ?? 0) > 0 ? (
                        <KpiTile title="Attendance" value={`${stats?.attendanceRate ?? 0}%`} icon={CalendarCheck} hue="teal" href="/student/attendance" tone="good" />
                    ) : null}
                    {feeRows.length > 0 ? (
                        <KpiTile title="Fees balance" value={formatCurrency(feesBalance)} icon={Wallet} hue="emerald" href="/student/fees" tone={feesBalance > 0 ? 'bad' : 'good'} />
                    ) : null}
                </KpiGrid>
            </Reveal>

            <Reveal index={i++} style={{ marginTop: spacing.xl }}>
                <InsightCard
                    title="Latest results"
                    meta={latest.length > 0 ? 'Your most recent released marks' : undefined}
                    action={{ label: 'All results', href: '/student/results' }}
                >
                    {latest.length === 0 ? <Text style={styles.quiet}>Your results will appear here once your teachers release them.</Text> : (
                        <View style={{ gap: spacing.md }}>
                            {latest.map((r) => {
                                const pct = Math.round(Number(r.percentage) || 0);
                                const tone = gradeTone(colors, pct);
                                return (
                                    <View key={r.id} style={styles.result}>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <View style={styles.resultHead}>
                                                <Text style={styles.resultName} numberOfLines={1}>{r.exams.subjects?.name ?? r.exams.name}</Text>
                                                <Text style={styles.resultPct}>{pct}%</Text>
                                            </View>
                                            <Meter value={pct} color={tone} track={colors.mutedBg} height={6} />
                                        </View>
                                        {r.grade_symbol ? (
                                            <View style={[styles.grade, { backgroundColor: `${tone}24` }]}><Text style={[styles.gradeText, { color: tone }]}>{r.grade_symbol}</Text></View>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </InsightCard>

                <InsightCard title="Progress over time" meta={trends.length > 1 ? 'Your average each term' : undefined}>
                    {trends.length > 1 ? (
                        <TrendChart passMark={passMark} points={trends.map((t) => ({ label: `${t.termName} ${t.yearName}`.trim(), value: t.overallAverage }))} />
                    ) : <Text style={styles.quiet}>Your progress chart appears after your second term of results.</Text>}
                </InsightCard>

                <InsightCard title="Coming up" meta="Exams in the next 30 days">
                    {exams.length === 0 ? <Text style={styles.quiet}>No exams scheduled yet.</Text> : (
                        <View style={{ gap: spacing.sm }}>
                            {exams.slice(0, 5).map((e) => {
                                const days = daysUntil(e.exam_date);
                                const soon = days <= 3;
                                const d = new Date(e.exam_date);
                                return (
                                    <View key={e.id} style={[styles.exam, soon && { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
                                        <View style={[styles.cal, soon && { borderColor: colors.warningBorder }]}>
                                            <Text style={[styles.calMonth, soon && { color: colors.warning }]}>{d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</Text>
                                            <Text style={styles.calDay}>{d.toLocaleDateString('en-GB', { day: '2-digit' })}</Text>
                                        </View>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={styles.resultName} numberOfLines={1}>{e.subject_name}</Text>
                                            <Text style={styles.hwMeta} numberOfLines={1}>{e.name}</Text>
                                        </View>
                                        <Text style={[styles.when, soon && { color: colors.warning }]}>{relativeDay(days)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </InsightCard>

                <HomeworkPanel assignments={data?.assignments ?? []} onChanged={refresh} />

                <InsightCard title="Announcements">
                    {(data?.announcements ?? []).length === 0 ? <Text style={styles.quiet}>No announcements from school yet.</Text> : (data?.announcements ?? []).slice(0, 4).map((a, n) => (
                        <View key={a.id} style={[styles.news, n > 0 && styles.hwBorder]}>
                            <View style={[styles.newsIcon, { backgroundColor: a.isImportant ? colors.dangerBg : colors.primarySoft }]}>
                                <Megaphone size={16} color={a.isImportant ? colors.danger : colors.primary} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.resultName}>{a.title}{a.isImportant ? <Text style={[styles.important, { color: colors.danger }]}>  IMPORTANT</Text> : null}</Text>
                                <Text style={styles.hwMeta} numberOfLines={2}>{a.content}</Text>
                                <Text style={styles.when}>{getTimeAgo(a.createdAt)}</Text>
                            </View>
                        </View>
                    ))}
                </InsightCard>

                <View style={{ marginBottom: spacing.md }}><StudyGoals /></View>

                {(data?.materials ?? []).length > 0 ? (
                    <InsightCard title="Notes & learning materials" meta="Shared by your teachers">
                        {(data?.materials ?? []).map((m, n) => (
                            <Pressable key={m.id} disabled={!m.fileUrl} onPress={() => m.fileUrl && viewer.view(viewableAttachment(m.fileUrl))} style={[styles.news, n > 0 && styles.hwBorder]} accessibilityRole="link">
                                <View style={[styles.newsIcon, { backgroundColor: colors.successBg }]}><FileText size={16} color={colors.success} /></View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.resultName} numberOfLines={1}>{m.title}</Text>
                                    <Text style={styles.hwMeta} numberOfLines={1}>{[m.subjectName, m.fileType].filter(Boolean).join(' · ')}</Text>
                                </View>
                                {m.fileUrl ? <DownloadCloud size={17} color={colors.primary} /> : null}
                            </Pressable>
                        ))}
                    </InsightCard>
                ) : null}
            </Reveal>
        </HomeScreen>
    );
}

const useStyles = makeStyles((colors) => ({
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
    deltaText: { fontSize: 13, fontFamily: fonts.bold, color: '#ffffff' },
    deltaVs: { fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    quiet: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.xl, padding: spacing.md },
    result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    resultHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginBottom: 6 },
    resultName: { flexShrink: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    resultPct: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    grade: { minWidth: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    gradeText: { fontSize: 13, fontFamily: fonts.display },
    exam: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.sm },
    cal: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
    calMonth: { fontSize: 9, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 1 },
    calDay: { fontSize: 16, lineHeight: 19, fontFamily: fonts.display, color: colors.foreground },
    when: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted, marginTop: 2 },
    hw: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    hwBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    hwTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    hwMeta: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    feedback: { fontSize: 12, fontFamily: fonts.regular, fontStyle: 'italic', color: colors.muted, marginTop: 4 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    chipText: { fontSize: 11, fontFamily: fonts.bold },
    handIn: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
    showAll: { alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    news: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md },
    newsIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    important: { fontSize: 10, fontFamily: fonts.bold },
}));
