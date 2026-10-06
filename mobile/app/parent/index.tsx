import React, { useState } from 'react';
import { HomeScreen } from '@/components/dashboard/Hero';
import { ScrollView, Text, View } from 'react-native';
import { MODULES } from '@shared/platform/modules';
import { date, dateTime, humanize, money, personName } from '@shared/ops/format';
import {
    ATTENDANCE_TONES, FEE_STATUS_TONES, absences, feeBalance, rideLine,
    type ChildLink, type ChildOverview,
} from '@shared/ops/forms/platform';
import { Bus, CalendarCheck, CalendarDays, GraduationCap, Users, Wallet } from 'lucide-react-native';
import { EmptyState, ErrorBanner, LoadingView, Screen } from '@/components/ui';
import { HeroFrame } from '@/components/dashboard/Hero';
import { InsightCard, KpiGrid, KpiTile, LegendItem, Meter, PressScale, Reveal } from '@/components/dashboard/kit';
import { initials, scoreColor } from '@/lib/format';
import { StatusPill } from '@/components/ops/bits';
import { useOpsData } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';

const PARENT_HERO = ['#be123c', '#db2777', '#f97316'] as const;
const PARENT_HERO_DARK = ['#4c0519', '#831843', '#7c2d12'] as const;

/** Each school day of the last month as a tile: green present, amber late, blue excused, red absent. */
function AttendanceGrid({ records }: { records: ChildOverview['attendance'] }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const days = [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    const color = (status: string) => colors[toneKey(ATTENDANCE_TONES[status] ?? 'neutral')];
    return (
        <View>
            <View style={styles.grid}>
                {days.map((a) => (
                    <View key={a.id} style={[styles.day, { backgroundColor: color(a.status) }]} accessibilityLabel={`${date(a.date)}: ${humanize(a.status)}`} />
                ))}
            </View>
            <View style={styles.legendRow}>
                {(['present', 'late', 'excused', 'absent'] as const).map((s) => (
                    <LegendItem key={s} color={color(s)} count={days.filter((d) => d.status === s).length} label={s} />
                ))}
            </View>
        </View>
    );
}

function toneKey(tone: string): 'success' | 'warning' | 'info' | 'danger' | 'muted' {
    return tone === 'good' ? 'success' : tone === 'warn' ? 'warning' : tone === 'info' ? 'info' : tone === 'bad' ? 'danger' : 'muted';
}

/** One child: results, fees, report cards, attendance, events, the bus and notices. */
function Overview({ childId }: { childId: string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const { data, loading, error, reload } = useOpsData<ChildOverview>(`/api/parent/children/${childId}`);
    if (loading && !data) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={() => void reload()} />;
    if (!data) return null;
    const balance = feeBalance(data);
    const absent = absences(data);
    let i = 0;

    return (
        <View>
            <Reveal index={i++}>
                <KpiGrid>
                    {data.summary ? <KpiTile title={data.summary.currentTerm?.name ? `Average · ${data.summary.currentTerm.name}` : 'Average score'} value={data.summary.stats.examsTaken ? `${data.summary.stats.averageScore}%` : '—'} icon={GraduationCap} hue="blue" /> : null}
                    {data.attendance.length > 0 ? <KpiTile title="Absent (30 days)" value={absent} icon={CalendarCheck} hue="teal" tone={absent > 2 ? 'warn' : 'good'} /> : null}
                    {data.fees.length > 0 ? <KpiTile title="Fee balance" value={money(balance)} icon={Wallet} hue="emerald" tone={balance > 0 ? 'warn' : 'good'} /> : null}
                </KpiGrid>
            </Reveal>

            <Reveal index={i++} style={{ marginTop: spacing.lg }}>
                {data.bus ? (
                    <View style={[styles.bus, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
                        <Bus size={20} color={colors.warning} />
                        <Text style={[styles.body, { flex: 1 }]}>
                            <Text style={styles.title}>{data.bus.vehicle?.registration}</Text> is on the road{data.bus.last_seen_at ? `, last seen ${dateTime(data.bus.last_seen_at)}` : ''}.
                            {data.bus.boarded ? ` Your child: ${humanize(data.bus.boarded)}.` : ''}
                        </Text>
                    </View>
                ) : null}

                {data.summary ? (
                    <InsightCard title="Latest results" meta={data.summary.currentTerm?.name}>
                        {data.summary.latestResults.length === 0 ? <Text style={styles.muted}>No released results yet.</Text> : (
                            <View style={{ gap: spacing.md }}>
                                {data.summary.latestResults.map((r) => {
                                    const pct = r.percentage != null ? Math.round(Number(r.percentage)) : null;
                                    return (
                                        <View key={r.id}>
                                            <View style={styles.resultHead}>
                                                <Text style={styles.title} numberOfLines={1}>{r.exams?.subjects?.name ?? 'Subject'}<Text style={styles.muted}>  {r.exams?.name}</Text></Text>
                                                <Text style={styles.score}>{pct != null ? `${pct}%` : '—'} {r.grade_symbol ?? ''}</Text>
                                            </View>
                                            {pct != null ? <Meter value={pct} color={scoreColor(colors, pct)} track={colors.mutedBg} height={6} /> : null}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </InsightCard>
                ) : null}

                {data.fees.length > 0 ? (
                    <InsightCard title="Fees">
                        {data.fees.map((f, n) => (
                            <View key={f.id} style={[styles.row, n > 0 && styles.rowBorder]}>
                                <Text style={[styles.title, { flex: 1 }]}>{f.term?.name ?? 'Term'}</Text>
                                <Text style={styles.body}>{money(Number(f.total_fee) - Number(f.paid_amount))} owed</Text>
                                <StatusPill status={f.status} tones={FEE_STATUS_TONES} />
                            </View>
                        ))}
                    </InsightCard>
                ) : null}

                {data.reports.length > 0 ? (
                    <InsightCard title="Report cards">
                        {data.reports.slice(0, 3).map((r, n) => (
                            <View key={r.id} style={[styles.report, n > 0 && styles.rowBorder]}>
                                <Text style={styles.title}>Average {r.overall_average ?? '—'}%{r.overall_position ? ` · position ${r.overall_position}` : ''}</Text>
                                {r.comments_class_teacher ? <Text style={styles.quote}>Class teacher: “{r.comments_class_teacher}”</Text> : null}
                                {r.comments_principal ? <Text style={styles.quote}>Principal: “{r.comments_principal}”</Text> : null}
                            </View>
                        ))}
                    </InsightCard>
                ) : null}

                {data.attendance.length > 0 ? (
                    <InsightCard title="Attendance" meta="Last 30 school days">
                        <AttendanceGrid records={data.attendance} />
                    </InsightCard>
                ) : null}

                {data.events.length > 0 ? (
                    <InsightCard title="Coming up">
                        {data.events.map((e, n) => (
                            <View key={e.id} style={[styles.row, n > 0 && styles.rowBorder]}>
                                <CalendarDays size={16} color={colors.primary} />
                                <Text style={[styles.body, { flex: 1 }]}>{e.title}</Text>
                                <Text style={styles.muted}>{date(e.starts_on)}</Text>
                            </View>
                        ))}
                    </InsightCard>
                ) : null}

                {data.ride ? (
                    <InsightCard title="Transport"><Text style={styles.body}>{rideLine(data.ride)}</Text></InsightCard>
                ) : null}

                {data.summary && data.summary.announcements.length > 0 ? (
                    <InsightCard title="Notices">
                        {data.summary.announcements.map((a, n) => (
                            <View key={a.id} style={[styles.report, n > 0 && styles.rowBorder]}>
                                <Text style={styles.title}>{a.isImportant ? <Text style={{ color: colors.danger }}>Important · </Text> : null}{a.title}</Text>
                                <Text style={styles.muted} numberOfLines={4}>{a.content}</Text>
                            </View>
                        ))}
                    </InsightCard>
                ) : null}
            </Reveal>
        </View>
    );
}

/** A parent's children, one at a time — the web's /parent page. */
export default function ParentHomeScreen() {
    const { colors, scheme } = useTheme();
    const styles = useStyles();
    const { hasModule, role, profile } = useCurrentUser();
    const { data: children, loading, error, reload } = useOpsData<ChildLink[]>('/api/parent/children');
    const [active, setActive] = useState<string | null>(null);
    const [signal, setSignal] = useState(0);
    const linked = (children ?? []).filter((c): c is ChildLink & { student: NonNullable<ChildLink['student']> } => c.student !== null);
    const current = active ?? linked[0]?.student.id ?? null;

    if (!hasModule('parent_portal')) {
        return (
            <Screen>
                <EmptyState title={`${MODULES.parent_portal.name} is switched off`} description={role === 'PARENT' ? 'Ask the school to turn on the parent portal.' : undefined} />
            </Screen>
        );
    }

    return (
        <HomeScreen onRefresh={() => { void reload(); setSignal((n) => n + 1); }} refreshing={false}>
            <Reveal index={0}>
                <HeroFrame name={profile?.first_name ?? ''} gradient={scheme === 'dark' ? PARENT_HERO_DARK : PARENT_HERO}>
                    <Text style={styles.heroLine}>Results, fees, attendance, the bus and school news for {linked.length === 1 ? personName(linked[0].student.user) : 'each of your children'}.</Text>
                    {linked.length > 1 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.children} accessibilityRole="tablist">
                            {linked.map((c) => {
                                const on = c.student.id === current;
                                const name = personName(c.student.user);
                                return (
                                    <PressScale key={c.student.id} onPress={() => setActive(c.student.id)} style={[styles.child, on && styles.childOn]} accessibilityLabel={name}>
                                        <View style={[styles.childAvatar, on && { backgroundColor: '#ffffff' }]}>
                                            <Text style={[styles.childInitials, on && { color: '#be123c' }]}>{initials(c.student.user)}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.childName} numberOfLines={1}>{name.split(' ')[0]}</Text>
                                            <Text style={styles.childClass} numberOfLines={1}>{c.student.stream?.full_name}</Text>
                                        </View>
                                    </PressScale>
                                );
                            })}
                        </ScrollView>
                    ) : null}
                </HeroFrame>
            </Reveal>
            {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
            {loading && !children ? <LoadingView /> : linked.length === 0 ? (
                <EmptyState icon={Users} title="No children linked yet" description="Ask the school to link your account to your child." />
            ) : current ? (
                <View style={{ marginTop: spacing.md }}>
                    <Overview key={`${current}-${signal}`} childId={current} />
                </View>
            ) : null}
            <View style={{ height: 1, backgroundColor: colors.background }} />
        </HomeScreen>
    );
}

const useStyles = makeStyles((colors) => ({
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.foreground },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, flexShrink: 1 },
    score: { fontSize: 14, fontFamily: fonts.display, color: colors.foreground },
    quote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, fontStyle: 'italic', color: colors.muted, marginTop: 4 },
    resultHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    report: { paddingVertical: 10 },
    bus: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    day: { width: 22, height: 22, borderRadius: 6 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: 6, marginTop: spacing.md },
    heroLine: { fontSize: 13, lineHeight: 19, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.9)', marginTop: spacing.sm },
    children: { gap: spacing.sm, marginTop: spacing.md, paddingRight: spacing.md },
    child: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, paddingLeft: 6, paddingRight: spacing.md, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
    childOn: { backgroundColor: 'rgba(255,255,255,0.28)', borderColor: '#ffffff' },
    childAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    childInitials: { fontSize: 13, fontFamily: fonts.bold, color: '#ffffff' },
    childName: { fontSize: 13, fontFamily: fonts.bold, color: '#ffffff' },
    childClass: { fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)' },
}));
