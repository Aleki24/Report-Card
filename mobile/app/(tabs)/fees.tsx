import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader, StatTile } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import type { FeeRecord, FeeStatus } from '@/lib/types';

const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    PARTIAL: { label: 'Partial', variant: 'info' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERPAID: { label: 'Overpaid', variant: 'info' },
};

function formatCurrency(amount: number): string {
    return `KShs ${amount.toLocaleString()}`;
}

export default function FeesScreen() {
    const { data, loading, error, refresh, refreshing } = useApiQuery<FeeRecord[]>('/api/school/fees');
    const fees = data ?? [];

    const totalBilled = fees.reduce((sum, f) => sum + f.totalFee, 0);
    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalBalance = fees.reduce((sum, f) => sum + f.balance, 0);

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Fees" description="Your fee balance and payment history." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            <View style={styles.statGrid}>
                <StatTile label="Total Billed" value={formatCurrency(totalBilled)} />
                <StatTile label="Total Paid" value={formatCurrency(totalPaid)} />
                <StatTile label="Balance" value={formatCurrency(totalBalance)} sub={totalBalance > 0 ? 'Outstanding' : 'All settled'} />
            </View>

            {loading ? (
                <LoadingView />
            ) : fees.length === 0 ? (
                <EmptyState title="No fee records yet" description="Your school hasn't billed any fees to your account yet." />
            ) : (
                <Card style={styles.listCard}>
                    {fees.map((f) => (
                        <View key={f.id} style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.term}>{f.termName ?? '—'}</Text>
                                <Text style={styles.detail}>
                                    Billed {formatCurrency(f.totalFee)} · Paid {formatCurrency(f.paidAmount)}
                                </Text>
                                <Text style={[styles.balance, { color: f.balance > 0 ? colors.danger : colors.success }]}>
                                    Balance {formatCurrency(f.balance)}
                                </Text>
                            </View>
                            <Badge label={STATUS_META[f.status]?.label ?? f.status} variant={STATUS_META[f.status]?.variant ?? 'warning'} />
                        </View>
                    ))}
                </Card>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    listCard: { padding: 0, overflow: 'hidden' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.sm,
    },
    term: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
    balance: { fontSize: 12, fontWeight: '700', marginTop: 4 },
});
