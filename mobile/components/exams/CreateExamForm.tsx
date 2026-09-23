import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/UserContext';
import { examTypeLabel } from '@/lib/academics';
import { errorMessage, toISODate } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Button, ButtonRow, Card, ChipSelect, ErrorBanner, Notice, TextField } from '@/components/ui';
import type { AcademicStructure, Term } from '@/lib/types';

const CREATABLE_TYPES = ['CAT', 'TOPICAL', 'OPENER', 'MIDTERM', 'ENDTERM', 'ZONE', 'SUB_COUNTY', 'COUNTY', 'PRE_MOCK', 'MOCK', 'POST_MOCK'] as const;
const WHOLE_GRADE = '__grade__';

/** Admin-only: add a single exam slot (a CAT, a county paper…), as the web's Create Exam dialog does. */
export function CreateExamToggle({ term, structure, onCreated }: { term: Term; structure: AcademicStructure | null; onCreated: () => void }) {
    const { role } = useCurrentUser();
    const [open, setOpen] = useState(false);
    const [done, setDone] = useState<string | null>(null);
    if (role !== 'ADMIN') return null;
    if (!open) {
        return (
            <>
                {done ? <Notice message={done} onDismiss={() => setDone(null)} /> : null}
                <ButtonRow>
                    <Button size="sm" variant="secondary" label="+ New exam" onPress={() => setOpen(true)} />
                </ButtonRow>
            </>
        );
    }
    return (
        <CreateExamForm
            term={term}
            structure={structure}
            onCancel={() => setOpen(false)}
            onCreated={(name) => {
                setOpen(false);
                setDone(`Created “${name}”.`);
                onCreated();
            }}
        />
    );
}

function CreateExamForm({ term, structure, onCancel, onCreated }: { term: Term; structure: AcademicStructure | null; onCancel: () => void; onCreated: (name: string) => void }) {
    const api = useApi();
    const [examType, setExamType] = useState<string>('CAT');
    const [gradeId, setGradeId] = useState<string | null>(null);
    const [streamId, setStreamId] = useState<string>(WHOLE_GRADE);
    const [subjectId, setSubjectId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [maxScore, setMaxScore] = useState('100');
    const [date, setDate] = useState(toISODate());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const streams = structure?.grade_streams ?? [];
    // Only grades the school actually runs a class in.
    const grades = useMemo(() => {
        const withStreams = new Set(streams.map((s) => s.grade_id));
        return (structure?.grades ?? []).filter((g) => withStreams.has(g.id));
    }, [structure, streams]);
    const grade = grades.find((g) => g.id === gradeId) ?? null;
    const gradeStreams = streams.filter((s) => s.grade_id === gradeId);
    const subjects = (structure?.subjects ?? []).filter((s) => !grade || s.academic_level_id === grade.academic_level_id);
    const subject = subjects.find((s) => s.id === subjectId) ?? null;

    const submit = async () => {
        if (!gradeId || !subjectId) {
            setError('Choose a class and a subject.');
            return;
        }
        const max = Number(maxScore);
        if (!Number.isFinite(max) || max <= 0) {
            setError('Max score must be greater than 0.');
            return;
        }
        const examName = name.trim() || `${examTypeLabel(examType).replace(/^\S+\s/, '')} — ${subject?.name ?? ''}`.trim();
        setSaving(true);
        setError(null);
        try {
            await api.post('/api/school/exams', {
                name: examName,
                exam_type: examType,
                subject_id: subjectId,
                academic_year_id: term.academic_year_id,
                term_id: term.id,
                grade_id: gradeId,
                grade_stream_id: streamId === WHOLE_GRADE ? null : streamId,
                max_score: max,
                exam_date: date,
            });
            onCreated(examName);
        } catch (err) {
            setError(errorMessage(err, 'Could not create the exam'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.foreground, marginBottom: spacing.md }}>New exam · {term.name}</Text>
            {error ? <ErrorBanner message={error} /> : null}
            <ChipSelect label="Type" options={CREATABLE_TYPES.map((t) => ({ value: t, label: examTypeLabel(t) }))} value={examType} onChange={setExamType} />
            <ChipSelect label="Grade" options={grades.map((g) => ({ value: g.id, label: g.name_display }))} value={gradeId} onChange={(g) => { setGradeId(g); setStreamId(WHOLE_GRADE); setSubjectId(null); }} />
            {gradeStreams.length > 1 ? (
                <ChipSelect
                    label="Stream"
                    options={[{ value: WHOLE_GRADE, label: 'Whole grade' }, ...gradeStreams.map((s) => ({ value: s.id, label: s.full_name }))]}
                    value={streamId}
                    onChange={setStreamId}
                />
            ) : null}
            {gradeId ? <ChipSelect label="Subject" wrap options={subjects.map((s) => ({ value: s.id, label: s.name }))} value={subjectId} onChange={setSubjectId} /> : null}
            <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="e.g. CAT 1" />
            <TextField label="Out of" value={maxScore} onChangeText={setMaxScore} keyboardType="number-pad" />
            <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
            <ButtonRow>
                <Button variant="secondary" label="Cancel" onPress={onCancel} />
                <Button label="Create exam" onPress={submit} loading={saving} />
            </ButtonRow>
        </Card>
    );
}
