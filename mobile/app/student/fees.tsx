import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, formatCurrency, formatDate, isOverdue } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, EmptyState, ErrorBanner, InfoRow, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SectionLabel, StatGrid, StatTile, TextField,
} from '@/components/ui';
import { PAYMENT_STATUS_VARIANT } from '@/components/fees/FeeDetail';
import type { FeePayment, FeeRecord, FeeStatus, PaymentSettingsStatus, PaymentStatusResponse, StkPushResponse } from '@/lib/types';

const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    PARTIAL: { label: 'Partial', variant: 'info' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERPAID: { label: 'Overpaid', variant: 'info' },
};

type PayState = 'form' | 'sending' | 'waiting' | 'success' | 'failed';

/** Same window as the web: stop waiting for a confirmation after 90 seconds. */
const POLL_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 3_000;

export default function StudentFeesScreen() {
    const { data, loading, error, refresh, refreshing } = useApiQuery<FeeRecord[]>('/api/school/fees');
    const settings = useApiQuery<PaymentSettingsStatus>('/api/school/payment-settings/status');
    const [open, setOpen] = useState<string | null>(null);
    const [paying, setPaying] = useState<FeeRecord | null>(null);

    const fees = data ?? [];
    const billed = fees.reduce((s, f) => s + f.totalFee, 0);
    const paid = fees.reduce((s, f) => s + f.paidAmount, 0);
    const balance = fees.reduce((s, f) => s + f.balance, 0);
    const overdue = fees.filter((f) => isOverdue(f.dueDate, f.balance)).length;
    const provider = settings.data?.provider ?? 'NONE';

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Fees" description="Your balance, payment history and ways to pay." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

            <StatGrid>
                <StatTile label="Total billed" value={formatCurrency(billed)} />
                <StatTile label="Total paid" value={formatCurrency(paid)} tone={colors.success} />
                <StatTile label="Balance" value={formatCurrency(balance)} tone={balance > 0 ? colors.danger : colors.success} sub={balance > 0 ? 'Outstanding' : 'All settled'} />
                <StatTile label="Overdue" value={overdue} tone={overdue > 0 ? colors.danger : undefined} />
            </StatGrid>

            {paying ? (
                <PayPanel
                    fee={paying}
                    provider={provider}
                    onClose={() => setPaying(null)}
                    onPaid={() => {
                        refresh();
                    }}
                />
            ) : null}

            <SectionLabel>Fee records</SectionLabel>
            {loading ? (
                <LoadingView />
            ) : fees.length === 0 ? (
                <EmptyState title="No fee records yet" description="Your school hasn't billed any fees to your account yet." />
            ) : (
                <ListCard>
                    {fees.map((f) => (
                        <View key={f.id}>
                            <ListRow
                                title={f.termName ?? '—'}
                                subtitle={`Billed ${formatCurrency(f.totalFee)} · Paid ${formatCurrency(f.paidAmount)}${f.dueDate ? ` · due ${formatDate(f.dueDate)}` : ''}`}
                                meta={f.balance > 0 ? `Balance ${formatCurrency(f.balance)}` : 'Paid in full'}
                                right={isOverdue(f.dueDate, f.balance) ? <Badge label="Overdue" variant="danger" /> : <Badge label={STATUS_META[f.status]?.label ?? f.status} variant={STATUS_META[f.status]?.variant ?? 'warning'} />}
                                onPress={() => setOpen(open === f.id ? null : f.id)}
                            />
                            {open === f.id ? (
                                <FeeHistory fee={f} canPay={provider !== 'NONE' && f.balance > 0} onPay={() => setPaying(f)} />
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
    const api = useApi();
    const { data, loading, error, reload } = useApiQuery<FeePayment[]>(`/api/school/fees/${fee.id}/payments`);
    const [busy, setBusy] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const receipt = async (p: FeePayment) => {
        setBusy(p.id);
        setDownloadError(null);
        try {
            await api.downloadAndShare(`/api/school/fees/payments/${p.id}/receipt`, `Receipt_${p.receiptNumber}.pdf`);
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

/**
 * Online payment, as on the web: M-Pesa sends a PIN prompt to the phone
 * (Daraja STK push); Pesapal opens its checkout. Either way the app then
 * polls the payment until it completes, fails or times out.
 */
function PayPanel({ fee, provider, onClose, onPaid }: { fee: FeeRecord; provider: PaymentSettingsStatus['provider']; onClose: () => void; onPaid: () => void }) {
    const api = useApi();
    const [phone, setPhone] = useState('');
    const [amount, setAmount] = useState(String(fee.balance));
    const [state, setState] = useState<PayState>('form');
    const [error, setError] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearInterval(timer.current);
    }, []);

    const poll = (statusPath: string) => {
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        timer.current = setInterval(async () => {
            try {
                const res = await api.get<{ data: PaymentStatusResponse }>(statusPath);
                if (res.data.status === 'COMPLETED') {
                    if (timer.current) clearInterval(timer.current);
                    setState('success');
                    onPaid();
                } else if (res.data.status === 'FAILED' || res.data.status === 'CANCELLED') {
                    if (timer.current) clearInterval(timer.current);
                    setState('failed');
                    setError(res.data.notes ?? 'The payment was not completed.');
                } else if (Date.now() > deadline) {
                    if (timer.current) clearInterval(timer.current);
                    setState('failed');
                    setError('Timed out waiting for confirmation. If you completed the payment, it will still be recorded shortly.');
                }
            } catch {
                // A dropped request is not a failed payment; keep polling until the deadline.
            }
        }, POLL_INTERVAL_MS);
    };

    const pay = async () => {
        const value = parseFloat(amount);
        if (provider === 'DARAJA' && !phone.trim()) return setError('Enter the M-Pesa phone number to pay from.');
        if (!amount || Number.isNaN(value) || value <= 0) return setError('Enter a valid amount.');
        setState('sending');
        setError(null);
        try {
            if (provider === 'PESAPAL') {
                const res = await api.post<{ data: { redirectUrl: string; orderTrackingId: string } }>('/api/pesapal/checkout', { student_fee_id: fee.id, amount: value, phone_number: phone.trim() || undefined });
                setState('waiting');
                poll(`/api/pesapal/status?order_tracking_id=${res.data.orderTrackingId}`);
                await WebBrowser.openBrowserAsync(res.data.redirectUrl);
            } else {
                const res = await api.post<{ data: StkPushResponse }>('/api/mpesa/stkpush', { student_fee_id: fee.id, phone_number: phone.trim(), amount: value });
                setState('waiting');
                poll(`/api/mpesa/stkpush/status?checkout_request_id=${res.data.checkoutRequestId}`);
            }
        } catch (err) {
            setState('failed');
            setError(errorMessage(err, 'Could not start the payment.'));
        }
    };

    return (
        <Card style={{ marginVertical: spacing.md, borderColor: colors.primary }}>
            <Text style={styles.title}>Pay {fee.termName ?? 'fees'}</Text>
            <Text style={styles.hint}>Balance {formatCurrency(fee.balance)}</Text>
            {error ? <ErrorBanner message={error} /> : null}
            {state === 'success' ? (
                <Notice message="Payment received — thank you. Your balance has been updated." />
            ) : state === 'waiting' ? (
                <Notice tone="info" message={provider === 'PESAPAL' ? 'Complete the payment in the checkout page. Waiting for confirmation…' : 'Check your phone and enter your M-Pesa PIN. Waiting for confirmation…'} />
            ) : (
                <>
                    <TextField label={provider === 'PESAPAL' ? 'Phone (optional)' : 'M-Pesa phone number'} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712345678" />
                    <TextField label="Amount (KES)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                </>
            )}
            <ButtonRow>
                <Button variant="secondary" label={state === 'success' ? 'Done' : 'Close'} onPress={onClose} />
                {state === 'form' || state === 'sending' || state === 'failed' ? (
                    <Button label={state === 'failed' ? 'Try again' : provider === 'PESAPAL' ? 'Continue to Pesapal' : 'Send M-Pesa prompt'} onPress={() => void pay()} loading={state === 'sending'} />
                ) : null}
            </ButtonRow>
        </Card>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 15, fontWeight: '800', color: colors.foreground },
    hint: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.sm },
});
