import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { SIGNATURES_URL, SIGNATURE_PHOTO_MAX_BYTES, SIGNATURE_TIPS, type SignatureRecord, type SignatureTarget } from '@shared/signatures';
import { Button, ButtonRow, Card, ErrorBanner, LoadingView, Notice, SectionLabel } from '@/components/ui';
import { ApiError, pickPhoto, useApi, withQuery } from '@/lib/api';
import { askConfirm } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { fonts, makeStyles, radius, spacing } from '@/lib/theme';
import { useApiQuery } from '@/lib/useApiQuery';

/**
 * A signature that prints on report cards and mark sheets: shown as it will
 * print, replaced from a photo (the server removes the paper and crops it),
 * or removed. `target` is `me`, `principal` or a staff member's id.
 */
export function SignatureCard({ target, title, description }: { target: SignatureTarget; title: string; description: string }) {
    const styles = useStyles();
    const api = useApi();
    const path = withQuery(SIGNATURES_URL, { target });
    const query = useApiQuery<SignatureRecord>(path);
    // What the last save or removal returned, shown until the next reload.
    const [saved, setSaved] = useState<SignatureRecord | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const record = saved ?? query.data;

    const upload = async (source: 'camera' | 'library') => {
        setMessage(null);
        try {
            const photo = await pickPhoto(source, 'photograph the signature', { crop: true });
            if (!photo) return;
            if ((photo.size ?? 0) > SIGNATURE_PHOTO_MAX_BYTES) throw new ApiError('That photo is too large. Crop it to just the signature and try again.', 400);
            setBusy(true);
            const { data } = await api.sendForm<{ data: SignatureRecord }>('POST', SIGNATURES_URL, { target }, { photo });
            setSaved(data);
            setMessage({ tone: 'success', text: 'Signature saved. It now prints on report cards and mark sheets.' });
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not save the signature.') });
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!(await askConfirm('Remove signature?', 'Report cards and mark sheets will print an empty line to sign by hand.', 'Remove'))) return;
        setBusy(true);
        setMessage(null);
        try {
            const { data } = await api.del<{ data: SignatureRecord }>(path);
            setSaved(data);
            setMessage({ tone: 'success', text: 'Signature removed.' });
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not remove the signature.') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card style={{ marginBottom: spacing.lg }}>
            <SectionLabel>{title}</SectionLabel>
            <Text style={styles.note}>{description}</Text>
            {query.error && !record ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {query.loading && !record ? <LoadingView /> : (
                <View style={styles.preview} accessibilityLabel={record?.image ? `${title}, on file` : `${title}, none yet`}>
                    {record?.image ? (
                        <Image source={{ uri: record.image }} style={styles.image} resizeMode="contain" />
                    ) : (
                        <Text style={styles.empty}>No signature yet: cards print an empty line.</Text>
                    )}
                    <View style={styles.line} />
                    {record?.name ? <Text style={styles.name}>{record.name}</Text> : null}
                </View>
            )}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <ButtonRow>
                <Button size="sm" label={record?.image ? 'Retake photo' : 'Take photo'} onPress={() => void upload('camera')} loading={busy} />
                <Button size="sm" variant="secondary" label="Choose photo" onPress={() => void upload('library')} disabled={busy} />
                {record?.image ? <Button size="sm" variant="ghost" label="Remove" onPress={() => void remove()} disabled={busy} /> : null}
            </ButtonRow>
            <Text style={styles.note}>{SIGNATURE_TIPS}</Text>
        </Card>
    );
}

const useStyles = makeStyles((colors) => ({
    note: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.sm },
    // Always white: the signature is dark ink on a printed page.
    preview: { backgroundColor: '#ffffff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, marginBottom: spacing.sm },
    image: { width: '100%', height: 64 },
    empty: { fontSize: 12, fontFamily: fonts.regular, color: '#6b7280', textAlign: 'center', paddingVertical: spacing.lg },
    line: { height: 1, backgroundColor: '#94a3b8', marginTop: 2 },
    name: { fontSize: 11, fontFamily: fonts.semibold, color: '#475569', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
}));
