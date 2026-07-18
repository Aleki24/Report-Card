import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader, StatTile } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { FeeStatus, StaffFeeRecord } from '@/lib/types';

const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    PARTIAL: { label: 'Partial', variant: 'info' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERPAID: { label: 'Overpaid', variant: 'info' },
};

function formatCurrency(amount: number): string {
    return `KShs ${amount.toLocaleString()}`;
}

export default function StaffFeesScreen() {
    const { data, loading, error, refresh, refreshing } = useApiQuery<StaffFeeRecord[]>('/api/school/fees');
    const fees = data ?? [];
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return fees;
        const q = search.trim().toLowerCase();
        return fees.filter((f) => f.studentName?.toLowerCase().includes(q) || f.admissionNumber?.toLowerCase().includes(q));
    }, [fees, search]);

    const totalBilled = fees.reduce((sum, f) => sum + f.totalFee, 0);
    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalBalance = fees.reduce((sum, f) => sum + f.balance, 0);

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Fees" description="School-wide fee balances." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            <View style={styles.statGrid}>
                <StatTile label="Billed" value={formatCurrency(totalBilled)} />
                <StatTile label="Collected" value={formatCurrency(totalPaid)} />
                <StatTile label="Outstanding" value={formatCurrency(totalBalance)} />
            </View>

            <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by student name or admission no."
                placeholderTextColor={colors.muted}
                style={styles.search}
            />

            {loading ? (
                <LoadingView />
            ) : filtered.length === 0 ? (
                <EmptyState title="No fee records found" />
            ) : (
                <Card style={styles.listCard}>
                    {filtered.map((f) => (
                        <View key={f.id} style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.term}>{f.studentName}</Text>
                                <Text style={styles.detail}>
                                    {f.admissionNumber} · {f.termName ?? '—'}
                                </Text>
                                <Text style={[styles.balance, { color: f.balance > 0 ? colors.danger : colors.success }]}>Balance {formatCurrency(f.balance)}</Text>
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
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    search: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, fontSize: 13, color: colors.foreground, marginBottom: spacing.lg, backgroundColor: colors.card },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
    term: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
    balance: { fontSize: 12, fontWeight: '700', marginTop: 4 },
});
