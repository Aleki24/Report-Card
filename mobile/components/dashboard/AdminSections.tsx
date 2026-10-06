import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Award, CalendarCheck, Check, CircleCheckBig, ClipboardList, Send, Trophy, Wallet, X, type LucideIcon } from 'lucide-react-native';
import {
    buildSetupSteps, buildTodos, totalAttendanceCount,
    type AttendanceToday, type ClassPerformance, type DashboardData, type TodoKey, type UpcomingRound,
} from '@shared/dashboard';
import { shortCurriculumLabel } from '@shared/curriculum-labels';
import { formatCurrency, getTimeAgo, passRateLabel, passRateTone, pluralize, toneColorFor } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme, shadowFor } from '@/lib/theme';
import { CountUp, LegendItem, Meter, PressScale, appHref } from './kit';
import { Ring } from './charts';

const TODO_ICONS: Record<TodoKey, LucideIcon> = { release: Send, marks: ClipboardList, grading: Award, attendance: CalendarCheck, fees: Wallet };

/** "Needs your attention": each item with its own next step, or a clear all caught up. */
export function TodoList({ data }: { data: DashboardData }) {
    const { colors, tones } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const todos = buildTodos(data);
    if (todos.length === 0) {
        return (
            <View style={[styles.caughtUp, { borderColor: `${colors.success}55`, backgroundColor: colors.successBg }]}>
                <View style={[styles.todoIcon, { backgroundColor: `${colors.success}26` }]}><CircleCheckBig size={20} color={colors.success} /></View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.todoTitle}>All caught up</Text>
                    <Text style={styles.todoDetail}>Every exam sat has marks, results are released and nothing is overdue.</Text>
                </View>
            </View>
        );
    }
    return (
        <View style={{ gap: spacing.sm }}>
            {todos.map((t) => {
                const Icon = TODO_ICONS[t.key];
                const tone = tones[t.hue];
                return (
                    <PressScale key={t.key} onPress={() => router.push(appHref(t.href))} style={[styles.todo, { borderLeftColor: tone.solid }]} accessibilityRole="link" accessibilityLabel={`${t.title}. ${t.cta}`}>
                        <View style={[styles.todoIcon, { backgroundColor: tone.bg }]}><Icon size={19} color={tone.fg} /></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.todoTitle}>{t.title}</Text>
                            <Text style={styles.todoDetail}>{t.detail}</Text>
                            <Text style={[styles.todoCta, { color: tone.fg }]}>{t.cta} →</Text>
                        </View>
                    </PressScale>
                );
            })}
        </View>
    );
}

const DISMISS_KEY = 'skulbase.setup-dismissed';

/** A new school's remaining setup; disappears when done or dismissed. */
export function SetupChecklist({ data, schoolKey }: { data: DashboardData; schoolKey: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const key = `${DISMISS_KEY}.${schoolKey.replace(/[^\w.-]/g, '_')}`;
    const [dismissed, setDismissed] = useState(true);
    useEffect(() => {
        SecureStore.getItemAsync(key).then((v) => setDismissed(v === '1')).catch(() => setDismissed(false));
    }, [key]);
    const steps = buildSetupSteps({ hasLogo: data.hasLogo, totalTeachers: data.totalTeachers, totalStudents: data.totalStudents, totalUsers: data.totalUsers, setup: data.setup });
    const remaining = steps.filter((s) => !s.done);
    if (dismissed || remaining.length === 0) return null;
    const done = steps.length - remaining.length;
    return (
        <View style={styles.setup}>
            <View style={styles.setupHead}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.setupTitle}>Finish setting up</Text>
                    <Text style={styles.todoDetail}>{done} of {steps.length} done — the rest takes a few minutes.</Text>
                </View>
                <Pressable
                    onPress={() => { setDismissed(true); SecureStore.setItemAsync(key, '1').catch(() => undefined); }}
                    hitSlop={10}
                    accessibilityLabel="Dismiss setup checklist"
                >
                    <X size={18} color={colors.muted} />
                </Pressable>
            </View>
            <View style={{ marginBottom: spacing.sm }}><Meter value={(done / steps.length) * 100} color={colors.primary} height={6} /></View>
            {steps.map((s) => (
                <Pressable key={s.id} disabled={s.done} onPress={() => router.push(appHref(s.href))} style={({ pressed }) => [styles.step, pressed && { backgroundColor: colors.elevated }]} accessibilityRole="link">
                    <View style={[styles.stepCheck, s.done ? { backgroundColor: colors.primarySoft, borderColor: 'transparent' } : { borderColor: colors.border }]}>
                        {s.done ? <Check size={13} color={colors.primary} strokeWidth={3} /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.stepLabel, s.done && styles.stepDone]}>{s.label}</Text>
                        {!s.done ? <Text style={styles.todoDetail}>{s.hint}</Text> : null}
                    </View>
                    {!s.done ? <Text style={styles.stepCta}>{s.cta}</Text> : null}
                </Pressable>
            ))}
        </View>
    );
}

