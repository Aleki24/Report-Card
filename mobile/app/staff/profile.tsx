import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { roleLabel, type UserRole } from '@/lib/roles';
import { errorMessage, fullName, initials } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Avatar, Button, Card, ChipSelect, InfoRow, Notice, Screen, ScreenHeader } from '@/components/ui';

interface AvailableRoles {
    roles: UserRole[];
    baseRole: UserRole;
}

export default function StaffProfileScreen() {
    const { signOut } = useAuth();
    const api = useApi();
    const { profile, role, baseRole, schoolName, reload } = useCurrentUser();
    const isTeacher = baseRole === 'CLASS_TEACHER' || baseRole === 'SUBJECT_TEACHER';
    const available = useApiQuery<AvailableRoles>(isTeacher ? '/api/auth/available-roles' : null, { raw: true });
    const [switching, setSwitching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only a subject teacher who also runs a class gets a second view, as on the web.
    const roles = available.data?.roles ?? [];

    const switchTo = async (next: UserRole) => {
        if (next === role) return;
        setSwitching(true);
        setError(null);
        try {
            await api.post('/api/auth/switch-role', { role: next });
            reload();
        } catch (err) {
            setError(errorMessage(err, 'Could not switch view'));
        } finally {
            setSwitching(false);
        }
    };

    return (
        <Screen>
            <ScreenHeader title="Profile" />
            <View style={styles.avatarRow}>
                <Avatar label={initials(profile)} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{fullName(profile)}</Text>
                    <Text style={styles.email}>{profile?.email ?? '—'}</Text>
                </View>
            </View>

            {error ? <Notice tone="danger" message={error} onDismiss={() => setError(null)} /> : null}

            <Card style={{ marginBottom: spacing.lg }}>
                <InfoRow label="Role" value={profile?.job_title ?? roleLabel(baseRole)} />
                {role !== baseRole ? <InfoRow label="Viewing as" value={roleLabel(role)} /> : null}
                <InfoRow label="School" value={schoolName} />
            </Card>

            {roles.length > 1 ? (
                <Card style={{ marginBottom: spacing.lg }}>
                    <ChipSelect label="View the app as" options={roles.map((r) => ({ value: r, label: roleLabel(r) }))} value={role} onChange={(r) => void switchTo(r)} />
                    <Text style={styles.email}>{switching ? 'Switching…' : 'You also run a class, so you can switch to the class-teacher view.'}</Text>
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
});
