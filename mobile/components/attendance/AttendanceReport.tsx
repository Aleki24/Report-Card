import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { withQuery } from '@/lib/api';
import { fonts, makeStyles, spacing, useTheme } from '@/lib/theme';
import { ChipSelect, EmptyState, ErrorBanner, ListCard, LoadingView, SectionLabel, StatGrid, StatTile, ToggleRow } from '@/components/ui';
import { statusColor } from './AttendanceBar';
import { addDays, formatIsoDate, localIsoDate } from '@shared/dates';
import { ATTENDANCE_LABELS, LOW_ATTENDANCE_RATE, type AttendanceSummaryResponse } from '@shared/attendance';

type Range = readonly [from: string, to: string];
type PresetId = 'week' | 'month' | 'days30' | 'days90';

/** Monday of the week `day` falls in. */
function weekStart(day: string): string {
    const weekday = new Date(`${day}T00:00:00`).getDay();
    return addDays(day, -((weekday + 6) % 7));
}

const PRESETS: readonly { value: PresetId; label: string; range: (today: string) => Range }[] = [
    { value: 'week', label: 'This week', range: (t) => [weekStart(t), t] },
    { value: 'month', label: 'This month', range: (t) => [`${t.slice(0, 8)}01`, t] },
    { value: 'days30', label: 'Last 30 days', range: (t) => [addDays(t, -29), t] },
    { value: 'days90', label: 'Last 90 days', range: (t) => [addDays(t, -89), t] },
];

const short = (iso: string) => formatIsoDate(iso, { day: 'numeric', month: 'short' });

/**
 * The web's attendance Reports: one class over a period, its rate, who is
 * often away (below {@link LOW_ATTENDANCE_RATE}%), and each learner's days.
 */
export function AttendanceReport({ streams, initialStreamId }: { streams: readonly { id: string; full_name: string }[]; initialStreamId: string | null }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const today = localIsoDate();
    const [streamId, setStreamId] = useState<string | null>(initialStreamId ?? streams[0]?.id ?? null);
    const [preset, setPreset] = useState<PresetId>('month');
    const [lowOnly, setLowOnly] = useState(false);
    const [from, to] = PRESETS.find((p) => p.value === preset)!.range(today);
    const query = useApiQuery<AttendanceSummaryResponse>(streamId ? withQuery('/api/school/attendance/summary', { stream_id: streamId, from, to }) : null, { raw: true });
    const body = query.data && query.data.from === from && query.data.to === to ? query.data : null;

    if (streams.length === 0) return <EmptyState title="You have no class to report on" />;

    const low = body ? body.learners.filter((l) => l.rate !== null && l.rate < LOW_ATTENDANCE_RATE) : [];
    // Lowest first so the learners to follow up are on top; never marked last.
    const shown = [...(lowOnly ? low : body?.learners ?? [])].sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.name.localeCompare(b.name));
    const rateColor = (rate: number | null) => (rate === null ? colors.muted : rate < LOW_ATTENDANCE_RATE ? colors.warningText : colors.successText);

    return (
        <View>
            <ChipSelect options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={streamId} onChange={setStreamId} />
            <ChipSelect options={PRESETS} value={preset} onChange={setPreset} />
            {query.error && !body ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {!body ? (
                query.loading ? <LoadingView /> : null
            ) : (
                <>
                    <StatGrid>
                        <StatTile label="Class attendance" value={body.rate === null ? '—' : `${body.rate}%`} tone={body.rate === null ? undefined : body.rate < LOW_ATTENDANCE_RATE ? colors.warning : colors.success} />
                        <StatTile label="Registers taken" value={body.days.length} sub={`${short(from)} – ${short(to)}`} />
                        <StatTile label={`Below ${LOW_ATTENDANCE_RATE}%`} value={low.length} sub={`of ${body.learners.length} learners`} tone={low.length > 0 ? colors.warning : colors.success} />
                    </StatGrid>
                    {body.days.length === 0 ? (
                        <EmptyState title="No register was taken for this class in this period" />
                    ) : (
                        <>
                            <SectionLabel>Learners · lowest first</SectionLabel>
                            <ToggleRow label={`Only below ${LOW_ATTENDANCE_RATE}%`} value={lowOnly} onValueChange={setLowOnly} />
                            {shown.length === 0 ? (
                                <EmptyState title={`Nobody is below ${LOW_ATTENDANCE_RATE}%`} />
                            ) : (
                                <ListCard>
                                    {shown.map((l) => (
                                        <View key={l.id} style={styles.row}>
                                            <View style={styles.head}>
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                    <Text style={styles.name} numberOfLines={1}>{l.name}</Text>
                                                    <Text style={styles.sub} numberOfLines={1}>
                                                        {[l.admission_number, `${l.counts.absent} absent`, l.counts.late ? `${l.counts.late} late` : '', l.counts.excused ? `${l.counts.excused} excused` : ''].filter(Boolean).join(' · ')}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.rate, { color: rateColor(l.rate) }]}>{l.rate === null ? '—' : `${l.rate}%`}</Text>
                                            </View>
                                            {/* One square per register day, oldest first; scrolls sideways when the period is long. */}
                                            <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                accessibilityLabel={`${l.name}: ${l.counts.present} present, ${l.counts.late} late, ${l.counts.excused} excused, ${l.counts.absent} absent`}
                                                contentContainerStyle={styles.days}
                                            >
                                                {body.days.map((day) => {
                                                    const status = l.days[day];
                                                    return <View key={day} style={[styles.day, { backgroundColor: status ? statusColor(colors, status) : colors.mutedBg }]} />;
                                                })}
                                            </ScrollView>
                                        </View>
                                    ))}
                                </ListCard>
                            )}
                            <View style={styles.legend}>
                                {(['present', 'late', 'excused', 'absent'] as const).map((s) => (
                                    <View key={s} style={styles.legendItem}>
                                        <View style={[styles.swatch, { backgroundColor: statusColor(colors, s) }]} />
                                        <Text style={styles.sub}>{ATTENDANCE_LABELS[s]}</Text>
                                    </View>
                                ))}
                                <View style={styles.legendItem}>
                                    <View style={[styles.swatch, { backgroundColor: colors.mutedBg }]} />
                                    <Text style={styles.sub}>Not marked</Text>
                                </View>
                            </View>
                        </>
                    )}
                </>
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    row: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    rate: { fontSize: 15, fontFamily: fonts.bold },
    days: { gap: 3 },
    day: { width: 12, height: 12, borderRadius: 3 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
}));
