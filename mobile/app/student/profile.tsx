import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { errorMessage, formatDate, fullName, initials } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Avatar, Button, ButtonRow, Card, ErrorBanner, InfoRow, LoadingView, Notice, Screen, ScreenHeader, TextField } from '@/components/ui';
import type { StudentProfile } from '@/lib/types';

export default function ProfileScreen() {
    const { signOut } = useAuth();
    const api = useApi();
    const { schoolName } = useCurrentUser();
    const { data: profile, loading, error, refresh, refreshing } = useApiQuery<StudentProfile>('/api/school/student/profile');
    const [phone, setPhone] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    if (loading) return <LoadingView />;
    const user = profile?.users;

    // Phone is the one field a student may change themselves (as on the web).
    const savePhone = async () => {
        if (phone === null) return;
        setSaving(true);
        setMessage(null);
        try {
            await api.patch('/api/school/student/profile', { phone: phone.trim() });
            setPhone(null);
            setMessage({ tone: 'success', text: 'Phone number updated.' });
            refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not update your phone') });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Profile" description="Your academic information." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            <View style={styles.avatarRow}>
                <Avatar label={initials(user)} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{fullName(user)}</Text>
                    <Text style={styles.email}>{user?.email ?? '—'}</Text>
                </View>
            </View>

            <Card style={{ marginBottom: spacing.lg }}>
                <InfoRow label="Admission no." value={profile?.admission_number} />
                <InfoRow label="Class" value={profile?.grade_streams?.full_name} />
                <InfoRow label="Curriculum" value={profile?.academic_levels?.name} />
                <InfoRow label="School" value={schoolName} />
                <InfoRow label="Date of birth" value={profile?.date_of_birth ? formatDate(profile.date_of_birth) : null} />
                <InfoRow label="Status" value={profile?.status} />
                {phone === null ? (
                    <View style={styles.phoneRow}>
                        <View style={{ flex: 1 }}>
                            <InfoRow label="Phone" value={user?.phone} />
                        </View>
                        <Button size="sm" variant="ghost" label="Edit" onPress={() => setPhone(user?.phone ?? '')} />
                    </View>
                ) : (
                    <View style={{ marginTop: spacing.md }}>
                        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                        <ButtonRow>
                            <Button size="sm" variant="secondary" label="Cancel" onPress={() => setPhone(null)} />
                            <Button size="sm" label="Save" onPress={savePhone} loading={saving} />
                        </ButtonRow>
                    </View>
                )}
            </Card>

            {profile?.guardian_name || profile?.guardian_email || profile?.guardian_phone ? (
                <Card style={{ marginBottom: spacing.lg }}>
                    <Text style={styles.cardTitle}>Guardian</Text>
                    <InfoRow label="Name" value={profile?.guardian_name} />
                    <InfoRow label="Email" value={profile?.guardian_email} />
                    <InfoRow label="Phone" value={profile?.guardian_phone} />
                </Card>
            ) : null}

            <Button variant="danger" block label="Sign out" onPress={() => void signOut()} />
        </Screen>
    );
}

const styles = StyleSheet.create({
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
    name: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    email: { fontSize: 13, color: colors.muted, marginTop: 2 },
    cardTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground, marginBottom: spacing.sm },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