/**
 * Every class as a tile with its pass rate on a gauge, weakest first (the
 * API's order) so the classes that need help lead. A tile opens the class in
 * Analytics.
 */
export function ClassPerformanceList({ classes, passMark, onSelect, preview = 6 }: {
    classes: readonly ClassPerformance[];
    passMark: number;
    /** Opens a class; defaults to Analytics. */
    onSelect?: (id: string) => void;
    /** Tiles before "Show all". */
    preview?: number;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const [showAll, setShowAll] = useState(false);
    const withMarks = classes.filter((c) => c.markCount > 0);
    if (withMarks.length === 0) return <Text style={styles.emptyLine}>No marks recorded yet. Each class appears here once its exams are marked.</Text>;
    const ranked = [...withMarks].sort((a, b) => (b.passRate ?? 0) - (a.passRate ?? 0));
    const top = ranked[0];
    const shown = showAll ? withMarks : withMarks.slice(0, preview);
    const rated = withMarks.filter((c) => c.passRate != null);
    const passing = rated.filter((c) => (c.passRate ?? 0) >= 50).length;
    return (
        <View>
            <View style={styles.leagueHead}>
                <View style={[styles.leagueBadge, { backgroundColor: colors.successBg }]}>
                    <Trophy size={14} color={colors.success} />
                    <Text style={[styles.leagueBadgeText, { color: colors.successText }]} numberOfLines={1}>Top: {top.name} · {top.passRate ?? '—'}%</Text>
                </View>
                <Text style={styles.leagueMeta}>{passing} of {rated.length} classes have half or more passing</Text>
            </View>
            <View style={styles.classGrid}>
                {shown.map((c) => {
                    const color = toneColorFor(colors, passRateTone(c.passRate));
                    const curriculum = shortCurriculumLabel(c.levelCode);
                    return (
                        <View key={c.id} style={styles.classCell}>
                        <PressScale onPress={() => (onSelect ? onSelect(c.id) : router.push(`/staff/analytics?stream=${c.id}`))} style={styles.classTile} accessibilityRole="link" accessibilityLabel={`${c.name}: ${c.passRate ?? 0}% passing`}>
                            <Ring value={c.passRate ?? 0} size={62} stroke={7} color={color} track={`${color}22`} textColor={colors.foreground} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.className} numberOfLines={1}>{c.name}</Text>
                                {curriculum ? <Text style={[styles.classTag, { color }]}>{curriculum}</Text> : null}
                                <Text style={styles.classMeta} numberOfLines={2}>mean {c.mean ?? '—'}% · {pluralize(c.students, 'learner')}</Text>
                            </View>
                        </PressScale>
                        </View>
                    );
                })}
            </View>
            <Text style={styles.leagueFoot}>Gauges show the share of marks at or above {passMark}%.</Text>
            {withMarks.length > preview ? (
                <Pressable onPress={() => setShowAll((v) => !v)} style={styles.moreBtn} accessibilityRole="button">
                    <Text style={styles.moreText}>{showAll ? 'Show fewer' : `Show all ${withMarks.length} classes`}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

/** Each class's coming sitting: one line per round, not per paper. */
export function UpcomingRounds({ rounds }: { rounds: readonly UpcomingRound[] }) {
    const styles = useStyles();
    if (rounds.length === 0) return <Text style={styles.emptyLine}>No exams in the next three weeks.</Text>;
    return (
        <View style={{ gap: spacing.sm }}>
            {rounds.map((r) => {
                const date = new Date(`${r.firstDate}T00:00:00`);
                return (
                    <View key={r.key} style={styles.round}>
                        <View style={styles.calendar}>
                            <Text style={styles.calMonth}>{date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</Text>
                            <Text style={styles.calDay}>{date.getDate()}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.roundTitle} numberOfLines={1}>{r.className} · {r.label}</Text>
                            <Text style={styles.todoDetail}>{pluralize(r.papers, 'paper')} · from {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

/** Leads with pass rate: the mean mostly says how hard the papers were. */
export function AcademicSummary({ summary }: { summary: DashboardData['academicSummary'] }) {
    const { colors } = useTheme();
    const styles = useStyles();
    if (summary.markCount === 0 || summary.passRate == null) return <Text style={styles.emptyLine}>No exam data yet.</Text>;
    const color = toneColorFor(colors, passRateTone(summary.passRate));
    return (
        <View>
            <View style={styles.bigRow}>
                <CountUp value={`${summary.passRate}%`} style={styles.big} />
                <Text style={styles.todoDetail}>of marks at or above {summary.passMark}%</Text>
            </View>
            <View style={{ marginTop: spacing.md }}><Meter value={summary.passRate} color={color} height={10} /></View>
            <View style={styles.legendRow}>
                <LegendItem color={color} count="" label={passRateLabel(summary.passRate)} />
                {summary.recentAvg != null ? <Text style={styles.todoDetail}>{summary.recentAvg}% average across {pluralize(summary.markCount, 'mark')}</Text> : null}
            </View>
        </View>
    );
}

/** Present and absent never sit side by side, so the bar reads under red–green colour blindness. */
const SEGMENTS = [
    { key: 'present', label: 'present', color: 'success' },
    { key: 'late', label: 'late', color: 'warning' },
    { key: 'excused', label: 'excused', color: 'info' },
    { key: 'absent', label: 'absent', color: 'danger' },
] as const;

export function AttendanceBreakdown({ counts }: { counts: AttendanceToday }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const total = totalAttendanceCount(counts);
    if (total === 0) return <Text style={styles.emptyLine}>No attendance marked yet today.</Text>;
    return (
        <View>
            <View style={styles.bigRow}>
                <CountUp value={`${Math.round((counts.present / total) * 100)}%`} style={styles.big} />
                <Text style={styles.todoDetail}>present rate</Text>
            </View>
            <View style={styles.stack} accessibilityLabel={`Attendance: ${counts.present} present, ${counts.late} late, ${counts.excused} excused, ${counts.absent} absent`}>
                {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
                    <View key={s.key} style={{ flex: counts[s.key], backgroundColor: colors[s.color] }} />
                ))}
            </View>
            <View style={styles.legendRow}>
                {SEGMENTS.map((s) => <LegendItem key={s.key} color={colors[s.color]} count={counts[s.key]} label={s.label} />)}
            </View>
        </View>
    );
}

export function FinanceSnapshot({ collected, unpaid, overdue }: { collected: number; unpaid: number; overdue: number }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const billed = collected + unpaid;
    const rate = billed > 0 ? Math.round((collected / billed) * 100) : null;
    return (
        <View>
            <View style={styles.financeRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.money} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(collected)}</Text>
                    <Text style={styles.todoDetail}>Collected</Text>
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
                    <Text style={styles.moneySmall} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(unpaid)}</Text>
                    <Text style={styles.todoDetail}>Outstanding</Text>
                </View>
            </View>
            {rate !== null ? (
                <>
                    <View style={{ marginTop: spacing.md }}><Meter value={rate} color={colors.primary} height={10} /></View>
                    <Text style={[styles.todoDetail, { marginTop: 6 }]}>{rate}% of billed fees collected</Text>
                </>
            ) : <Text style={[styles.emptyLine, { textAlign: 'left' }]}>No fees billed yet this term.</Text>}
            <Pressable disabled={overdue === 0} onPress={() => router.push('/staff/fees')} style={styles.overdue} accessibilityRole="link">
                <View style={[styles.dot, { backgroundColor: overdue > 0 ? colors.warning : colors.success }]} />
                <Text style={overdue > 0 ? styles.overdueText : styles.todoDetail}>{overdue > 0 ? `${pluralize(overdue, 'invoice')} overdue — review` : 'No overdue invoices'}</Text>
            </Pressable>
        </View>
    );
}

export function RecentActivity({ activities }: { activities: DashboardData['recentActivities'] }) {
    const styles = useStyles();
    const router = useRouter();
    if (activities.length === 0) return <Text style={styles.emptyLine}>Nothing yet this year.</Text>;
    return (
        <View>
            {activities.slice(0, 5).map((a, i) => (
                <Pressable key={`${a.timestamp}-${i}`} disabled={!a.href} onPress={() => a.href && router.push(appHref(a.href))} style={[styles.activity, i > 0 && styles.activityBorder]}>
                    <View style={styles.timelineDot} />
                    <Text style={styles.activityText}>{a.message}</Text>
                    <Text style={styles.activityTime}>{getTimeAgo(a.timestamp)}</Text>
                </Pressable>
            ))}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    caughtUp: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.xxl, borderWidth: 1, padding: spacing.lg },
    todo: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, padding: spacing.md, ...shadowFor(colors) },
    todoIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    todoTitle: { fontSize: 14, lineHeight: 19, fontFamily: fonts.bold, color: colors.foreground },
    todoDetail: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    todoCta: { fontSize: 13, fontFamily: fonts.bold, marginTop: spacing.sm },
    setup: { backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.primary, padding: spacing.lg, marginBottom: spacing.md },
    setupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
    setupTitle: { fontSize: 15, fontFamily: fonts.display, color: colors.foreground },
    step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 9, paddingHorizontal: 4, borderRadius: radius.lg },
    stepCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    stepLabel: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    stepDone: { color: colors.muted, textDecorationLine: 'line-through' },
    stepCta: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
    emptyLine: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', paddingVertical: spacing.md },
    leagueHead: { gap: 6, marginBottom: spacing.md },
    leagueBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md, maxWidth: '100%' },
    leagueBadgeText: { fontSize: 12, fontFamily: fonts.bold, flexShrink: 1 },
    leagueMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    classCell: { flexBasis: '47%', flexGrow: 1, minWidth: 150 },
    classTile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated },
    className: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    classTag: { fontSize: 10, fontFamily: fonts.bold, letterSpacing: 0.5, marginTop: 1 },
    classMeta: { fontSize: 11, lineHeight: 15, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
    leagueFoot: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, marginTop: spacing.md },
    moreBtn: { alignSelf: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
    moreText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
    round: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    calendar: { width: 46, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
    calMonth: { fontSize: 10, fontFamily: fonts.bold, color: colors.danger, letterSpacing: 0.5 },
    calDay: { fontSize: 18, lineHeight: 21, fontFamily: fonts.display, color: colors.foreground },
    roundTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    bigRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm },
    big: { fontSize: 34, lineHeight: 38, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -1 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.lg, rowGap: 6, marginTop: spacing.md },
    stack: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginTop: spacing.md },
    financeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
    money: { fontSize: 24, fontFamily: fonts.display, color: colors.foreground, letterSpacing: -0.5 },
    moneySmall: { fontSize: 17, fontFamily: fonts.bold, color: colors.foreground },
    overdue: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    dot: { width: 8, height: 8, borderRadius: 4 },
    overdueText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    activity: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 10 },
    activityBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
    activityText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.foreground },
    activityTime: { fontSize: 11, fontFamily: fonts.medium, color: colors.muted, marginTop: 2 },
}));
