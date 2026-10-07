import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, FileUp, Paperclip, X } from 'lucide-react-native';
import { useApi, type UploadedFile } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { Button, ButtonRow, ErrorBanner, TextField } from '@/components/ui';
import type { StudentAssignment } from '@shared/assignments';

/**
 * Hand in an assignment: a typed answer, a photo of the work, a document, or
 * a mix, as on the web. Handing in again replaces the earlier work.
 */
export function SubmitAssignment({ assignment, onDone, onCancel }: { assignment: StudentAssignment; onDone: () => void; onCancel: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const [text, setText] = useState('');
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [uploading, setUploading] = useState<'camera' | 'file' | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const attach = async (source: 'camera' | 'file') => {
        setUploading(source);
        setError(null);
        try {
            const picked = source === 'camera' ? await api.captureAndUploadPhoto() : await api.pickAndUploadAttachment();
            if (picked) setFile(picked);
        } catch (err) {
            setError(errorMessage(err, 'Upload failed'));
        } finally {
            setUploading(null);
        }
    };

    const submit = async () => {
        if (!text.trim() && !file) return setError('Write an answer or attach your work (a photo or a document).');
        setSaving(true);
        setError(null);
        try {
            await api.post('/api/school/submissions', { assignment_id: assignment.id, submission_text: text.trim() || null, file_url: file?.url ?? null });
            onDone();
        } catch (err) {
            setError(errorMessage(err, 'Submission failed. Please try again.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.form}>
            {error ? <ErrorBanner message={error} /> : null}
            {assignment.submission ? <Text style={styles.hint}>Handing in again replaces what you handed in before.</Text> : null}
            <TextField label="Your answer (optional)" value={text} onChangeText={setText} multiline placeholder="Type your answer here" />
            {file ? (
                <View style={styles.attached}>
                    <Paperclip size={16} color={colors.primary} />
                    <Text style={styles.attachedName} numberOfLines={1}>{file.name}</Text>
                    <Pressable onPress={() => setFile(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove attachment">
                        <X size={18} color={colors.muted} />
                    </Pressable>
                </View>
            ) : (
                <View style={styles.sources}>
                    <SourceButton icon={Camera} label="Take a photo" busy={uploading === 'camera'} disabled={uploading !== null} onPress={() => void attach('camera')} />
                    <SourceButton icon={FileUp} label="Choose a file" busy={uploading === 'file'} disabled={uploading !== null} onPress={() => void attach('file')} />
                </View>
            )}
            <Text style={styles.hint}>Photos, PDF, Word, PowerPoint or Excel · up to 10 MB</Text>
            <ButtonRow>
                <Button variant="secondary" label="Cancel" onPress={onCancel} />
                <Button label={assignment.submission ? 'Replace hand-in' : 'Hand in'} onPress={() => void submit()} loading={saving} disabled={uploading !== null} />
            </ButtonRow>
        </View>
    );
}

function SourceButton({ icon: Icon, label, busy, disabled, onPress }: {
    icon: typeof Camera; label: string; busy: boolean; disabled: boolean; onPress: () => void;
}) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [styles.source, (pressed || busy) && { borderColor: colors.primary }, disabled && !busy && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Icon size={20} color={colors.primary} />
            <Text style={styles.sourceLabel}>{busy ? 'Uploading…' : label}</Text>
        </Pressable>
    );
}

const useStyles = makeStyles((colors) => ({
    form: { gap: spacing.sm, marginTop: spacing.sm },
    hint: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted },
    sources: { flexDirection: 'row', gap: spacing.sm },
    source: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.card },
    sourceLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
    attached: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primarySoft },
    attachedName: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.primary },
}));
