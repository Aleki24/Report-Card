import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Check, X, type LucideIcon } from 'lucide-react-native';
import {
    ACCOUNT_DELETION_ENDPOINT,
    DELETED_DATA,
    DELETE_CONFIRMATION_WORD,
    RETAINED_DATA,
    isDeleteConfirmation,
    type DeleteAccountRequest,
} from '@shared/account-deletion';
import { useApi } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { colors, fonts, spacing } from '@/lib/theme';
import { BackLink, Button, Card, Notice, Screen, ScreenHeader, TextField } from '@/components/ui';

function DataList({ title, items, icon: Icon, tint }: { title: string; items: readonly string[]; icon: LucideIcon; tint: string }) {
    return (
        <Card style={{ marginBottom: spacing.md }}>
            <Text style={styles.cardTitle}>{title}</Text>
            {items.map((item) => (
                <View key={item} style={styles.item}>
                    <Icon size={16} color={tint} style={{ marginTop: 2 }} />
                    <Text style={styles.itemText}>{item}</Text>
                </View>
            ))}
        </Card>
    );
}

/**
 * Self-service account deletion (Google Play requires it in the app). The
 * server refuses a school's only admin; signing out follows a success.
 */
export default function DeleteAccountScreen() {
    const api = useApi();
    const { signOut } = useAuth();
    const [confirm, setConfirm] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function deleteAccount() {
        setDeleting(true);
        setError(null);
        try {
            const body: DeleteAccountRequest = { confirm: DELETE_CONFIRMATION_WORD };
            await api.del(ACCOUNT_DELETION_ENDPOINT, body);
            await signOut();
        } catch (err: unknown) {
            setError(errorMessage(err, 'Could not delete your account. Please try again.'));
            setDeleting(false);
        }
    }

    return (
        <Screen>
            <BackLink />
            <ScreenHeader title="Delete account" description="This permanently removes your Skulbase account. It can’t be undone." />
            <DataList title="Deleted" items={DELETED_DATA} icon={X} tint={colors.danger} />
            <DataList title="Kept by the school" items={RETAINED_DATA} icon={Check} tint={colors.muted} />

            <Card style={styles.confirmCard}>
                <Text style={styles.cardTitle}>Type {DELETE_CONFIRMATION_WORD} to confirm</Text>
                <TextField value={confirm} onChangeText={setConfirm} placeholder={DELETE_CONFIRMATION_WORD} autoCapitalize="characters" />
                {error ? <View style={{ marginTop: spacing.sm }}><Notice tone="danger" message={error} /></View> : null}
                <View style={{ marginTop: spacing.md }}>
                    <Button
                        variant="danger"
                        block
                        label="Delete my account permanently"
                        onPress={() => void deleteAccount()}
                        loading={deleting}
                        disabled={!isDeleteConfirmation(confirm) || deleting}
                    />
                </View>
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({
    cardTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, marginBottom: spacing.sm },
    item: { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
    itemText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular, color: colors.muted },
    confirmCard: { borderColor: '#ffc9c9' },
});
