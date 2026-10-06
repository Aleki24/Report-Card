import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { addDays, date as fmtDate, today } from '@shared/ops/format';
import { TEACHING_DAY_NOTE, nextStep, type TeachingDay, type TeachingDayAction, type TeachingDayLesson } from '@shared/academics/teaching-day';
import { Badge, Button, ButtonRow, Card, EmptyState, LoadingView } from '@/components/ui';
import { DateField } from '@/components/DateField';
import { useToast } from '@/components/Toast';
import { useRefreshSignal } from '@/components/ops/bits';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { fonts, spacing, useTheme } from '@/lib/theme';

const URL = '/api/academics/lesson-records/day';

function LessonCard({ lesson, busy, onAction }: { lesson: TeachingDayLesson; busy: boolean; onAction: (a: TeachingDayAction) => void }) {
    const { colors } = useTheme();
    const step = nextStep(lesson);
    return (
        <Card style={{ marginBottom: spacing.sm, padding: spacing.md, gap: 6, borderColor: lesson.record ? colors.success : colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, color: colors.foreground }}>{lesson.start}–{lesson.end}{lesson.periods > 1 ? ' · double' : ''}</Text>
                {lesson.record ? <Badge variant="success" label="Taught" /> : lesson.plan ? <Badge variant="info" label="Planned" /> : null}
            </View>
            <Text style={{ fontFamily: fonts.semibold, color: colors.foreground }}>{lesson.subject.name} · {lesson.stream.name}{lesson.room ? ` · ${lesson.room}` : ''}</Text>
            <Text style={{ fontSize: 13, fontFamily: fonts.regular, color: lesson.entry ? colors.foreground : colors.muted }}>
                {lesson.entry
                    ? `Week ${lesson.entry.week}, lesson ${lesson.entry.lesson}: ${lesson.entry.topic}${lesson.entry.sub_topic ? ` — ${lesson.entry.sub_topic}` : ''}`
                    : lesson.scheme ? 'Every lesson in the scheme is taught.' : 'No scheme of work for this class yet.'}
            </Text>
            {lesson.plan ? <Text style={{ fontSize: 12, color: colors.muted }}>Plan: {lesson.plan.topic}</Text> : null}
            {step ? (
                <View style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
                    <Button size="sm" variant={step.action === 'plan' ? 'primary' : 'secondary'} label={step.label} loading={busy} onPress={() => onAction(step.action)} />
                </View>
            ) : null}
        </Card>
    );
}

/** A teacher's lessons for a day, each tied to its scheme of work, lesson plan and record of work. */
export function TeachingDayList({ onChanged }: { onChanged?: () => void }) {
    const { colors } = useTheme();
    const api = useApi();
    const toast = useToast();
    const [day, setDay] = useState(today());
    const [data, setData] = useState<TeachingDay | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        try { setData(await opsGet<TeachingDay>(api, `${URL}?date=${day}`)); }
        catch (err) { toast.error(errorMessage(err, 'Could not load your day')); }
    }, [api, day, toast]);
    useEffect(() => { setData(null); void load(); }, [load]);
    useRefreshSignal(load);

    const act = async (lesson: TeachingDayLesson, action: TeachingDayAction) => {
        setBusy(lesson.lessonId);
        try {
            await api.post(URL, { action, date: day, subject_id: lesson.subject.id, grade_stream_id: lesson.stream.id, scheme_entry_id: lesson.entry?.id ?? null });
            toast.success(action === 'plan' ? 'Lesson plan created from the scheme. Edit it under Lesson plans.' : 'Recorded as taught.');
            await load();
            onChanged?.();
        } catch (err) { toast.error(errorMessage(err, 'Could not save')); }
        finally { setBusy(null); }
    };

    return (
        <View>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.md }}>{TEACHING_DAY_NOTE}</Text>
            <DateField label="Day" value={day} onChange={(v) => v && setDay(v)} />
            <ButtonRow>
                <Button size="sm" variant="secondary" label="‹ Previous day" onPress={() => setDay((d) => addDays(d, -1))} />
                <Button size="sm" variant="secondary" label="Today" onPress={() => setDay(today())} />
                <Button size="sm" variant="secondary" label="Next day ›" onPress={() => setDay((d) => addDays(d, 1))} />
            </ButtonRow>
            <View style={{ marginTop: spacing.md }}>
                {!data ? <LoadingView />
                    : !data.published ? <EmptyState title="Your lessons appear here once the school publishes a timetable." />
                        : data.lessons.length === 0 ? <EmptyState title={`No lessons on ${fmtDate(day)}.`} />
                            : data.lessons.map((l) => <LessonCard key={l.lessonId} lesson={l} busy={busy === l.lessonId} onAction={(a) => void act(l, a)} />)}
            </View>
        </View>
    );
}
