import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MODULES } from '@shared/platform/modules';
import { date, dateTime, humanize, money, personName } from '@shared/ops/format';
import {
    ATTENDANCE_TONES, FEE_STATUS_TONES, absences, feeBalance, rideLine,
    type ChildLink, type ChildOverview,
} from '@shared/ops/forms/platform';
import { Card, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Screen, ScreenHeader, SectionLabel, StatGrid, StatTile } from '@/components/ui';
import { StatusPill, toneColor } from '@/components/ops/bits';
import { useOpsData } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, radius, spacing, fonts } from '@/lib/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View>
            <SectionLabel>{title}</SectionLabel>
            {children}
        </View>
    );
}

/** One child: results, fees, report cards, attendance, events, the bus and notices. */
function Overview({ childId }: { childId: string }) {
    const { data, loading, error, reload } = useOpsData<ChildOverview>(`/api/parent/children/${childId}`);
    if (loading && !data) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={() => void reload()} />;
    if (!data) return null;
    const balance = feeBalance(data);
    const absent = absences(data);

    return (
        <View>
            <StatGrid>
                {data.summary ? <StatTile label="Average score" value={data.summary.stats.examsTaken ? `${data.summary.stats.averageScore}%` : '—'} sub={data.summary.currentTerm?.name} /> : null}
                {data.attendance.length > 0 ? <StatTile label="Absent (30 days)" value={absent} tone={toneColor(absent > 2 ? 'warn' : 'good')} /> : null}
                {data.fees.length > 0 ? <StatTile label="Fee balance" value={money(balance)} tone={toneColor(balance > 0 ? 'warn' : 'good')} /> : null}
            </StatGrid>

            {data.bus ? (
                <Section title="School bus">
                    <Card>
                        <Text style={styles.body}>
                            {data.bus.vehicle?.registration} is on the road{data.bus.last_seen_at ? `, last seen ${dateTime(data.bus.last_seen_at)}` : ''}.
                            {data.bus.boarded ? ` Your child: ${humanize(data.bus.boarded)}.` : ''}
                        </Text>
                    </Card>
                </Section>
            ) : null}

            {data.summary ? (
                <Section title="Latest results">
                    {data.summary.latestResults.length === 0 ? <Text style={styles.muted}>No released results yet.</Text> : (
                        <ListCard>
                            {data.summary.latestResults.map((r) => (
                                <ListRow
                                    key={r.id}
                                    title={r.exams?.subjects?.name ?? 'Subject'}
                                    subtitle={r.exams?.name}
                                    right={<Text style={styles.score}>{r.percentage != null ? `${Math.round(Number(r.percentage))}%` : '—'} {r.grade_symbol ?? ''}</Text>}
                                />
                            ))}
                        </ListCard>
                    )}
                </Section>
            ) : null}

            {data.fees.length > 0 ? (
                <Section title="Fees">
                    <ListCard>
                        {data.fees.map((f) => (
                            <ListRow
                                key={f.id}
                                title={f.term?.name ?? 'Term'}
                                subtitle={`${money(Number(f.total_fee) - Number(f.paid_amount))} owed`}
                                right={<StatusPill status={f.status} tones={FEE_STATUS_TONES} />}
                            />
                        ))}
                    </ListCard>
                </Section>
            ) : null}

            {data.reports.length > 0 ? (
                <Section title="Report cards">
                    {data.reports.slice(0, 3).map((r) => (
                        <Card key={r.id} style={styles.card}>
                            <Text style={styles.title}>Average {r.overall_average ?? '—'}%{r.overall_position ? ` · position ${r.overall_position}` : ''}</Text>
                            {r.comments_class_teacher ? <Text style={styles.muted}>Class teacher: {r.comments_class_teacher}</Text> : null}
                            {r.comments_principal ? <Text style={styles.muted}>Principal: {r.comments_principal}</Text> : null}
                        </Card>
                    ))}
                </Section>
            ) : null}

            {data.attendance.length > 0 ? (
                <Section title="Attendance (30 days)">
                    <View style={styles.wrap}>
                        {data.attendance.slice(0, 30).map((a) => <StatusPill key={a.id} status={a.status} tones={ATTENDANCE_TONES} label={`${date(a.date)} · ${humanize(a.status)}`} />)}
                    </View>
                </Section>
            ) : null}

            {data.events.length > 0 ? (
                <Section title="Coming up">
                    <ListCard>
                        {data.events.map((e) => <ListRow key={e.id} title={e.title} subtitle={date(e.starts_on)} />)}
                    </ListCard>
                </Section>
            ) : null}

            {data.ride ? (
                <Section title="Transport">
                    <Card><Text style={styles.body}>{rideLine(data.ride)}</Text></Card>
                </Section>
            ) : null}

            {data.summary && data.summary.announcements.length > 0 ? (
                <Section title="Notices">
                    {data.summary.announcements.map((a) => (
                        <Card key={a.id} style={styles.card}>
                            <Text style={styles.title}>{a.isImportant ? 'Important: ' : ''}{a.title}</Text>
                            <Text style={styles.muted} numberOfLines={4}>{a.content}</Text>
                        </Card>
                    ))}
                </Section>
            ) : null}
        </View>
    );
}

/** A parent's children, one at a time — the web's /parent page. */
export default function ParentHomeScreen() {
    const { hasModule, role } = useCurrentUser();
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
        <Screen onRefresh={() => { void reload(); setSignal((n) => n + 1); }} refreshing={false}>
            <ScreenHeader title="My children" description="Results, fees, attendance, the bus and school news for each of your children." />
            {error ? <ErrorBanner message={error} onRetry={() => void reload()} /> : null}
            {loading && !children ? <LoadingView /> : linked.length === 0 ? (
                <EmptyState title="No children linked yet" description="Ask the school to link your account to your child." />
            ) : (
                <>
                    {linked.length > 1 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginBottom: spacing.md }} accessibilityRole="tablist">
                            {linked.map((c) => {
                                const on = c.student.id === current;
                                return (
                                    <Pressable key={c.student.id} onPress={() => setActive(c.student.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.child, on && styles.childOn]}>
                                        <Text style={styles.title}>{personName(c.student.user)}</Text>
                                        <Text style={styles.muted}>{c.student.stream?.full_name}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    ) : null}
                    {current ? <Overview key={`${current}-${signal}`} childId={current} /> : null}
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    body: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    score: { fontSize: 14, fontFamily: fonts.display, color: colors.foreground },
    card: { marginBottom: spacing.sm, padding: spacing.md },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    child: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    childOn: { borderColor: colors.primary, backgroundColor: colors.infoBg },
});
