import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { OverviewTile, TileTone } from '@shared/ops/overview';
import { useOpsData } from '@/lib/ops';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';
import { CountUp, PressScale, SectionTitle, appHref } from './dashboard/kit';

const VALUE_COLOR: Record<TileTone, 'foreground' | 'success' | 'warning' | 'danger'> = { default: 'foreground', good: 'success', warn: 'warning', bad: 'danger' };


/**
 * Live figures from every module the school runs that the viewer may see —
 * the web dashboard's "Across the school" row. Renders nothing when empty.
 */
export function OperationsOverview() {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const { data } = useOpsData<OverviewTile[]>('/api/ops/overview');
    if (!data || data.length === 0) return null;
    return (
        <View accessibilityLabel="School operations">
            <SectionTitle title="Across the school" />
            <View style={styles.grid}>
                {data.map((t) => (
                    <View key={t.key} style={styles.cell}>
                        <PressScale onPress={() => router.push(appHref(t.href))} accessibilityRole="link" accessibilityLabel={`${t.label}: ${t.value}`} style={styles.tile}>
                            <View style={[styles.accent, { backgroundColor: colors[VALUE_COLOR[t.tone]] }]} />
                            <Text style={styles.label} numberOfLines={2}>{t.label}</Text>
                            <CountUp value={t.value} style={[styles.value, { color: colors[VALUE_COLOR[t.tone]] }]} />
                            {t.hint ? <Text style={styles.hint} numberOfLines={1}>{t.hint}</Text> : null}
                        </PressScale>
                    </View>
                ))}
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
    cell: { width: '50%', padding: 5 },
    tile: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xxl, padding: spacing.md, paddingLeft: spacing.md + 4, gap: 2, overflow: 'hidden', minHeight: 92 },
    accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.muted },
    value: { fontSize: 22, fontFamily: fonts.display, letterSpacing: -0.4 },
    hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
}));
