import React, { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { ApiError, useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useAcademicStructure } from '@/lib/useSchoolData';
import { errorMessage, pluralize } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, SectionLabel, SegmentedTabs,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { AcademicStructure, StructureSubject } from '@/lib/types';

/** The standard bands the backend can add in one go (`subjects_bulk`). */
const BANDS = [
    { value: 'CBC_LOWER_PRIMARY', label: 'CBC Lower Primary' },
    { value: 'CBC_UPPER_PRIMARY', label: 'CBC Upper Primary' },
    { value: 'CBC_JUNIOR_SCHOOL', label: 'CBC Junior School' },
    { value: 'CBC_SENIOR_SCHOOL', label: 'CBC Senior School' },
    { value: '844_SECONDARY', label: '8-4-4 Secondary' },
] as const;

type Tone = { tone: 'success' | 'danger'; text: string };

export default function SubjectsScreen() {
    return (
        <RequireScreen screen="subjects">
            <SubjectsContent />
        </RequireScreen>
    );
}

function SubjectsContent() {
    const [tab, setTab] = useState<'offered' | 'teachers'>('offered');
    const structure = useAcademicStructure();
    return (
        <Screen onRefresh={structure.refresh} refreshing={structure.refreshing}>
            <ScreenHeader title="Subjects" description="What your school offers, how each is graded, and who teaches it." />
            <SegmentedTabs
                tabs={[
                    { value: 'offered', label: 'Offered' },
                    { value: 'teachers', label: 'Teachers' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {structure.loading ? (
                <LoadingView />
            ) : structure.error ? (
                <ErrorBanner message={structure.error} onRetry={structure.reload} />
            ) : tab === 'offered' ? (
                <Offered structure={structure.data} onChanged={structure.refresh} />
            ) : (
                <SubjectTeachers structure={structure.data} />
            )}
        </Screen>
    );
}

function Offered({ structure, onChanged }: { structure: AcademicStructure | null; onChanged: () => void }) {
    const api = useApi();
    const [open, setOpen] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<Tone | null>(null);

    const levels = structure?.academic_levels ?? [];
    const systems = (structure?.grading_systems ?? []).filter((s) => s.system_kind !== 'OVERALL');
    const q = search.trim().toLowerCase();
    const subjects = (structure?.subjects ?? []).filter((s) => !q || `${s.name} ${s.code ?? ''}`.toLowerCase().includes(q));
    const ungraded = (structure?.subjects ?? []).filter((s) => !s.grading_system_id).length;

    const act = async (key: string, work: () => Promise<void>, done: string) => {
        setBusy(key);
        setMessage(null);
        try {
            await work();
            setMessage({ tone: 'success', text: done });
            onChanged();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Something went wrong') });
        } finally {
            setBusy(null);
        }
    };

    const setGrading = (s: StructureSubject, systemId: string | null) =>
        act(s.id, () => api.patch('/api/admin/academic-structure', { type: 'subject', id: s.id, grading_system_id: systemId }), `${s.name} grading updated.`);

    const remove = (s: StructureSubject) => {
        const del = (force: boolean) => api.del(withQuery('/api/admin/academic-structure', { type: 'subject', id: s.id, force: force || null }));
        Alert.alert(`Remove ${s.name}?`, 'It comes off your subject list. Existing results are kept.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () =>
                    void act(
                        s.id,
                        async () => {
                            try {
                                await del(false);
                            } catch (err) {
                                // 409: exams exist. The web asks again, then forces; so does this.
                                if (err instanceof ApiError && err.status === 409) await del(true);
                                else throw err;
                            }
                        },
                        `${s.name} removed.`,
                    ),
            },
        ]);
    };

    const addBand = (band: (typeof BANDS)[number]) =>
        act(band.value, () => api.post('/api/admin/academic-structure', { type: 'subjects_bulk', level: band.value }), `Added the standard ${band.label} subjects.`);

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {ungraded > 0 ? <Notice tone="warning" message={`${pluralize(ungraded, 'subject')} ${ungraded === 1 ? 'has' : 'have'} no grading system, so no grade can be awarded. Tap a subject to set one.`} /> : null}

            <Card style={{ marginBottom: spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.foreground }}>Add a curriculum's standard subjects</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Subjects come from the official catalogue with their real codes; ones you already offer are skipped.</Text>
                <ButtonRow>
                    {BANDS.map((b) => (
                        <Button key={b.value} size="sm" variant="secondary" label={`+ ${b.label}`} onPress={() => void addBand(b)} loading={busy === b.value} disabled={!!busy} />
                    ))}
                </ButtonRow>
            </Card>

            <SearchField value={search} onChangeText={setSearch} placeholder="Search subjects" />
            {subjects.length === 0 ? <EmptyState title="No subjects yet" description="Add a curriculum band above." /> : null}
            {levels.map((level) => {
                const inLevel = subjects.filter((s) => s.academic_level_id === level.id);
                if (inLevel.length === 0) return null;
                const levelSystems = systems.filter((g) => g.academic_level_id === level.id || !g.academic_level_id);
                return (
                    <View key={level.id}>
                        <SectionLabel>{level.name} · {inLevel.length}</SectionLabel>
                        <ListCard>
                            {inLevel.map((s) => {
                                const system = systems.find((g) => g.id === s.grading_system_id);
                                return (
                                    <View key={s.id}>
                                        <ListRow
                                            title={s.name}
                                            subtitle={`${s.code ?? '—'} · ${system ? system.name : 'No grading system'}`}
                                            danger={!system}
                                            onPress={() => setOpen(open === s.id ? null : s.id)}
                                        />
                                        {open === s.id ? (
                                            <View style={{ padding: spacing.md, backgroundColor: colors.mutedBg }}>
                                                <ChipSelect
                                                    label="Grading system"
                                                    wrap
                                                    options={levelSystems.map((g) => ({ value: g.id, label: g.name }))}
                                                    value={s.grading_system_id ?? null}
                                                    onChange={(id) => void setGrading(s, id)}
                                                />
                                                <ButtonRow>
                                                    {s.grading_system_id ? <Button size="sm" variant="ghost" label="Clear grading" onPress={() => void setGrading(s, null)} /> : null}
                                                    <Button size="sm" variant="danger" label="Remove subject" onPress={() => remove(s)} loading={busy === s.id} />
                                                </ButtonRow>
                                            </View>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </ListCard>
                    </View>
                );
            })}
        </View>
    );
}

interface SubjectTeacherPayload {
    subjects: { id: string; name: string; code: string | null; teacher_user_id: string | null }[];
    staff: { id: string; name: string }[];
}

const WHOLE_GRADE = '__grade__';

/** Who teaches each subject in a class this year — the web's Subject Teachers tab. */
function SubjectTeachers({ structure }: { structure: AcademicStructure | null }) {
    const api = useApi();
    const streams = structure?.grade_streams ?? [];
    const grades = useMemo(() => {
        const withStreams = new Set(streams.map((s) => s.grade_id));
        return (structure?.grades ?? []).filter((g) => withStreams.has(g.id));
    }, [structure, streams]);
    const [gradeId, setGradeId] = useState<string | null>(null);
    const [streamId, setStreamId] = useState<string>(WHOLE_GRADE);
    const [open, setOpen] = useState<string | null>(null);
    const [message, setMessage] = useState<Tone | null>(null);
    const effectiveGrade = gradeId ?? grades[0]?.id ?? null;
    const gradeStreams = streams.filter((s) => s.grade_id === effectiveGrade);
    const stream = streamId === WHOLE_GRADE ? null : streamId;
    const { data, loading, error, reload } = useApiQuery<SubjectTeacherPayload>(
        effectiveGrade ? withQuery('/api/admin/subject-teachers', { grade_id: effectiveGrade, grade_stream_id: stream }) : null,
        { raw: true },
    );

    const assign = async (subjectId: string, teacherId: string | null) => {
        setMessage(null);
        try {
            await api.patch('/api/admin/subject-teachers', { subject_id: subjectId, grade_id: effectiveGrade, grade_stream_id: stream, teacher_user_id: teacherId });
            setOpen(null);
            reload();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to assign') });
        }
    };

    if (grades.length === 0) return <EmptyState title="No classes yet" description="Add classes first." />;

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <ChipSelect label="Grade" options={grades.map((g) => ({ value: g.id, label: g.name_display }))} value={effectiveGrade} onChange={(g) => { setGradeId(g); setStreamId(WHOLE_GRADE); }} />
            {gradeStreams.length > 1 ? (
                <ChipSelect label="Stream" options={[{ value: WHOLE_GRADE, label: 'Whole grade' }, ...gradeStreams.map((s) => ({ value: s.id, label: s.full_name }))]} value={streamId} onChange={setStreamId} />
            ) : null}
            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
            {loading ? (
                <LoadingView />
            ) : (data?.subjects ?? []).length === 0 ? (
                <EmptyState title="No subjects offered at this grade" />
            ) : (
                <ListCard>
                    {(data?.subjects ?? []).map((s) => {
                        const teacher = data?.staff.find((t) => t.id === s.teacher_user_id);
                        return (
                            <View key={s.id}>
                                <ListRow title={s.name} subtitle={teacher ? teacher.name : 'Unassigned'} danger={!teacher} onPress={() => setOpen(open === s.id ? null : s.id)} />
                                {open === s.id ? (
                                    <View style={{ padding: spacing.md, backgroundColor: colors.mutedBg }}>
                                        <ChipSelect wrap label="Teacher" options={(data?.staff ?? []).map((t) => ({ value: t.id, label: t.name }))} value={s.teacher_user_id} onChange={(id) => void assign(s.id, id)} />
                                        {teacher ? <Button size="sm" variant="ghost" label="Unassign" onPress={() => void assign(s.id, null)} /> : null}
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                </ListCard>
            )}
        </View>
    );
}
