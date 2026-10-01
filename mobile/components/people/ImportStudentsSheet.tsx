import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseTabularData } from '@shared/import/parse-tabular-file';
import { namedRows, toImportRow, type CreatedCredential, type ImportResponse, type ImportRow } from '@shared/import/student-rows';
import { Button, Card, ChipSelect, Notice, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { SelectField } from '@/components/ops/SelectField';
import { useApi } from '@/lib/api';
import { TABULAR_TYPES, readPicked } from '@/lib/files';
import { errorMessage } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';

interface Stream { id: string; full_name: string }

const GENDERS = [{ value: '', label: '—' }, { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }] as const;

/**
 * Import a class list from a CSV or Excel file — the web's import dialog:
 * the same column matching, a chance to fix names, and skipped rows kept
 * with the reason so they can be corrected and retried.
 */
export function ImportStudentsSheet({ streams, defaultClassId, onClose, onImported }: {
    streams: readonly Stream[];
    defaultClassId: string;
    onClose: () => void;
    onImported: (created: CreatedCredential[]) => void;
}) {
    const api = useApi();
    const toast = useToast();
    const [classId, setClassId] = useState(streams.length === 1 ? streams[0].id : defaultClassId);
    const [levelId, setLevelId] = useState('');
    const [rows, setRows] = useState<ImportRow[]>([]);
    const [reasons, setReasons] = useState<string[]>([]);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);

    // A school with one curriculum needs no choice; otherwise the server infers it from the class.
    useEffect(() => {
        api.get<{ academic_levels?: { id: string }[] }>('/api/admin/academic-structure')
            .then((s) => { if (s.academic_levels?.length === 1) setLevelId(s.academic_levels[0].id); })
            .catch(() => undefined);
    }, [api]);

    const editRow = (i: number, patch: Partial<ImportRow>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

    const pick = async () => {
        try {
            const picked = await api.pickFile(TABULAR_TYPES);
            if (!picked) return;
            const { rows: raw } = await parseTabularData(picked.name, readPicked(picked));
            const parsed = namedRows(raw.map((r) => toImportRow(r, levelId)));
            if (parsed.length === 0) { toast.error('No student rows found. Check the file has a heading row with a name column.'); return; }
            setRows(parsed);
            setReasons([]);
            setFileName(picked.name);
        } catch {
            toast.error('Could not read that file. Use a CSV or Excel (.xlsx) file.');
        }
    };

    const submit = async () => {
        setImporting(true);
        try {
            const r = await api.post<ImportResponse>('/api/admin/bulk-import-students', { students: rows, default_grade_stream_id: classId || undefined });
            const skipped = r.skipped_rows ?? [];
            onImported(r.created_credentials ?? []);
            if (skipped.length > 0) {
                // Keep only the rows that failed, with why, so they can be fixed and retried.
                toast.show(`Imported ${r.imported ?? 0}, skipped ${skipped.length}`, 'warning');
                setRows(skipped.map((s) => s.row));
                setReasons(skipped.map((s) => s.reason));
            } else {
                toast.success(r.message || 'Students imported');
                onClose();
            }
        } catch (err) {
            toast.error(errorMessage(err, 'Could not import the students.'));
        } finally {
            setImporting(false);
        }
    };

    const skippedCount = reasons.filter(Boolean).length;
    const label = skippedCount > 0 ? `Retry ${rows.length}` : `Import ${rows.length || ''}`.trim();

    return (
        <FormSheet
            visible
            title="Import students"
            onClose={onClose}
            onSubmit={rows.length > 0 && classId ? () => void submit() : undefined}
            submitLabel={label}
            submitting={importing}
        >
            <SelectField label="Class" required hint="Everyone in the file joins this class." value={classId} onChange={setClassId} options={streams.map((s) => ({ id: s.id, label: s.full_name }))} />
            <Card style={{ marginBottom: spacing.md, alignItems: 'center', borderStyle: 'dashed' }}>
                <Text style={styles.title}>{rows.length > 0 ? fileName : 'Choose a CSV or Excel file'}</Text>
                <Text style={styles.muted}>
                    {rows.length > 0 ? `${rows.length} student${rows.length === 1 ? '' : 's'} found · choose another file to replace` : 'Columns: first_name, last_name, admission_number, gender, guardian_name, guardian_phone'}
                </Text>
                <View style={{ marginTop: spacing.sm }}><Button variant="secondary" label={rows.length > 0 ? 'Choose another file' : 'Choose file'} onPress={() => void pick()} /></View>
            </Card>
            {skippedCount > 0 ? <Notice tone="warning" message={`${skippedCount} student${skippedCount === 1 ? '' : 's'} skipped. Fix the rows below and import again.`} /> : null}
            {rows.map((row, i) => (
                <Card key={i} style={[styles.row, reasons[i] ? { borderColor: colors.danger } : null]}>
                    <View style={styles.pair}>
                        <View style={{ flex: 1 }}><TextField label="First name" value={row.first_name} onChangeText={(v) => editRow(i, { first_name: v })} /></View>
                        <View style={{ flex: 1 }}><TextField label="Last name" value={row.last_name} onChangeText={(v) => editRow(i, { last_name: v })} /></View>
                    </View>
                    <TextField label="Adm. no." value={row.admission_number} onChangeText={(v) => editRow(i, { admission_number: v })} placeholder="Optional" />
                    <ChipSelect label="Gender" options={GENDERS} value={row.gender} onChange={(v) => editRow(i, { gender: v })} />
                    {reasons[i] ? <Text style={styles.reason}>{reasons[i]}</Text> : null}
                </Card>
            ))}
        </FormSheet>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 14, fontWeight: '700', color: colors.foreground, textAlign: 'center' },
    muted: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 2 },
    row: { marginBottom: spacing.sm, padding: spacing.md },
    pair: { flexDirection: 'row', gap: spacing.sm },
    reason: { fontSize: 12, color: colors.danger, fontWeight: '600' },
});
