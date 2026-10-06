import React, { useState } from 'react';
import { Text } from 'react-native';
import { useApi, type UploadedFile } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { spacing, fonts, useTheme } from '@/lib/theme';
import { Button, ButtonRow, Card, ErrorBanner, TextField } from '@/components/ui';
import type { Assignment } from '@/lib/types';

/** Hand in an assignment: an answer, a photo or document of the work, or both — as on the web. */
export function SubmitAssignment({ assignment, onDone, onCancel }: { assignment: Assignment; onDone: () => void; onCancel: () => void }) {
    const { colors } = useTheme();
    const api = useApi();
    const [text, setText] = useState('');
    const [file, setFile] = useState<UploadedFile | null>(null);
    const fileUrl = file?.url ?? null;
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const attach = async () => {
        setUploading(true);
        setError(null);
        try {
            const picked = await api.pickAndUploadAttachment();
            if (picked) setFile(picked);
        } catch (err) {
            setError(errorMessage(err, 'Upload failed'));
        } finally {
            setUploading(false);
        }
    };

    const submit = async () => {
        if (!text.trim() && !fileUrl) return setError('Write an answer or attach your work (a photo or a document).');
        setSaving(true);
        setError(null);
        try {
            await api.post('/api/school/submissions', { assignment_id: assignment.id, submission_text: text.trim() || null, file_url: fileUrl });
            onDone();
        } catch (err) {
            setError(errorMessage(err, 'Submission failed. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card style={{ marginVertical: spacing.sm }}>
            <Text style={{ fontSize: 14, fontFamily: fonts.display, color: colors.foreground }}>Submit: {assignment.title}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>{assignment.subjectName}</Text>
            {error ? <ErrorBanner message={error} /> : null}
            <TextField label="Your answer (optional)" value={text} onChangeText={setText} multiline />
            <ButtonRow>
                <Button size="sm" variant="secondary" label={file ? `✓ ${file.name} — replace` : 'Attach your work'} onPress={attach} loading={uploading} />
            </ButtonRow>
            <ButtonRow>
                <Button variant="secondary" label="Cancel" onPress={onCancel} />
                <Button label="Submit" onPress={submit} loading={saving} disabled={uploading} />
            </ButtonRow>
        </Card>
    );
}
