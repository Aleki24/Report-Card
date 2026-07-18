import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/lib/theme';

export function Screen({
    children,
    onRefresh,
    refreshing,
}: {
    children: React.ReactNode;
    onRefresh?: () => void;
    refreshing?: boolean;
}) {
    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
            >
                {children}
            </ScrollView>
        </SafeAreaView>
    );
}

export function ScreenHeader({ title, description }: { title: string; description?: string }) {
    return (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            {description ? <Text style={styles.headerDesc}>{description}</Text> : null}
        </View>
    );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
    success: { bg: colors.successBg, fg: colors.success },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    warning: { bg: colors.warningBg, fg: colors.warning },
    info: { bg: colors.infoBg, fg: colors.info },
    default: { bg: colors.mutedBg, fg: colors.muted },
};

export function Badge({ label, variant = 'default' }: { label: string; variant?: keyof typeof BADGE_COLORS }) {
    const c = BADGE_COLORS[variant] ?? BADGE_COLORS.default;
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
        </View>
    );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
    return (
        <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{title}</Text>
            {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
        </View>
    );
}

export function LoadingView() {
    return (
        <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{message}</Text>
            {onRetry ? (
                <Text onPress={onRetry} style={styles.errorRetry}>
                    Retry
                </Text>
            ) : null}
        </View>
    );
}

export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <Card style={styles.statTile}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
            {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
        </Card>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    header: { marginBottom: spacing.lg },
    headerTitle: { fontSize: 24, fontWeight: '800', color: colors.foreground },
    headerDesc: { fontSize: 13, color: colors.muted, marginTop: 4 },
    card: {
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
    badgeText: { fontSize: 11, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: spacing.xl * 1.5, paddingHorizontal: spacing.lg },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    emptyDesc: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.dangerBg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.danger,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    errorText: { color: colors.danger, fontSize: 13, flex: 1, marginRight: spacing.sm },
    errorRetry: { color: colors.danger, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
    statTile: { flexBasis: '48%', flexGrow: 1, gap: 2 },
    statLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.foreground },
    statSub: { fontSize: 11, color: colors.muted },
});
