import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { errorMessage, pluralize } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Button, ButtonRow, Card, ErrorBanner } from '@/components/ui';
import { StatusBadge } from './ExamPicker';
import type { ExamSlot, PublishReadiness, PublishResponse } from '@/lib/types';

/**
 * Release / withdraw results, as on the web. Releasing is two calls: the
 * first returns who is unmarked or missing papers, and nothing is released
 * until the teacher confirms having seen that.
 */
export function ReleaseControl({ exam, onChanged, compact }: { exam: ExamSlot; onChanged: (status: ExamSlot['status']) => void; compact?: boolean }) {
    const api = useApi();
    const [readiness, setReadiness] = useState<PublishReadiness | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const released = exam.status === 'APPROVED';

    const call = async (body: { action: 'publish' | 'unpublish'; confirm?: boolean }) => {
        setBusy(true);
        setError(null);
        try {
            const res = await api.post<PublishResponse>(`/api/school/exams/${exam.id}/status`, body);
            if ('requiresConfirmation' in res) {
                setReadiness(res.readiness);
            } else {
                setReadiness(null);
                onChanged(body.action === 'publish' ? 'APPROVED' : 'DRAFT');
            }
        } catch (err) {
            setError(errorMessage(err, 'Could not update the results'));
        } finally {
            setBusy(false);
        }
    };

    const withdraw = () =>
        Alert.alert('Withdraw results?', 'Students and parents will stop seeing these marks until they are released again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Withdraw', style: 'destructive', onPress: () => void call({ action: 'unpublish' }) },
        ]);

    return (
        <View>
            {error ? <ErrorBanner message={error} /> : null}
            {readiness ? (
                <Card style={{ marginBottom: spacing.md, borderColor: readiness.hasIssues ? colors.warning : colors.success }}>
                    <Text style={styles.title}>Ready to release {exam.subject_name}?</Text>
                    <Text style={styles.sub}>
                        {readiness.fullyMarkedCount} of {pluralize(readiness.rosterCount, 'learner')} fully marked
                    </Text>
                    {readiness.unmarked.length > 0 ? (
                        <Text style={styles.warn}>
                            No marks ({readiness.unmarked.length}, left out): {readiness.unmarked.slice(0, 8).map((s) => s.name).join(', ')}
                            {readiness.unmarked.length > 8 ? '…' : ''}
                        </Text>
                    ) : null}
                    {readiness.partiallyMarked.length > 0 ? (
                        <Text style={styles.warn}>
                            Missing papers ({readiness.partiallyMarked.length}, scored on what's entered):{' '}
                            {readiness.partiallyMarked.slice(0, 6).map((s) => `${s.name} (${(s.missing ?? []).join(', ')})`).join('; ')}
                        </Text>
                    ) : null}
                    <ButtonRow>
                        <Button variant="secondary" label="Not yet" onPress={() => setReadiness(null)} />
                        <Button label="Release results" onPress={() => void call({ action: 'publish', confirm: true })} loading={busy} />
                    </ButtonRow>
                </Card>
            ) : (
                <View style={[styles.bar, compact && { marginBottom: 0 }]}>
                    <StatusBadge status={exam.status} />
                    <Text style={[styles.sub, { flex: 1 }]} numberOfLines={2}>
                        {released ? `Released${exam.published_by_name ? ` by ${exam.published_by_name}` : ''}` : 'Not visible to students yet'}
                    </Text>
                    {released ? (
                        <Button size="sm" variant="secondary" label="Withdraw" onPress={withdraw} loading={busy} />
                    ) : (
                        <Button size="sm" label="Release" onPress={() => void call({ action: 'publish' })} loading={busy} />
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 15, fontWeight: '800', color: colors.foreground },
    sub: { fontSize: 12, color: colors.muted },
    warn: { fontSize: 12, color: colors.warning, marginTop: spacing.sm },
    bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
});
