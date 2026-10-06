import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { formatDate, parseISODate, toISODate } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme, shadowFor } from '@/lib/theme';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** The days shown for a month: Monday-first weeks, blanks before the 1st. */
function monthGrid(year: number, month: number): (number | null)[] {
    const first = new Date(year, month, 1).getDay(); // 0 = Sunday
    const lead = (first + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

const iso = (y: number, m: number, d: number) => toISODate(new Date(y, m, d));

/**
 * A date you pick from a calendar rather than type: the field shows the day
 * in words, and tapping it opens a month view. Stores YYYY-MM-DD.
 */
export function DateField({ label, value, onChange, min, max, placeholder = 'Choose a date', optional }: {
    label?: string;
    value: string;
    onChange: (iso: string) => void;
    /** Earliest and latest days that can be picked, YYYY-MM-DD. */
    min?: string;
    max?: string;
    placeholder?: string;
    /** Shows a clear button, for dates that may be left empty. */
    optional?: boolean;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    const insets = useSafeAreaInsets();
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const anchor = valid ? parseISODate(value) : min ? parseISODate(min) : new Date();
    const [open, setOpen] = useState(false);
    const [view, setView] = useState({ y: anchor.getFullYear(), m: anchor.getMonth() });
    // Tapping the month title lists years, so a birthday is a few taps away.
    const [years, setYears] = useState(false);
    const lastYear = (max ? parseISODate(max) : new Date()).getFullYear() + (max ? 0 : 5);
    const firstYear = min ? parseISODate(min).getFullYear() : lastYear - 90;
    const cells = useMemo(() => monthGrid(view.y, view.m), [view]);
    const today = toISODate();

    const show = () => { setView({ y: anchor.getFullYear(), m: anchor.getMonth() }); setYears(false); setOpen(true); };
    const step = (delta: number) => setView(({ y, m }) => {
        const d = new Date(y, m + delta, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
    });
    const pick = (day: string) => {
        void Haptics.selectionAsync().catch(() => undefined);
        onChange(day);
        setOpen(false);
    };

    return (
        <View style={styles.field}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <Pressable onPress={show} style={({ pressed }) => [styles.control, pressed && { borderColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`${label ?? 'Date'}: ${valid ? formatDate(parseISODate(value), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'not set'}`}>
                <View style={styles.icon}><CalendarDays size={16} color={colors.primary} /></View>
                <Text style={[styles.value, !valid && { color: colors.placeholder }]} numberOfLines={1}>
                    {valid ? formatDate(parseISODate(value), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : placeholder}
                </Text>
                {optional && valid ? (
                    <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Clear ${label ?? 'date'}`}>
                        <X size={16} color={colors.muted} />
                    </Pressable>
                ) : null}
            </Pressable>

            <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
                <View style={styles.backdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" />
                    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                        <View style={styles.grabber} />
                        <View style={styles.head}>
                            <Text style={styles.title} numberOfLines={1}>{label ?? 'Choose a date'}</Text>
                            <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
                                <X size={18} color={colors.muted} />
                            </Pressable>
                        </View>
                        <View style={styles.monthRow}>
                            <Pressable onPress={() => step(-1)} hitSlop={8} style={styles.arrow} accessibilityLabel="Previous month"><ChevronLeft size={20} color={colors.foreground} /></Pressable>
                            <Pressable onPress={() => setYears((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Choose the year">
                                <Text style={styles.month}>{new Date(view.y, view.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} {years ? '▴' : '▾'}</Text>
                            </Pressable>
                            <Pressable onPress={() => step(1)} hitSlop={8} style={styles.arrow} accessibilityLabel="Next month"><ChevronRight size={20} color={colors.foreground} /></Pressable>
                        </View>
                        {years ? (
                            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={styles.yearGrid}>
                                {Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i).map((y) => (
                                    <Pressable key={y} onPress={() => { setView((v) => ({ ...v, y })); setYears(false); }} style={[styles.year, y === view.y && styles.chosen]} accessibilityRole="button">
                                        <Text style={[styles.dayText, y === view.y && { color: colors.onPrimary, fontFamily: fonts.bold }]}>{y}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        ) : (
                        <View style={styles.grid}>
                                {WEEKDAYS.map((w) => <Text key={w} style={styles.weekday}>{w}</Text>)}
                                {cells.map((d, i) => {
                                    if (d === null) return <View key={`b${i}`} style={styles.cell} />;
                                    const day = iso(view.y, view.m, d);
                                    const chosen = day === value;
                                    const disabled = (!!min && day < min) || (!!max && day > max);
                                    return (
                                        <Pressable key={day} disabled={disabled} onPress={() => pick(day)} style={styles.cell} accessibilityRole="button" accessibilityState={{ selected: chosen, disabled }} accessibilityLabel={formatDate(parseISODate(day), { weekday: 'long', day: 'numeric', month: 'long' })}>
                                            <View style={[styles.day, day === today && styles.today, chosen && styles.chosen]}>
                                                <Text style={[styles.dayText, chosen && { color: colors.onPrimary, fontFamily: fonts.bold }, disabled && { color: colors.placeholder, opacity: 0.5 }]}>{d}</Text>
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                        <Pressable onPress={() => { const t = parseISODate(today); setView({ y: t.getFullYear(), m: t.getMonth() }); }} style={styles.todayBtn} accessibilityRole="button">
                            <Text style={styles.todayText}>Go to today</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    field: { marginBottom: spacing.md },
    label: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted, marginBottom: 6 },
    control: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    icon: { width: 32, height: 32, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    value: { flex: 1, fontSize: 15, fontFamily: fonts.semibold, color: colors.foreground },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xxxl, borderTopRightRadius: radius.xxxl, paddingTop: spacing.sm, paddingHorizontal: spacing.lg, width: '100%', maxWidth: 520, alignSelf: 'center', ...shadowFor(colors) },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    title: { flex: 1, fontSize: 18, fontFamily: fonts.display, color: colors.foreground },
    close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
    month: { fontSize: 16, fontFamily: fonts.bold, color: colors.foreground },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontFamily: fonts.bold, color: colors.muted, paddingVertical: 6 },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    day: { width: '82%', height: '82%', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    today: { borderWidth: 1.5, borderColor: colors.primary },
    chosen: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
    dayText: { fontSize: 14, fontFamily: fonts.medium, color: colors.foreground },
    yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm },
    year: { width: '22%', flexGrow: 1, paddingVertical: 12, borderRadius: radius.lg, alignItems: 'center', backgroundColor: colors.mutedBg },
    todayBtn: { alignSelf: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
    todayText: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
}));
