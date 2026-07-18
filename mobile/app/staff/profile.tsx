import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useCurrentUser } from '@/lib/UserContext';
import { Card, Screen, ScreenHeader } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrator',
    CLASS_TEACHER: 'Class Teacher',
    SUBJECT_TEACHER: 'Subject Teacher',
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value || '—'}</Text>
        </View>
    );
}

export default function StaffProfileScreen() {
    const { signOut } = useAuth();
    const { profile, schoolName } = useCurrentUser();
    const initials = profile ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}` : '—';

    return (
        <Screen>
            <ScreenHeader title="Profile" />

            <View style={styles.avatarRow}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View>
                    <Text style={styles.name}>
                        {profile?.first_name} {profile?.last_name}
                    </Text>
                    <Text style={styles.email}>{profile?.email ?? '—'}</Text>
                </View>
            </View>

            <Card style={{ marginBottom: spacing.lg }}>
                <InfoRow label="Role" value={profile ? ROLE_LABELS[profile.role] ?? profile.role : null} />
                <InfoRow label="School" value={schoolName} />
            </Card>

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
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    infoLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
    infoValue: { fontSize: 13, color: colors.foreground, fontWeight: '700' },
    signOutButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.md },
    signOutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
