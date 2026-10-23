import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ArrowRight, BellRing, Check, ChevronDown, DoorOpen } from 'lucide-react-native';
import { Card, Notice } from '@/components/ui';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { examTypeName } from '@/lib/academics';
import { SCHEDULED_EXAM_TYPES } from '@shared/exam-types';
import { LEVEL_ORDER, levelLabel, levelOf, type ExamClass, type ExamWindow, type ExamWindowsResponse, type LevelKey } from '@shared/exam-windows';

interface Level { key: LevelKey; classes: ExamClass[]; types: string[]; waiting: number }

/** "Mid-Term Exam" → "Mid-Term": the chips are short. */
const shortName = (code: string) => examTypeName(code).replace(/ Exam$/, '');

/**
 * The web's "Exam being marked" card, for whoever opens exams: one exam per
 * level, a one-tap "move on" to the next, and who is waiting. Setting a class
 * on its own stays on the web.
 */
export function ExamWindowsCard({ info, onSaved }: { info: ExamWindowsResponse; onSaved: () => void }) {
    const { colors } = useTheme();
    const api = useApi();
    const [open, setOpen] = useState<boolean | null>(null);
    const [pending, setPending] = useState<ReadonlyMap<string, string | null>>(new Map());
    const [saving, setSaving] = useState<LevelKey | null>(null);
    const [error, setError] = useState('');

    const windows = useMemo(() => new Map(info.data.map((w) => [w.grade_id, w.exam_type])), [info.data]);
    const openFor = (gradeId: string) => (pending.has(gradeId) ? pending.get(gradeId) ?? '' : windows.get(gradeId) ?? '');
    const waitingFor = useMemo(() => new Set(info.requests.map((r) => r.grade_id)), [info.requests]);
    const waitingTeachers = new Set(info.requests.flatMap((r) => r.names)).size;

    const levels: Level[] = useMemo(() => {
        const map = new Map<LevelKey, ExamClass[]>();
        for (const c of info.classes) {
            const key = levelOf({ code: c.code, name_display: c.name });
            map.set(key, [...(map.get(key) ?? []), c]);
        }
        return LEVEL_ORDER.filter((k) => map.has(k)).map((key) => {
            const classes = map.get(key) ?? [];
            return {
                key,
                classes,
                types: SCHEDULED_EXAM_TYPES.filter((t) => classes.some((c) => c.types.includes(t))),
                waiting: classes.filter((c) => waitingFor.has(c.grade_id)).length,
            };
        });
    }, [info.classes, waitingFor]);

    const unset = info.classes.filter((c) => !openFor(c.grade_id)).length;
    const expanded = open ?? (unset > 0 || waitingTeachers > 0);

    const setLevel = async (level: Level, examType: string | null) => {
        const entries = level.classes.map((c) => ({ gradeId: c.grade_id, examType }));
        setPending((prev) => new Map([...prev, ...entries.map((e) => [e.gradeId, e.examType] as const)]));
        setSaving(level.key);
        setError('');
        try {
            await api.put<{ data: ExamWindow[] }>('/api/school/exam-windows', { termId: info.termId, entries });
            onSaved();
        } catch (err) {
            setError(errorMessage(err, 'Could not save the open exam'));
        } finally {
            setPending((prev) => {
                const next = new Map(prev);
                for (const e of entries) next.delete(e.gradeId);
                return next;
            });
            setSaving(null);
        }
    };

    const levelValue = (level: Level): string | 'mixed' => {
        const values = new Set(level.classes.map((c) => openFor(c.grade_id)));
        return values.size === 1 ? [...values][0] : 'mixed';
    };

    return (
        <Card style={{ marginBottom: spacing.md, borderColor: unset > 0 || waitingTeachers > 0 ? colors.warningBorder : colors.border }}>
            <Pressable
                onPress={() => setOpen(!expanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
                <View style={{ width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: unset > 0 ? colors.warningBg : colors.successBg }}>
                    {unset > 0 ? <DoorOpen size={20} color={colors.warning} /> : <Check size={20} color={colors.success} />}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: fonts.bold, color: colors.foreground }}>Exam being marked{info.termName ? ` · ${info.termName}` : ''}</Text>
                    <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 }}>
                        {unset > 0 ? `${unset} of ${info.classes.length} classes have no exam chosen.` : 'Every class has its exam. Teachers go straight to it.'}
                    </Text>
                    {waitingTeachers > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <BellRing size={12} color={colors.warningText} />
                            <Text style={{ fontSize: 12, fontFamily: fonts.semibold, color: colors.warningText }}>
                                {waitingTeachers} {waitingTeachers === 1 ? 'teacher is' : 'teachers are'} waiting for you
                            </Text>
                        </View>
                    ) : null}
                </View>
                <ChevronDown size={18} color={colors.muted} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
            </Pressable>

            {expanded ? (
                <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                    {error ? <Notice tone="danger" message={error} /> : null}
                    {levels.map((level) => {
                        const value = levelValue(level);
                        const busy = saving === level.key;
                        const at = value && value !== 'mixed' ? level.types.indexOf(value) : -1;
                        const next = at >= 0 ? level.types[at + 1] : undefined;
                        return (
                            <View key={level.key} style={{ borderWidth: 1, borderColor: level.waiting > 0 ? colors.warningBorder : colors.border, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontFamily: fonts.bold, color: colors.foreground }}>{levelLabel(level.key)}</Text>
                                        <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted }}>
                                            {level.classes.length} {level.classes.length === 1 ? 'class' : 'classes'}
                                            {level.waiting > 0 ? ` · ${level.waiting} waiting` : ''}
                                        </Text>
                                    </View>
                                    {busy ? <ActivityIndicator size="small" color={colors.muted} /> : (
                                        <Text style={{ fontSize: 12, fontFamily: fonts.semibold, color: value === 'mixed' ? colors.muted : value ? colors.successText : colors.warningText }}>
                                            {value === 'mixed' ? 'Varies by class' : value ? `Marking ${shortName(value)}` : 'Not chosen'}
                                        </Text>
                                    )}
                                </View>

                                {next ? (
                                    <Pressable
                                        disabled={busy}
                                        onPress={() => void setLevel(level, next)}
                                        accessibilityRole="button"
                                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderWidth: 1, borderColor: colors.infoBorder, backgroundColor: colors.primarySoft, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, opacity: busy ? 0.6 : 1 }}
                                    >
                                        <Text style={{ flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.primary }}>
                                            {shortName(value)} done? Move on to {shortName(next)}
                                        </Text>
                                        <ArrowRight size={14} color={colors.primary} />
                                    </Pressable>
                                ) : null}

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={`Exam for ${levelLabel(level.key)}`}>
                                    {level.types.map((t) => {
                                        const active = value === t;
                                        return (
                                            <Pressable
                                                key={t}
                                                disabled={busy}
                                                onPress={() => void setLevel(level, t)}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: active }}
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 6 }}
                                            >
                                                {active ? <Check size={13} color={colors.onPrimary} /> : null}
                                                <Text style={{ fontSize: 13, fontFamily: fonts.semibold, color: active ? colors.onPrimary : colors.foreground }}>{shortName(t)}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {value ? (
                                    <Pressable disabled={busy} onPress={() => void setLevel(level, null)} accessibilityRole="button" style={{ alignSelf: 'flex-end' }}>
                                        <Text style={{ fontSize: 12, fontFamily: fonts.medium, color: colors.muted }}>Stop marking</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        );
                    })}
                    <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: colors.muted }}>
                        CATs and your own exam types are always open. Set a class on its own, exam dates and locking a term on the website.
                    </Text>
                </View>
            ) : null}
        </Card>
    );
}
