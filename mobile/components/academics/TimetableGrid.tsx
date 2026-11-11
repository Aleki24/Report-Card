import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { WEEKDAY_LABELS, type TimetableConfig, type TimetableLesson } from '@shared/timetable/config';
import { slotLines, subjectKey, type GridMode } from '@shared/ops/forms/academics';
import { gridRows, lessonsAt, rowRunsOn, type GridRow } from '@shared/timetable/layout';
import type { CellHint } from '@shared/timetable/moves';
import { radius, spacing, fonts, makeStyles, useTheme } from '@/lib/theme';

interface Props {
    config: TimetableConfig;
    lessons: readonly TimetableLesson[];
    mode: GridMode;
    /** Editing: the lesson picked to move, and what a tap on a cell does. */
    selectedId?: string | null;
    onCellPress?: (day: number, row: GridRow, lesson: TimetableLesson | null) => void;
    /** While a lesson is picked: each cell's move, to show where it can go. */
    hintAt?: (day: number, row: GridRow) => CellHint | null;
}

/** Wide enough for the whole week at once (tablets, landscape); phones show a day at a time. */
const WEEK_BREAKPOINT = 768;

/**
 * The web's timetable grid: on phones one day at a time, so nothing scrolls
 * sideways; from tablet width the whole week, periods down and days across.
 * A class shows its section's bell, a period that runs on some days only
 * shaded on the others; a teacher or room across sections shows each lesson
 * time.
 */
export function TimetableGrid({ config, lessons, mode, selectedId, onCellPress, hintAt }: Props) {
    const { colors } = useTheme();
    const styles = useStyles();
    const { width } = useWindowDimensions();
    // Opens on today (1 = Monday … 7 = Sunday), or the next school day, rather than always on Monday.
    const [phoneDay, setPhoneDay] = useState(() => {
        const today = ((new Date().getDay() + 6) % 7) + 1;
        return config.days.find((d) => d >= today) ?? config.days[0];
    });
    const rows = useMemo(() => gridRows(config, lessons), [config, lessons]);

    const cell = (day: number, row: GridRow) => {
        // A period that runs on some days only (a Friday ninth lesson) is shaded on the others.
        if (!rowRunsOn(row, day)) {
            return (
                <View style={[styles.cellWrap, styles.offDay]} accessibilityLabel={`${row.label} does not run on ${WEEKDAY_LABELS[day]}`}>
                    <Text style={styles.offDayText}>Not on {WEEKDAY_LABELS[day]}</Text>
                </View>
            );
        }
        const here = lessonsAt(config, lessons, day, row);
        const lesson = here[0] ?? null;
        const selected = here.some((l) => l.id === selectedId);
        const hint = selected ? null : hintAt?.(day, row) ?? null;
        const [top, bottom] = slotLines(here, mode);
        const content = lesson ? (
            <View style={[styles.lesson, here.length > 1 && styles.lessonBlock, selected && styles.lessonSelected, hint?.state === 'swap' && styles.swapTarget]}>
                <Text style={[styles.lessonTop, selected && { color: colors.white }]} numberOfLines={1}>{here.some((l) => l.locked) ? '🔒 ' : ''}{hint?.state === 'swap' ? '⇄ ' : ''}{top}</Text>
                {bottom ? <Text style={[styles.lessonBottom, selected && { color: colors.white }]} numberOfLines={1}>{bottom}</Text> : null}
            </View>
        ) : hint?.state === 'free'
            ? <View style={[styles.free, styles.freeTarget]}><Text style={styles.freeTargetText}>Move here</Text></View>
            : <View style={styles.free} />;
        const hintText = hint ? ` · ${hint.state === 'free' ? 'can move here' : hint.state === 'swap' ? 'can swap here' : hint.reason ?? 'cannot move here'}` : '';
        return onCellPress ? (
            <Pressable
                onPress={() => onCellPress(day, row, lesson)}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAY_LABELS[day]} ${row.label}${lesson ? `: ${here.map((l) => l.subject?.name ?? '').join(', ')}` : ': free'}${hintText}`}
                style={[styles.cellWrap, hint?.state === 'blocked' && styles.blocked]}
            >
                {content}
            </Pressable>
        ) : <View style={styles.cellWrap}>{content}</View>;
    };

    // What each subject code stands for.
    const codes = subjectKey(lessons);
    const key = codes.length > 0
        ? <Text style={styles.key} accessibilityLabel="Subject codes">{codes.map((c) => `${c.code} ${c.name}`).join('  ·  ')}</Text>
        : null;

    if (width >= WEEK_BREAKPOINT) {
        return (
          <View>
            <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
                <View style={styles.week}>
                    <View style={styles.weekRow}>
                        <Text style={[styles.weekHead, styles.periodCol]}>PERIOD</Text>
                        {config.days.map((d) => <Text key={d} style={[styles.weekHead, styles.dayCol]}>{WEEKDAY_LABELS[d].toUpperCase()}</Text>)}
                    </View>
                    {rows.map((r) => r.isBreak ? (
                        <Text key={r.key} style={styles.breakRow}>{r.label} · {r.time}</Text>
                    ) : (
                        <View key={r.key} style={styles.weekRow}>
                            <View style={styles.periodCol}>
                                <Text style={styles.periodLabel}>{r.label}</Text>
                                <Text style={styles.periodTime}>{r.time}</Text>
                            </View>
                            {config.days.map((d) => <View key={d} style={styles.dayCol}>{cell(d, r)}</View>)}
                        </View>
                    ))}
                </View>
            </ScrollView>
            {key}
          </View>
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
            {rows.filter((r) => rowRunsOn(r, phoneDay)).map((r) => r.isBreak ? (
                <Text key={r.key} style={styles.breakRow}>{r.label} · {r.time}</Text>
            ) : (
                <View key={r.key} style={styles.phoneRow}>
                    <View style={{ width: 72 }}>
                        <Text style={styles.periodLabel}>{r.label}</Text>
                        <Text style={styles.periodTime}>{r.time}</Text>
                    </View>
                    <View style={{ flex: 1 }}>{cell(phoneDay, r)}</View>
                </View>
            ))}
            {key}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    cellWrap: { minHeight: 48, flex: 1 },
    lesson: { flex: 1, justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.infoBg },
    lessonSelected: { backgroundColor: colors.primary },
    lessonBlock: { backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}40` },
    lessonTop: { fontSize: 12, fontFamily: fonts.bold, color: colors.foreground },
    lessonBottom: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
    free: { flex: 1, minHeight: 48, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
    offDay: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.mutedBg },
    freeTarget: { alignItems: 'center', justifyContent: 'center', borderColor: colors.success, backgroundColor: colors.successBg },
    freeTargetText: { fontSize: 11, fontFamily: fonts.bold, color: colors.successText },
    swapTarget: { borderWidth: 2, borderColor: colors.info },
    blocked: { opacity: 0.35 },
    offDayText: { fontSize: 10, fontFamily: fonts.semibold, color: colors.muted },
    key: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: spacing.sm, lineHeight: 16 },
    breakRow: { textAlign: 'center', fontSize: 11, fontFamily: fonts.semibold, color: colors.warningText, backgroundColor: colors.warningBg, borderRadius: radius.sm, paddingVertical: 4, marginVertical: 4 },
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
}));
