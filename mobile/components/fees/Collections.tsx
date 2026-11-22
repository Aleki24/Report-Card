import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { withQuery } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { fonts, makeStyles, spacing, useTheme } from '@/lib/theme';
import { Card, ChipSelect, ErrorBanner, LoadingView, ProgressBar, SectionLabel, StatGrid, StatTile } from '@/components/ui';
import { addDays, formatIsoDate, schoolToday } from '@shared/dates';
import type { CollectionBucket, CollectionsResponse } from '@shared/fee-reports';

type PresetId = 'today' | 'week' | 'month' | 'days30';
const PRESETS: readonly { value: PresetId; label: string; range: (today: string) => readonly [string, string] }[] = [
    { value: 'today', label: 'Today', range: (t) => [t, t] },
    { value: 'week', label: 'Last 7 days', range: (t) => [addDays(t, -6), t] },
    { value: 'month', label: 'This month', range: (t) => [`${t.slice(0, 8)}01`, t] },
    { value: 'days30', label: 'Last 30 days', range: (t) => [addDays(t, -29), t] },
];

/** A breakdown as bars, largest first: method, class or day. */
function MoneyBars({ title, rows, label }: { title: string; rows: readonly CollectionBucket[]; label?: (b: CollectionBucket) => string }) {
    const { colors } = useTheme();
    const styles = useStyles();
    if (rows.length === 0) return null;
    const max = Math.max(...rows.map((r) => r.amount), 1);
    return (
        <>
            <SectionLabel>{title}</SectionLabel>
            <Card>
                {rows.map((r) => (
                    <View key={r.key} style={styles.bar}>
                        <View style={styles.barHead}>
                            <Text style={styles.barLabel} numberOfLines={1}>{label ? label(r) : r.label}</Text>
                            <Text style={styles.barValue}>{formatCurrency(r.amount)}</Text>
                        </View>
                        <ProgressBar value={(r.amount / max) * 100} color={colors.success} />
                        <Text style={styles.sub}>{r.count} {r.count === 1 ? 'payment' : 'payments'}</Text>
                    </View>
                ))}
            </Card>
        </>
    );
}

/**
 * The web's Collections: what came in over a period, the total and number of
 * payments, split by method, by class and by day, for the bursar's daily
 * banking and the head's weekly report.
 */
export function Collections() {
    const { colors } = useTheme();
    const today = schoolToday();
    const [preset, setPreset] = useState<PresetId>('month');
    const [from, to] = PRESETS.find((p) => p.value === preset)!.range(today);
    const query = useApiQuery<CollectionsResponse>(withQuery('/api/school/fees/collections', { from, to }), { raw: true });
    const body = query.data && query.data.from === from && query.data.to === to ? query.data : null;
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

    return (
        <View>
            <ChipSelect options={PRESETS} value={preset} onChange={setPreset} />
            {query.error && !body ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {!body ? (
                query.loading ? <LoadingView /> : null
            ) : (
                <>
                    <StatGrid>
                        <StatTile label="Received" value={formatCurrency(body.total)} tone={colors.success} />
                        <StatTile label="Payments" value={body.count} sub={body.count > 0 ? `average ${formatCurrency(Math.round(body.total / body.count))}` : undefined} />
                        <StatTile label="Per day" value={formatCurrency(Math.round(body.total / days))} sub={`over ${days} ${days === 1 ? 'day' : 'days'}`} />
                    </StatGrid>
                    <MoneyBars title="By method" rows={body.byMethod} />
                    <MoneyBars title="By class" rows={body.byClass} />
                    {body.byDay.length > 1 ? <MoneyBars title="By day" rows={body.byDay} label={(b) => formatIsoDate(b.key, { weekday: 'short', day: 'numeric', month: 'short' })} /> : null}
                </>
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    bar: { gap: 4, paddingVertical: spacing.xs },
    barHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    barLabel: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    barValue: { fontSize: 13, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
}));
