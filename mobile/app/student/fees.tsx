import { useDownload } from '@/lib/useDownload';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, formatCurrency, formatDate, isOverdue } from '@/lib/format';
import { spacing, fonts, makeStyles, useTheme } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, EmptyState, ErrorBanner, InfoRow, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SectionLabel, StatGrid, StatTile,
} from '@/components/ui';
import { PAYMENT_STATUS_VARIANT } from '@/components/fees/FeeDetail';
import { PayPanel } from '@/components/fees/PayPanel';
import type { FeePayment, FeeRecord, FeeStatus, PaymentSettingsStatus } from '@/lib/types';
import { totalOwed } from '@shared/fees';

const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    PARTIAL: { label: 'Partial', variant: 'info' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERPAID: { label: 'Overpaid', variant: 'info' },
};

export default function StudentFeesScreen() {
    const { colors } = useTheme();
    const styles = useStyles();
    const { data, loading, error, refresh, refreshing } = useApiQuery<FeeRecord[]>('/api/school/fees');
    const settings = useApiQuery<PaymentSettingsStatus>('/api/school/payment-settings/status');
    const [open, setOpen] = useState<string | null>(null);
    const [paying, setPaying] = useState<FeeRecord | null>(null);

    const fees = data ?? [];
    // Until the fees have loaded the totals are unknown, not zero: "KES 0 · All
    // settled" told learners who owe that they owed nothing.
    const known = data != null;
    const amount = (n: number) => (known ? formatCurrency(n) : '—');
    const billed = fees.reduce((s, f) => s + f.totalFee, 0);
    const paid = fees.reduce((s, f) => s + f.paidAmount, 0);
    const balance = totalOwed(fees);
    const overdue = fees.filter((f) => isOverdue(f.dueDate, f.balance)).length;
    const provider = settings.data?.provider ?? 'NONE';

    return (
        <Screen onRefresh={() => { refresh(); settings.refresh(); }} refreshing={refreshing}>
            <ScreenHeader title="Fees" description="Your balance, payment history and ways to pay." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            <StatGrid>
                <StatTile label="Total billed" value={amount(billed)} />
                <StatTile label="Total paid" value={amount(paid)} tone={known ? colors.success : undefined} />
                <StatTile label="Balance" value={amount(balance)} tone={!known ? undefined : balance > 0 ? colors.danger : colors.success} sub={!known ? (loading ? 'Loading…' : 'Not loaded') : balance > 0 ? 'Outstanding' : 'All settled'} />
                <StatTile label="Overdue" value={known ? overdue : '—'} tone={known && overdue > 0 ? colors.danger : undefined} />
            </StatGrid>

            <SectionLabel>Fee records</SectionLabel>
            {loading ? (
                <LoadingView />
            ) : !known ? null : fees.length === 0 ? (
                <EmptyState title="No fee records yet" description="Your school hasn't billed any fees to your account yet." />
            ) : (
                <ListCard>
                    {fees.map((f) => (
                        <View key={f.id}>
                            <ListRow
                                title={f.termName ?? '—'}
                                subtitle={`Billed ${formatCurrency(f.totalFee)} · Paid ${formatCurrency(f.paidAmount)}${f.dueDate ? ` · due ${formatDate(f.dueDate)}` : ''} · tap for receipts`}
                                meta={f.balance > 0 ? `Balance ${formatCurrency(f.balance)}` : 'Paid in full'}
                                right={isOverdue(f.dueDate, f.balance) ? <Badge label="Overdue" variant="danger" /> : <Badge label={STATUS_META[f.status]?.label ?? f.status} variant={STATUS_META[f.status]?.variant ?? 'warning'} />}
                                onPress={() => setOpen(open === f.id ? null : f.id)}
                            />
                            {/* The payment form opens under the term being paid, not at the
                                top of the page above where the learner tapped. */}
                            {paying?.id === f.id ? (
                                <PayPanel
                                    // A fresh panel per fee: the amount, state and any poll belonged to the first fee opened.
                                    key={paying.id}
                                    fee={paying}
                                    provider={provider}
                                    onClose={() => setPaying(null)}
                                    onPaid={() => {
                                        refresh();
                                    }}
                                />
                            ) : open === f.id ? (
                                <FeeHistory fee={f} canPay={provider !== 'NONE' && f.balance > 0} onPay={() => setPaying(f)} />
                            ) : provider !== 'NONE' && f.balance > 0 ? (
                                // Paying used to hide behind an unmarked tap on the row.
                                <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
                                    <Button size="sm" label={`Pay ${formatCurrency(f.balance)}`} onPress={() => setPaying(f)} />
                                </View>
                            ) : null}
                        </View>
                    ))}
                </ListCard>
            )}

            {(settings.data?.bankAccounts ?? []).length > 0 ? (
                <>
                    <SectionLabel>Pay by bank</SectionLabel>
                    {(settings.data?.bankAccounts ?? []).map((a) => (
                        <Card key={a.id} style={{ marginBottom: spacing.sm }}>
                            <InfoRow label="Bank" value={a.bankName} />
                            <InfoRow label="Account name" value={a.accountName} />
                            <InfoRow label="Account number" value={a.accountNumber} />
                            {a.branch ? <InfoRow label="Branch" value={a.branch} /> : null}
                            <Text selectable style={styles.hint}>Use your admission number as the reference.</Text>
                        </Card>
                    ))}
                </>
            ) : null}
        </Screen>
    );
}

function FeeHistory({ fee, canPay, onPay }: { fee: FeeRecord; canPay: boolean; onPay: () => void }) {
    const download = useDownload();
    const { colors } = useTheme();
    const styles = useStyles();
    const { data, loading, error, reload } = useApiQuery<FeePayment[]>(`/api/school/fees/${fee.id}/payments`);
    const [busy, setBusy] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const receipt = async (p: FeePayment) => {
        setBusy(p.id);
        setDownloadError(null);
        try {
            await download(`/api/school/fees/payments/${p.id}/receipt`, `Receipt_${p.receiptNumber}.pdf`);
        } catch (err) {
            setDownloadError(errorMessage(err, 'Download failed'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <View style={{ padding: spacing.md, backgroundColor: colors.mutedBg }}>
            {canPay ? (
                <ButtonRow>
                    <Button label={`Pay ${formatCurrency(fee.balance)}`} onPress={onPay} />
                </ButtonRow>
            ) : null}
            {downloadError ? <Notice tone="danger" message={downloadError} onDismiss={() => setDownloadError(null)} /> : null}
            {error ? <ErrorBanner message={error} onRetry={reload} /> : null}
            {loading ? (
                <LoadingView />
            ) : (data ?? []).length === 0 ? (
                <Text style={styles.hint}>No payments recorded yet.</Text>
            ) : (
                (data ?? []).map((p) => (
                    <ListRow
                        key={p.id}
                        title={`${formatCurrency(p.amount)} · ${p.method}`}
                        subtitle={`${formatDate(p.paidAt)} · ${p.mpesaReceiptNumber ?? p.receiptNumber}`}
                        right={
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <Badge label={p.status} variant={PAYMENT_STATUS_VARIANT[p.status]} />
                                {p.status === 'COMPLETED' ? <Button size="sm" variant="ghost" label="Receipt" onPress={() => void receipt(p)} loading={busy === p.id} /> : null}
                            </View>
                        }
                    />
                ))
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    title: { fontSize: 15, fontFamily: fonts.display, color: colors.foreground },
    hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.sm },
}));
