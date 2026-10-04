import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { OverviewTile, TileTone } from '@shared/ops/overview';
import { useOpsData } from '@/lib/ops';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';
import { SectionLabel } from './ui';

const VALUE_COLOR: Record<TileTone, 'foreground' | 'success' | 'warning' | 'danger'> = { default: 'foreground', good: 'success', warn: 'warning', bad: 'danger' };

/** The web's tile links (`/dashboard/boarding?tab=exeats`) as the app's routes (`/staff/boarding?tab=exeats`). */
const appHref = (href: string) => href.replace(/^\/dashboard/, '/staff') as Href;

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
            <SectionLabel>Across the school</SectionLabel>
            <View style={styles.grid}>
                {data.map((t) => (
                    <Pressable key={t.key} onPress={() => router.push(appHref(t.href))} accessibilityRole="link" style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
                        <Text style={styles.label} numberOfLines={2}>{t.label.toUpperCase()}</Text>
                        <Text style={[styles.value, { color: colors[VALUE_COLOR[t.tone]] }]} numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
                        {t.hint ? <Text style={styles.hint} numberOfLines={1}>{t.hint}</Text> : null}
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
    label: { fontSize: 10, fontFamily: fonts.bold, color: colors.muted, letterSpacing: 0.4 },
    value: { fontSize: 20, fontFamily: fonts.display },
    hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
}));
