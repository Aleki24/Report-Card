import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { WEEKDAY_LABELS, type TimetableConfig, type TimetableLesson } from '@shared/timetable/config';
import { cellLines, type GridMode } from '@shared/ops/forms/academics';
import { colors, radius, spacing, fonts } from '@/lib/theme';

interface Props {
    config: TimetableConfig;
    lessons: readonly TimetableLesson[];
    mode: GridMode;
    /** Editing: the lesson picked to move, and what a tap on a cell does. */
    selectedId?: string | null;
    onCellPress?: (day: number, period: number, lesson: TimetableLesson | null) => void;
}

/** Wide enough for the whole week at once (tablets, landscape); phones show a day at a time. */
const WEEK_BREAKPOINT = 768;

/**
 * The web's timetable grid: on phones one day at a time, so nothing scrolls
 * sideways; from tablet width the whole week, periods down and days across.
 */
export function TimetableGrid({ config, lessons, mode, selectedId, onCellPress }: Props) {
    const { width } = useWindowDimensions();
    const [phoneDay, setPhoneDay] = useState(config.days[0]);
    const at = (day: number, period: number) => lessons.find((l) => l.day === day && l.period === period) ?? null;

    const cell = (day: number, period: number) => {
        const lesson = at(day, period);
        const selected = !!lesson && lesson.id === selectedId;
        const [top, bottom] = lesson ? cellLines(lesson, mode) : ['', ''];
        const content = lesson ? (
            <View style={[styles.lesson, selected && styles.lessonSelected]}>
                <Text style={[styles.lessonTop, selected && { color: colors.white }]} numberOfLines={1}>{lesson.locked ? '🔒 ' : ''}{top}</Text>
                {bottom ? <Text style={[styles.lessonBottom, selected && { color: colors.white }]} numberOfLines={1}>{bottom}</Text> : null}
            </View>
        ) : <View style={styles.free} />;
        return onCellPress ? (
            <Pressable
                onPress={() => onCellPress(day, period, lesson)}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAY_LABELS[day]} ${config.periods[period]?.label ?? ''}${lesson ? `: ${lesson.subject?.name ?? ''}` : ': free'}`}
                style={styles.cellWrap}
            >
                {content}
            </Pressable>
        ) : <View style={styles.cellWrap}>{content}</View>;
    };

    if (width >= WEEK_BREAKPOINT) {
        return (
            <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
                <View style={styles.week}>
                    <View style={styles.weekRow}>
                        <Text style={[styles.weekHead, styles.periodCol]}>PERIOD</Text>
                        {config.days.map((d) => <Text key={d} style={[styles.weekHead, styles.dayCol]}>{WEEKDAY_LABELS[d].toUpperCase()}</Text>)}
                    </View>
                    {config.periods.map((p, i) => p.is_break ? (
                        <Text key={i} style={styles.breakRow}>{p.label} · {p.start}–{p.end}</Text>
                    ) : (
                        <View key={i} style={styles.weekRow}>
                            <View style={styles.periodCol}>
                                <Text style={styles.periodLabel}>{p.label}</Text>
                                <Text style={styles.periodTime}>{p.start}–{p.end}</Text>
                            </View>
                            {config.days.map((d) => <View key={d} style={styles.dayCol}>{cell(d, i)}</View>)}
                        </View>
                    ))}
                </View>
            </ScrollView>
        );
    }

    return (
        <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs} accessibilityRole="tablist">
                {config.days.map((d) => (
                    <Pressable key={d} onPress={() => setPhoneDay(d)} accessibilityRole="tab" accessibilityState={{ selected: phoneDay === d }} style={[styles.dayTab, phoneDay === d && styles.dayTabOn]}>
                        <Text style={[styles.dayTabText, phoneDay === d && { color: colors.white }]}>{WEEKDAY_LABELS[d]}</Text>
                    </Pressable>
                ))}
            </ScrollView>
            {config.periods.map((p, i) => p.is_break ? (
                <Text key={i} style={styles.breakRow}>{p.label} · {p.start}–{p.end}</Text>
            ) : (
                <View key={i} style={styles.phoneRow}>
                    <View style={{ width: 72 }}>
                        <Text style={styles.periodLabel}>{p.label}</Text>
                        <Text style={styles.periodTime}>{p.start}</Text>
                    </View>
                    <View style={{ flex: 1 }}>{cell(phoneDay, i)}</View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    cellWrap: { minHeight: 48, flex: 1 },
    lesson: { flex: 1, justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.infoBg },
    lessonSelected: { backgroundColor: colors.primary },
    lessonTop: { fontSize: 12, fontFamily: fonts.bold, color: colors.foreground },
    lessonBottom: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
    free: { flex: 1, minHeight: 48, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
    breakRow: { textAlign: 'center', fontSize: 11, fontFamily: fonts.semibold, color: colors.muted, backgroundColor: colors.mutedBg, borderRadius: radius.sm, paddingVertical: 4, marginVertical: 4 },
    phoneRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginBottom: spacing.sm },
    periodLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.foreground },
    periodTime: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
    dayTabs: { gap: spacing.xs, marginBottom: spacing.md },
    dayTab: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.mutedBg, justifyContent: 'center' },
    dayTabOn: { backgroundColor: colors.primary },
    dayTabText: { fontSize: 13, fontFamily: fonts.bold, color: colors.muted },
    week: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, padding: spacing.sm },
    weekRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
    weekHead: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, paddingVertical: 6 },
    periodCol: { width: 88, justifyContent: 'center' },
    dayCol: { flex: 1, minWidth: 110 },
});
