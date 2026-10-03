import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { editRow, firstRow, gradingSystemPayload, nextRowFrom, type DraftRow, type SystemKind } from '@shared/grading/draft';
import { Button, ButtonRow, Card, ChipSelect, ErrorBanner, TextField, ToggleRow } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { useApi } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { colors, spacing, fonts } from '@/lib/theme';
import type { AcademicLevel, GradingSystem, StructureSubject } from '@/lib/types';

const STRUCTURE = '/api/admin/academic-structure';

function SubjectPicker({ subjects, selected, onToggle }: { subjects: readonly StructureSubject[]; selected: readonly string[]; onToggle: (id: string) => void }) {
    if (subjects.length === 0) return <Text style={{ fontSize: 12, color: colors.muted }}>No subjects at this level yet.</Text>;
    return (
        <View>
            {subjects.map((s) => <ToggleRow key={s.id} label={s.name} value={selected.includes(s.id)} onValueChange={() => onToggle(s.id)} />)}
        </View>
    );
}

const toggle = (list: readonly string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Create a grading system band by band — the web's "New grading system" form, with the same checks. */
export function NewGradingSystemSheet({ levels, subjects, onClose, onSaved }: {
    levels: readonly AcademicLevel[];
    subjects: readonly StructureSubject[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const api = useApi();
    const toast = useToast();
    const [kind, setKind] = useState<SystemKind>('SUBJECT');
    const [name, setName] = useState('');
    const [levelId, setLevelId] = useState(levels.length === 1 ? levels[0].id : '');
    const [rows, setRows] = useState<DraftRow[]>([firstRow()]);
    const [subjectIds, setSubjectIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const isOverall = kind === 'OVERALL';

    const save = async () => {
        const built = gradingSystemPayload({ name, academicLevelId: levelId, kind, rows, subjectIds });
        if (!built.ok) { setError(built.error); return; }
        setSaving(true);
        try {
            await api.post(STRUCTURE, { type: 'grading_system', ...built.payload });
            toast.success('Grading system added.');
            onSaved();
        } catch (err) {
            setError(errorMessage(err, 'Could not save the grading system'));
        } finally {
            setSaving(false);
        }
    };

    const set = (i: number, field: keyof DraftRow) => (v: string) => setRows((prev) => prev.map((r, j) => (j === i ? editRow(r, field, v) : r)));

    return (
        <FormSheet visible title="New grading system" onClose={onClose} onSubmit={() => void save()} submitting={saving}>
            {error ? <ErrorBanner message={error} /> : null}
            <ChipSelect label="System type" options={[{ value: 'SUBJECT', label: 'Subject (mark %)' }, { value: 'OVERALL', label: 'Overall (total points)' }]} value={kind} onChange={setKind} />
            <TextField label="Name *" value={name} onChangeText={setName} placeholder={isOverall ? 'e.g. KCSE overall' : 'e.g. Sciences 2026'} />
            <ChipSelect label="Academic level *" wrap options={levels.map((l) => ({ value: l.id, label: l.name }))} value={levelId || null} onChange={(v) => { setLevelId(v); setSubjectIds([]); }} />

            <Text style={{ fontFamily: fonts.bold, color: colors.foreground, marginVertical: spacing.sm }}>Grades ({isOverall ? 'points' : '%'} ranges)</Text>
            {rows.map((r, i) => (
                <Card key={i} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <View style={{ flex: 1 }}><TextField label="Grade" value={r.symbol} onChangeText={set(i, 'symbol')} autoCapitalize="characters" /></View>
                        <View style={{ flex: 2 }}><TextField label="Label" value={r.label} onChangeText={set(i, 'label')} placeholder="Optional" /></View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <View style={{ flex: 1 }}><TextField label="Low" value={r.min_percentage} onChangeText={set(i, 'min_percentage')} keyboardType="decimal-pad" /></View>
                        <View style={{ flex: 1 }}><TextField label="High" value={r.max_percentage} onChangeText={set(i, 'max_percentage')} keyboardType="decimal-pad" /></View>
                        {!isOverall ? <View style={{ flex: 1 }}><TextField label="Points" value={r.points} onChangeText={set(i, 'points')} keyboardType="decimal-pad" /></View> : null}
                    </View>
                    {rows.length > 1 ? <ButtonRow><Button size="sm" variant="ghost" label="Remove row" onPress={() => setRows((prev) => prev.filter((_, j) => j !== i))} /></ButtonRow> : null}
                </Card>
            ))}
            <Button size="sm" variant="secondary" label="+ Add grade" onPress={() => setRows((prev) => [...prev, nextRowFrom(prev[prev.length - 1])])} />

            {!isOverall && levelId ? (
                <View style={{ marginTop: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.foreground, marginBottom: spacing.sm }}>Use for these subjects (optional)</Text>
                    <SubjectPicker subjects={subjects.filter((s) => s.academic_level_id === levelId)} selected={subjectIds} onToggle={(id) => setSubjectIds((l) => toggle(l, id))} />
                </View>
            ) : null}
        </FormSheet>
    );
}

/** Which subjects a school's own subject-grading system applies to, and deleting it. */
export function OwnSystemActions({ system, subjects, onChanged }: { system: GradingSystem; subjects: readonly StructureSubject[]; onChanged: () => void }) {
    const api = useApi();
    const toast = useToast();
    const members = subjects.filter((s) => s.grading_system_id === system.id).map((s) => s.id);
    const [editing, setEditing] = useState<string[] | null>(null);
    const [busy, setBusy] = useState(false);

    const saveSubjects = async () => {
        if (!editing) return;
        setBusy(true);
        try {
            await api.patch(STRUCTURE, { type: 'grading_system_subjects', id: system.id, subject_ids: editing });
            toast.success('Saved');
            setEditing(null);
            onChanged();
        } catch (err) { toast.error(errorMessage(err, 'Could not save')); }
        finally { setBusy(false); }
    };

    const remove = () => confirmAlert('Delete this grading system?', system.name, [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void api.del(`${STRUCTURE}?type=grading_system&id=${encodeURIComponent(system.id)}`)
                .then(() => { toast.success('Grading system deleted'); onChanged(); })
                .catch((err: unknown) => toast.error(errorMessage(err, 'Could not delete — it may still be in use'))),
        },
    ]);

    return (
        <View>
            <ButtonRow>
                {system.system_kind !== 'OVERALL' ? <Button size="sm" variant="secondary" label={editing ? 'Cancel' : `Subjects (${members.length})`} onPress={() => setEditing(editing ? null : members)} /> : null}
                <Button size="sm" variant="ghost" label="Delete" onPress={remove} />
            </ButtonRow>
            {editing ? (
                <View style={{ marginTop: spacing.sm }}>
                    <SubjectPicker subjects={subjects.filter((s) => s.academic_level_id === system.academic_level_id)} selected={editing} onToggle={(id) => setEditing((l) => (l ? toggle(l, id) : l))} />
                    <Button size="sm" label="Save subjects" loading={busy} onPress={() => void saveSubjects()} />
                </View>
            ) : null}
        </View>
    );
}
