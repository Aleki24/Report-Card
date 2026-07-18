import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useApiQuery } from '@/lib/useApiQuery';
import { Card, ErrorBanner, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { StudentProfile } from '@/lib/types';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value || '—'}</Text>
        </View>
    );
}

export default function ProfileScreen() {
    const { signOut } = useAuth();
    const { data: profile, loading, error, refresh, refreshing } = useApiQuery<StudentProfile>('/api/school/student/profile');

    const user = profile?.users;
    const stream = profile?.grade_streams;
    const level = profile?.academic_levels;
    const initials = user ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}` : 'ST';

    if (loading) return <LoadingView />;

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Profile" description="Your academic information." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            <View style={styles.avatarRow}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View>
                    <Text style={styles.name}>
                        {user?.first_name} {user?.last_name}
                    </Text>
                    <Text style={styles.email}>{user?.email ?? '—'}</Text>
                </View>
            </View>

            <Card style={{ marginBottom: spacing.lg }}>
                <InfoRow label="Student ID" value={profile?.admission_number} />
                <InfoRow label="Class & Section" value={stream?.full_name} />
                <InfoRow label="Academic Level" value={level?.name} />
                <InfoRow label="Status" value={profile?.status} />
                <InfoRow label="Phone" value={user?.phone} />
            </Card>

            {(profile?.guardian_name || profile?.guardian_email || profile?.guardian_phone) ? (
                <Card style={{ marginBottom: spacing.lg }}>
                    <Text style={styles.cardTitle}>Guardian</Text>
                    <InfoRow label="Name" value={profile?.guardian_name} />
                    <InfoRow label="Email" value={profile?.guardian_email} />
                    <InfoRow label="Phone" value={profile?.guardian_phone} />
                </Card>
            ) : null}

            <Pressable onPress={() => signOut()} style={styles.signOutButton}>
                <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
    name: { fontSize: 17, fontWeight: '800', color: colors.foreground },
    email: { fontSize: 13, color: colors.muted, marginTop: 2 },
    cardTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground, marginBottom: spacing.sm },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    infoLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
    infoValue: { fontSize: 13, color: colors.foreground, fontWeight: '700' },
    signOutButton: {
        borderWidth: 1,
        borderColor: colors.danger,
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    signOutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
