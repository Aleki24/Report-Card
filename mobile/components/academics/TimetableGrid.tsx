import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { WEEKDAY_LABELS, daysLabel, type TimetableConfig, type TimetableLesson } from '@shared/timetable/config';
import { shortSubject, slotLines, subjectCode, subjectKey, type GridMode } from '@shared/ops/forms/academics';
import { dayCells, gridRows, lessonsAt, rowRunsOn, subjectColours, type DayCell, type GridRow } from '@shared/timetable/layout';
import { schoolWeekMinute } from '@shared/dates';
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

/** One colour per subject, as on the web: a soft wash and a strong edge. */
const SWATCHES = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#f97316', '#6366f1', '#65a30d', '#d946ef', '#06b6d4', '#ec4899'] as const;
const BLOCK_SWATCH = '#94a3b8';

/** The school's weekday and minute, ticking each minute, for "today" and "now". */
function useSchoolNow() {
    const [now, setNow] = useState(() => schoolWeekMinute());
    useEffect(() => {
        const id = setInterval(() => setNow(schoolWeekMinute()), 60_000);
        return () => clearInterval(id);
    }, []);
    return now;
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
    const now = useSchoolNow();
    // Opens on today, or the next school day, rather than always on Monday.
    const [phoneDay, setPhoneDay] = useState(() => config.days.find((d) => d >= now.day) ?? config.days[0]);
    const rows = useMemo(() => gridRows(config, lessons), [config, lessons]);
    const codes = useMemo(() => subjectKey(lessons), [lessons]);
    const colours = useMemo(() => subjectColours(codes.map((c) => c.code), SWATCHES.length), [codes]);
    const today = config.days.includes(now.day) ? now.day : null;
    const hueOf = (here: readonly TimetableLesson[]) => {
        const subjects = new Set(here.map((l) => subjectCode(l.subject?.name, l.subject?.code)));
        return subjects.size > 1 ? BLOCK_SWATCH : SWATCHES[colours.get([...subjects][0]) ?? 0];
    };
    // Reading, a double is one card; editing, each period is a place to tap.
    const cellsOf = (day: number): DayCell[] => (onCellPress
        ? rows.map((r) => ({ rows: [r], lessons: r.isBreak || !rowRunsOn(r, day) ? [] : lessonsAt(config, lessons, day, r) }))
        : dayCells(config, lessons, day, rows));
    const isNow = (day: number, c: DayCell) => now.day === day && c.rows[0].start <= now.minutes && now.minutes < c.rows[c.rows.length - 1].end;

    const cell = (day: number, row: GridRow, merged?: DayCell) => {
        // A period that runs on some days only (a Friday ninth lesson) is shaded on the others.
        // An activity (Games) that has the period on this day says so.
        const taken = row.taken?.[day];
        if (!rowRunsOn(row, day) && taken) {
            return (
                <View style={[styles.cellWrap, styles.activity]} accessibilityLabel={`${taken} on ${WEEKDAY_LABELS[day]}`}>
                    <Text style={styles.activityText} numberOfLines={1}>{taken}</Text>
                </View>
            );
        }
        if (!rowRunsOn(row, day)) {
            return (
                <View style={[styles.cellWrap, styles.offDay]} accessibilityLabel={`${row.label} does not run on ${WEEKDAY_LABELS[day]}`}>
                    <Text style={styles.offDayText}>Not on {WEEKDAY_LABELS[day]}</Text>
                </View>
            );
        }
        const here = merged?.lessons ?? lessonsAt(config, lessons, day, row);
        const unique = here.filter((l, i) => here.findIndex((x) => x.subject_id === l.subject_id && x.teacher_id === l.teacher_id) === i);
        const lesson = here[0] ?? null;
        const selected = here.some((l) => l.id === selectedId);
        const hint = selected ? null : hintAt?.(day, row) ?? null;
        const [code, bottom] = slotLines(unique, mode);
        // A phone list has room for the subject's name; the week keeps to codes.
        const top = merged && unique.length === 1 ? shortSubject(unique[0].subject?.name) : code;
        const hue = lesson ? hueOf(unique) : colors.border;
        const span = merged ? merged.rows.length : 1;
        const on = !!merged && isNow(day, merged);
        const content = lesson ? (
            <View style={[styles.lesson, { backgroundColor: `${hue}22`, borderLeftColor: hue }, unique.length > 1 && styles.lessonBlock, selected && styles.lessonSelected, hint?.state === 'swap' && styles.swapTarget, on && { borderColor: colors.primary, borderWidth: 2, borderLeftWidth: 4 }]}>
                <View style={styles.lessonHead}>
                    <Text style={[styles.lessonTop, selected && { color: colors.white }]} numberOfLines={1}>{here.some((l) => l.locked) ? '🔒 ' : ''}{hint?.state === 'swap' ? '⇄ ' : ''}{top}</Text>
                    {span > 1 ? <Text style={styles.tag}>Double</Text> : null}
                    {on ? <Text style={[styles.tag, styles.nowTag]}>Now</Text> : null}
                </View>
                {bottom ? <Text style={[styles.lessonBottom, selected && { color: colors.white }]} numberOfLines={1}>{bottom}</Text> : null}
                {merged ? <Text style={styles.lessonBottom}>{merged.rows[0].time.split('–')[0]}–{merged.rows[merged.rows.length - 1].time.split('–')[1]}</Text> : null}
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

    // What each subject code stands for, in its colour.
    const key = codes.length > 0 ? (
        <View style={styles.key} accessibilityLabel="Subject codes">
            {codes.map((c) => (
                <View key={c.code} style={styles.keyItem}>
                    <View style={[styles.keyDot, { backgroundColor: SWATCHES[colours.get(c.code) ?? 0] }]} />
                    <Text style={styles.keyCode}>{c.code}</Text>
                    <Text style={styles.keyName}>{c.name}</Text>
                </View>
            ))}
        </View>
    ) : null;

    if (width >= WEEK_BREAKPOINT) {
        return (
          <View>
            <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
                <View style={styles.week}>
                    <View style={styles.weekRow}>
                        <Text style={[styles.weekHead, styles.periodCol]}>PERIOD</Text>
                        {config.days.map((d) => <Text key={d} style={[styles.weekHead, styles.dayCol, today === d && { color: colors.primary }]}>{WEEKDAY_LABELS[d].toUpperCase()}{today === d ? ' · TODAY' : ''}</Text>)}
                    </View>
                    {rows.map((r) => r.isBreak ? (
                        <Text key={r.key} style={[styles.breakRow, r.activity && styles.activityRow]}>{r.label} · {r.time}{r.activity && r.days ? ` · ${daysLabel(r.days, config.days)}` : ''}</Text>
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
                        <Text style={[styles.dayTabText, phoneDay === d && { color: colors.white }]}>{WEEKDAY_LABELS[d]}{today === d ? ' •' : ''}</Text>
                    </Pressable>
                ))}
            </ScrollView>
            {cellsOf(phoneDay).filter((c) => rowRunsOn(c.rows[0], phoneDay) || !!c.rows[0].taken?.[phoneDay]).map((c) => c.rows[0].isBreak ? (
                <Text key={c.rows[0].key} style={[styles.breakRow, c.rows[0].activity && styles.activityRow]}>{c.rows[0].label} · {c.rows[0].time}</Text>
            ) : (
                <View key={c.rows[0].key} style={styles.phoneRow}>
                    <View style={{ width: 56 }}>
                        <Text style={styles.periodLabel}>{c.rows.map((r) => r.label).join('–')}</Text>
                    </View>
                    <View style={{ flex: 1, minHeight: c.rows.length > 1 ? 72 : 56 }}>{cell(phoneDay, c.rows[0], c)}</View>
                </View>
            ))}
            {key}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    cellWrap: { minHeight: 48, flex: 1 },
    lesson: { flex: 1, justifyContent: 'center', borderRadius: radius.md, borderLeftWidth: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.infoBg },
    lessonHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tag: { fontSize: 10, fontFamily: fonts.semibold, color: colors.foreground, backgroundColor: colors.card, borderRadius: 6, paddingHorizontal: 5, overflow: 'hidden' },
    nowTag: { marginLeft: 'auto', backgroundColor: colors.primary, color: colors.white },
    lessonSelected: { backgroundColor: colors.primary },
    lessonBlock: { borderStyle: 'dashed' },
    lessonTop: { flexShrink: 1, fontSize: 13, fontFamily: fonts.bold, color: colors.foreground },
    lessonBottom: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
    free: { flex: 1, minHeight: 48, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
    offDay: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.mutedBg },
    freeTarget: { alignItems: 'center', justifyContent: 'center', borderColor: colors.success, backgroundColor: colors.successBg },
    freeTargetText: { fontSize: 11, fontFamily: fonts.bold, color: colors.successText },
    swapTarget: { borderWidth: 2, borderColor: colors.info },
    blocked: { opacity: 0.35 },
    offDayText: { fontSize: 10, fontFamily: fonts.semibold, color: colors.muted },
    key: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    keyItem: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    keyDot: { width: 8, height: 8, borderRadius: 4 },
    keyCode: { fontSize: 11, fontFamily: fonts.bold, color: colors.foreground },
    keyName: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
    activity: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.infoBg, paddingHorizontal: spacing.sm },
    activityText: { fontSize: 12, fontFamily: fonts.bold, color: colors.info },
    activityRow: { color: colors.info, backgroundColor: colors.infoBg },
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
