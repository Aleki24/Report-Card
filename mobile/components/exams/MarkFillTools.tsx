import React, { useState } from 'react';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { parseTabularData } from '@shared/import/parse-tabular-file';
import { marksFromTable, matchRows, type MatchCandidate, type ScanRow } from '@shared/marks/scan-match';
import { Button, ButtonRow } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useApi } from '@/lib/api';
import { TABULAR_TYPES, readPicked } from '@/lib/files';
import { errorMessage } from '@/lib/format';
import { colors } from '@/lib/theme';

/** A mark read from a sheet or file, matched to a learner. */
export interface FilledMark { studentId: string; score: string; ambiguous: boolean; lowConfidence: boolean }
export interface FillSummary { filled: FilledMark[]; unmatched: string[] }

/*
 * Photos go up as base64 JSON; the host caps request bodies near 4.5 MB, so
 * the photo is compressed hard (the web scales it to 1600px for the same
 * reason). Text on a mark sheet stays readable well below full quality.
 */
const PHOTO_QUALITY = 0.35;

/**
 * Fill marks from a photographed mark sheet (read by the same scan service
 * as the web) or from a CSV/Excel list. Nothing is saved here: matched marks
 * land in the entry list for the teacher to check, then save as usual.
 */
export function MarkFillTools({ maxScore, roster, disabledReason, onFill }: {
    maxScore: number;
    roster: readonly MatchCandidate[];
    /** Set when filling cannot apply (multi-paper exams are entered per paper). */
    disabledReason?: string;
    onFill: (summary: FillSummary) => void;
}) {
    const api = useApi();
    const toast = useToast();
    const [busy, setBusy] = useState<'scan' | 'file' | null>(null);

    const fill = <R extends { student_name: string; admission_number: string | null }>(rows: readonly R[], score: (r: R) => string, low: (r: R) => boolean) => {
        const matched = matchRows(rows, roster);
        onFill({
            filled: matched.filter((r) => r.id && score(r) !== '').map((r) => ({ studentId: r.id, score: score(r), ambiguous: r.ambiguous, lowConfidence: low(r) })),
            unmatched: matched.filter((r) => !r.id).map((r) => r.student_name || r.admission_number || '?'),
        });
    };

    const scan = async (source: 'camera' | 'library') => {
        try {
            const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) { toast.error('Allow access so the mark sheet can be read.'); return; }
            const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: PHOTO_QUALITY, base64: true };
            const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
            const asset = picked.canceled ? null : picked.assets[0];
            if (!asset?.base64) return;
            setBusy('scan');
            const r = await api.post<{ rows?: ScanRow[]; notes?: string }>('/api/school/exam-marks/scan', {
                image: `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`,
                max_score: maxScore,
            });
            fill(r.rows ?? [], (row) => (row.score != null ? String(row.score) : ''), (row) => row.confidence === 'low');
            if (r.notes) toast.show(r.notes, 'info');
        } catch (err) {
            toast.error(errorMessage(err, 'Could not read the photo. Try again.'));
        } finally {
            setBusy(null);
        }
    };

    const fromFile = async () => {
        try {
            const picked = await api.pickFile(TABULAR_TYPES);
            if (!picked) return;
            setBusy('file');
            const { rows } = await parseTabularData(picked.name, readPicked(picked));
            const marks = marksFromTable(rows);
            if (marks.length === 0) { toast.error('No marks found. The file needs a name or admission number column and a score column.'); return; }
            fill(marks, (m) => m.score.trim(), () => false);
        } catch {
            toast.error('Could not read that file. Use a CSV or Excel (.xlsx) file.');
        } finally {
            setBusy(null);
        }
    };

    if (disabledReason) return <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{disabledReason}</Text>;

    return (
        <ButtonRow>
            <Button size="sm" variant="secondary" label={busy === 'scan' ? 'Reading…' : 'Scan sheet'} loading={busy === 'scan'} disabled={busy !== null} onPress={() => void scan('camera')} />
            <Button size="sm" variant="secondary" label="Photo" disabled={busy !== null} onPress={() => void scan('library')} />
            <Button size="sm" variant="secondary" label={busy === 'file' ? 'Reading…' : 'Fill from file'} loading={busy === 'file'} disabled={busy !== null} onPress={() => void fromFile()} />
        </ButtonRow>
    );
}
