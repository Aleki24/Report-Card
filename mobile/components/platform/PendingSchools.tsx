import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Hourglass } from 'lucide-react-native';
import { PENDING_SCHOOLS_URL, type PendingSchool } from '@shared/pending-schools';
import { useApiQuery } from '@/lib/useApiQuery';
import { fonts, radius, spacing, makeStyles, useTheme } from '@/lib/theme';

/** The platform owner's queue; everyone else gets a 403 and this stays empty. */
export function usePendingSchools(enabled: boolean) {
    return useApiQuery<PendingSchool[]>(enabled ? PENDING_SCHOOLS_URL : null);
}

/**
 * The web's OwnerPendingNotice: while schools wait for approval, the platform
 * owner sees a reminder on the dashboard, so a request is never missed.
 */
export function PendingSchoolsNotice() {
    const { colors } = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const { data } = usePendingSchools(true);
    const schools = data ?? [];
    if (schools.length === 0) return null;
    const n = schools.length;
    return (
        <Pressable
            onPress={() => router.push('/staff/pending-schools')}
            accessibilityRole="link"
            style={({ pressed }) => [styles.notice, pressed && { opacity: 0.85 }]}
        >
            <View style={styles.icon}><Hourglass size={16} color={colors.warning} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>{n} school{n === 1 ? ' is' : 's are'} waiting for your approval</Text>
                <Text style={styles.names} numberOfLines={1}>{schools.map((s) => s.name).join(', ')}</Text>
            </View>
            <Text style={styles.review}>Review</Text>
            <ChevronRight size={16} color={colors.primary} />
        </Pressable>
    );
}

const useStyles = makeStyles((colors) => ({
    notice: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.xxl, borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.08)', padding: spacing.md, marginBottom: spacing.md,
    },
    icon: { width: 36, height: 36, borderRadius: radius.xl, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
    names: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 1 },
    review: { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },
}));
