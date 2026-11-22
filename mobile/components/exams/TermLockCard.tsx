import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Lock, LockOpen } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { errorMessage, formatDate } from '@/lib/format';
import { confirmAlert } from '@/lib/confirm';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { Button, Notice } from '@/components/ui';
import type { TermLock } from '@shared/exam-windows';

/**
 * The web's term lock, for whoever opens exams: lock a finished term's marks
 * so nobody changes one by mistake once report cards are out; unlock it for
 * a correction. Everyone else sees that the term is locked.
 */
export function TermLockCard({ termId, termName, lock, canLock, onChange }: { termId: string; termName: string; lock: TermLock | null; canLock: boolean; onChange: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (!canLock) {
        return lock ? <Notice tone="info" message={`${termName} marks are locked. You can view them; ask the admin or DOS to unlock the term to change one.`} /> : null;
    }

    const save = async (locked: boolean) => {
        setBusy(true);
        setError('');
        try {
            await api.put('/api/school/exam-windows/lock', { termId, locked });
            onChange();
        } catch (err) {
            setError(errorMessage(err, 'Could not save'));
        } finally {
            setBusy(false);
        }
    };
    const toggle = () => {
        const locking = !lock;
        confirmAlert(
            locking ? `Lock ${termName} marks?` : `Unlock ${termName} marks?`,
            locking ? 'Nobody can enter, change or remove a mark in this term until it is unlocked. Releasing results still works.' : 'Teachers can change this term’s marks again. Lock it once the correction is done.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: locking ? 'Lock term' : 'Unlock', style: locking ? 'destructive' : 'default', onPress: () => void save(locking) },
            ],
        );
    };

    const Icon = lock ? Lock : LockOpen;
    return (
        <View style={[styles.box, lock && { backgroundColor: colors.mutedBg }]}>
            <View style={styles.head}>
                <View style={styles.icon}><Icon size={18} color={colors.muted} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>{lock ? `${termName} marks are locked` : `Lock ${termName} marks when it’s finished`}</Text>
                    <Text style={styles.sub}>
                        {lock
                            ? `Locked${lock.lockedBy ? ` by ${lock.lockedBy}` : ''} on ${formatDate(lock.lockedAt)}. Unlock it to correct a mark.`
                            : 'Once report cards are out, lock the term so nobody changes a mark by mistake.'}
                    </Text>
                </View>
            </View>
            {error ? <Notice tone="danger" message={error} /> : null}
            <Button size="sm" variant={lock ? 'secondary' : 'primary'} label={lock ? 'Unlock term' : 'Lock term'} onPress={toggle} loading={busy} block />
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.card, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
}));
