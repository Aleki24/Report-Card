import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { humanize, personName } from '@shared/ops/format';
import type { TimetableConfig, TimetableVersion } from '@shared/timetable/config';
import {
    TIMETABLE_STEPS as STEPS, firstOpenStep as firstOpen, isStepDone as isDone, stepStatus as statusLine, timetableProgress,
    type TimetableProgress as Progress,
} from '@shared/timetable/wizard';
import {
    LOAD_DEFAULTS, LOAD_FIELDS, ROOM_DEFAULTS, ROOM_FIELDS, importLoadsMessage, loadLessonsLabel, weeklyLessonsPerClass,
    type Room, type TeachingLoad,
} from '@shared/ops/forms/academics';
import { Button, Card, TextField } from '@/components/ui';
import { ResourceList } from '@/components/ops/ResourceList';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { DayStructureEditor, TimetableBuilder } from './TimetablePanels';

/** Teaching loads: which teacher takes which subject with which class, and how often. */
function Loads({ onChange }: { onChange: () => void }) {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [perWeek, setPerWeek] = useState('5');
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState(false);

    const importLoads = async () => {
        setBusy(true);
        try {
            const r = await api.post<{ data: { created: number } }>('/api/academics/timetable/requirements/import', { lessons_per_week: Number(perWeek) || 5 });
            toast.success(importLoadsMessage(r.data.created));
            setVersion((v) => v + 1);
            onChange();
        } catch (err) {
            toast.error(errorMessage(err, 'Import failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>Start from subject assignments</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>Creates a load for every subject each teacher is assigned to a class this year. Adjust any of them below.</Text>
                <TextField label="Lessons a week" value={perWeek} onChangeText={setPerWeek} keyboardType="number-pad" />
                <Button label={busy ? 'Importing…' : 'Import loads'} onPress={() => void importLoads()} loading={busy} block />
            </Card>
            <ResourceList<'timetable-requirements', TeachingLoad>
                key={version}
                resource="timetable-requirements"
                fields={LOAD_FIELDS}
                canCreate
                canEdit
                canDelete
                defaults={LOAD_DEFAULTS}
                searchText={(l) => `${l.stream?.full_name} ${l.subject?.name} ${personName(l.teacher)}`}
                header={(rows) => (rows.length > 0 ? (
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>Weekly lessons per class: {weeklyLessonsPerClass(rows)}</Text>
                ) : null)}
                title={(l) => `${l.stream?.full_name ?? ''} · ${l.subject?.name ?? ''}`}
                subtitle={(l) => (l.teacher ? personName(l.teacher) : 'Unassigned')}
                details={(l) => [
                    ['Lessons', loadLessonsLabel(l)],
                    ['Room', l.room_type ? humanize(l.room_type) : 'Any'],
                ]}
            />
        </View>
    );
}

/** Specialist rooms (labs, workshops) so practicals land in one. */
export function Rooms() {
    return (
        <ResourceList<'rooms', Room>
            resource="rooms"
            fields={ROOM_FIELDS}
            canCreate
            canEdit
            canDelete
            defaults={ROOM_DEFAULTS}
            title={(r) => r.name}
            subtitle={(r) => `${humanize(r.room_type)} · ${r.capacity ?? '—'} seats`}
            emptyText="No rooms yet. Add labs so practicals get one; ordinary lessons run in the class's own room."
        />
    );
}

/** Numbered dots joined by a line; done steps tick, the current one glows. */
function Stepper({ current, progress, onPick }: { current: number; progress: Progress | null; onPick: (i: number) => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <View style={styles.stepper} accessibilityRole="tablist">
            {STEPS.map((s, i) => {
                const done = isDone(s.id, progress);
                const on = i === current;
                return (
                    <React.Fragment key={s.id}>
                        {i > 0 ? <View style={[styles.link, (done || i <= current) && { backgroundColor: colors.primary }]} /> : null}
                        <Pressable onPress={() => onPick(i)} style={styles.stepCell} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Step ${i + 1}: ${s.title}`}>
                            <View style={[styles.dot, done && styles.dotDone, on && styles.dotOn]}>
                                {done && !on ? <Check size={14} color={colors.onPrimary} strokeWidth={3} /> : <Text style={[styles.dotText, (on || done) && { color: colors.onPrimary }]}>{i + 1}</Text>}
                            </View>
                            <Text style={[styles.stepLabel, on && { color: colors.foreground, fontFamily: fonts.bold }]} numberOfLines={1}>{s.short}</Text>
                        </Pressable>
                    </React.Fragment>
                );
            })}
        </View>
    );
}

/**
 * Making a timetable, start to finish, in the order it has to happen: the
 * day, the rooms, the loads, then generate and publish. Each step says what
 * is done, and Next moves on, so nothing sends you back to an earlier tab.
 */
export function TimetableWizard() {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const [progress, setProgress] = useState<Progress | null>(null);
    const [step, setStep] = useState<number | null>(null);

    const refresh = useCallback(async () => {
        const [config, rooms, loads, versions] = await Promise.all([
            opsGet<TimetableConfig>(api, '/api/academics/timetable/config').catch(() => null),
            opsGet<{ id: string }[]>(api, '/api/ops/rooms').catch(() => []),
            opsGet<{ id: string }[]>(api, '/api/ops/timetable-requirements').catch(() => []),
            opsGet<TimetableVersion[]>(api, '/api/academics/timetable/versions').catch(() => []),
        ]);
        const next = timetableProgress(config, rooms, loads, versions);
        setProgress(next);
        setStep((s) => s ?? firstOpen(next));
    }, [api]);

    useEffect(() => { void refresh(); }, [refresh]);

    const current = step ?? 0;
    const s = STEPS[current];
    const go = (i: number) => { setStep(i); void refresh(); };
    const next = STEPS[current + 1];
    const prev = STEPS[current - 1];

    return (
        <View>
            <Stepper current={current} progress={progress} onPick={go} />
            <View style={styles.intro}>
                <Text style={styles.introStep}>STEP {current + 1} OF {STEPS.length}{s.optional ? ' · OPTIONAL' : ''}</Text>
                <Text style={styles.introTitle}>{s.title}</Text>
                <Text style={styles.introWhy}>{s.why}</Text>
                {statusLine(s.id, progress) ? (
                    <View style={[styles.status, { backgroundColor: isDone(s.id, progress) ? colors.successBg : colors.mutedBg }]}>
                        {isDone(s.id, progress) ? <Check size={13} color={colors.success} strokeWidth={3} /> : null}
                        <Text style={[styles.statusText, { color: isDone(s.id, progress) ? colors.successText : colors.muted }]}>{statusLine(s.id, progress)}</Text>
                    </View>
                ) : null}
            </View>

            <React.Fragment key={s.id}>
                {s.id === 'day' ? <DayStructureEditor onSaved={() => go(current + 1)} /> : null}
                {s.id === 'rooms' ? <Rooms /> : null}
                {s.id === 'loads' ? <Loads onChange={() => void refresh()} /> : null}
                {s.id === 'generate' ? <TimetableBuilder /> : null}
            </React.Fragment>

            <View style={styles.nav}>
                {prev ? (
                    <Pressable onPress={() => go(current - 1)} style={({ pressed }) => [styles.navBtn, styles.navBack, pressed && { opacity: 0.8 }]} accessibilityRole="button">
                        <ChevronLeft size={18} color={colors.foreground} />
                        <Text style={styles.navBackText} numberOfLines={1}>{prev.short}</Text>
                    </Pressable>
                ) : <View style={{ flex: 1 }} />}
                {next ? (
                    <Pressable onPress={() => go(current + 1)} style={({ pressed }) => [styles.navBtn, styles.navNext, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                        <Text style={styles.navNextText} numberOfLines={1}>{s.optional && !isDone(s.id, progress) ? 'Skip' : 'Next'}: {next.short}</Text>
                        <ChevronRight size={18} color={colors.onPrimary} />
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    stepper: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
    stepCell: { alignItems: 'center', width: 58 },
    link: { flex: 1, height: 2, marginTop: 15, backgroundColor: colors.border, borderRadius: 1 },
    dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
    dotDone: { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid },
    dotOn: { backgroundColor: colors.primarySolid, borderColor: colors.primarySoft, borderWidth: 4, width: 34, height: 34, borderRadius: 17, marginTop: -1 },
    dotText: { fontSize: 13, fontFamily: fonts.bold, color: colors.muted },
    stepLabel: { fontSize: 11, fontFamily: fonts.semibold, color: colors.muted, marginTop: 6 },
    intro: { marginBottom: spacing.md },
    introStep: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary, letterSpacing: 1 },
    introTitle: { fontSize: 20, fontFamily: fonts.display, color: colors.foreground, marginTop: 2, letterSpacing: -0.3 },
    introWhy: { fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted, marginTop: 4 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.md },
    statusText: { fontSize: 12, fontFamily: fonts.bold },
    nav: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.xl, paddingHorizontal: spacing.md },
    navBack: { backgroundColor: colors.mutedBg, borderWidth: 1, borderColor: colors.border },
    navBackText: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    navNext: { backgroundColor: colors.primarySolid },
    navNextText: { fontSize: 14, fontFamily: fonts.bold, color: colors.onPrimary },
}));
