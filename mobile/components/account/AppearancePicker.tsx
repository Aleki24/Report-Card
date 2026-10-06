import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { fonts, makeStyles, palettes, radius, spacing, useTheme, type Palette, type ThemePreference } from '@/lib/theme';

interface Option {
    value: ThemePreference;
    label: string;
    icon: LucideIcon;
}

const OPTIONS: readonly Option[] = [
    { value: 'system', label: 'Automatic', icon: Smartphone },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
];

/** A tiny drawing of a screen in that palette: header bar, a card, two lines. */
function Preview({ palette, half }: { palette: Palette; half?: Palette }) {
    const styles = useStyles();
    const paint = (p: Palette) => (
        <View style={[styles.previewPane, { backgroundColor: p.background }]}>
            <View style={[styles.previewBar, { backgroundColor: p.primary }]} />
            <View style={[styles.previewCard, { backgroundColor: p.card, borderColor: p.border }]}>
                <View style={[styles.previewLine, { backgroundColor: p.foreground, width: '70%' }]} />
                <View style={[styles.previewLine, { backgroundColor: p.muted, width: '45%', opacity: 0.6 }]} />
            </View>
        </View>
    );
    return (
        <View style={styles.preview}>
            {half ? (
                <View style={styles.split}>
                    <View style={styles.splitHalf}>{paint(palette)}</View>
                    <View style={styles.splitHalf}>{paint(half)}</View>
                </View>
            ) : paint(palette)}
        </View>
    );
}

/** Profile → Appearance: follow the phone, or always light, or always dark. Applies instantly. */
export function AppearancePicker() {
    const { colors, preference, setPreference } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.card}>
            <Text style={styles.title}>Appearance</Text>
            <Text style={styles.subtitle}>Dark mode is easier on the eyes when marking at night.</Text>
            <View style={styles.row}>
                {OPTIONS.map(({ value, label, icon: Icon }) => {
                    const active = preference === value;
                    return (
                        <Pressable
                            key={value}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            accessibilityLabel={`${label} theme`}
                            onPress={() => {
                                if (active) return;
                                void Haptics.selectionAsync().catch(() => undefined);
                                setPreference(value);
                            }}
                            style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { transform: [{ scale: 0.97 }] }]}
                        >
                            <Preview palette={value === 'dark' ? palettes.dark : palettes.light} half={value === 'system' ? palettes.dark : undefined} />
                            <View style={styles.labelRow}>
                                <Icon size={14} color={active ? colors.primary : colors.muted} />
                                <Text style={[styles.label, active && { color: colors.primary }]}>{label}</Text>
                            </View>
                            {active ? (
                                <View style={styles.check}><Check size={11} color={colors.onPrimary} strokeWidth={3} /></View>
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    card: { backgroundColor: colors.card, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg },
    title: { fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
    row: { flexDirection: 'row', gap: spacing.sm },
    option: { flex: 1, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border, padding: 6, backgroundColor: colors.elevated },
    optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    preview: { height: 64, borderRadius: radius.lg, overflow: 'hidden' },
    previewPane: { flex: 1, padding: 5, gap: 4 },
    previewBar: { height: 6, borderRadius: 3, width: '40%' },
    previewCard: { flex: 1, borderRadius: 5, borderWidth: 1, padding: 4, gap: 3, justifyContent: 'center' },
    previewLine: { height: 4, borderRadius: 2 },
    split: { flex: 1, flexDirection: 'row' },
    splitHalf: { flex: 1, overflow: 'hidden' },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 7, paddingBottom: 3 },
    label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.foreground },
    check: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
