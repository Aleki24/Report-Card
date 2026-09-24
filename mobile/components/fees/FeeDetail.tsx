import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, formatCurrency, formatDate } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import { Badge, Button, ButtonRow, ChipSelect, EmptyState, ErrorBanner, ListRow, LoadingView, Notice, TextField } from '@/components/ui';
import type { FeePayment, FeePaymentMethod, StaffFeeRecord } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';

const METHODS: { value: FeePaymentMethod; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'MPESA', label: 'M-Pesa' },
    { value: 'BANK', label: 'Bank' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'OTHER', label: 'Other' },
];

export const PAYMENT_STATUS_VARIANT = { COMPLETED: 'success', PENDING: 'warning', FAILED: 'danger', CANCELLED: 'default' } as const;

type Panel = 'history' | 'pay' | 'edit';

/** One fee record, expanded: its payments, recording a payment, and editing the bill. */
export function FeeDetail({ fee, onChanged }: { fee: StaffFeeRecord; onChanged: () => void }) {
    const api = useApi();
    const payments = useApiQuery<FeePayment[]>(`/api/school/fees/${fee.id}/payments`);
    const [panel, setPanel] = useState<Panel>(fee.balance > 0 ? 'pay' : 'history');
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    // Record payment
    const [amount, setAmount] = useState(fee.balance > 0 ? String(fee.balance) : '');
    const [method, setMethod] = useState<FeePaymentMethod>('CASH');
    const [payer, setPayer] = useState('');
    const [phone, setPhone] = useState('');
    const [mpesaRef, setMpesaRef] = useState('');
    const [notes, setNotes] = useState('');

    // Edit bill
    const [total, setTotal] = useState(String(fee.totalFee));
    const [dueDate, setDueDate] = useState(fee.dueDate ?? '');
    const [billNotes, setBillNotes] = useState(fee.notes ?? '');

    const act = async (key: string, work: () => Promise<void>, done?: string) => {
        setBusy(key);
        setMessage(null);
        try {
            await work();
            if (done) setMessage({ tone: 'success', text: done });
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Something went wrong') });
        } finally {
            setBusy(null);
        }
    };

    const recordPayment = () => {
        const value = parseFloat(amount);
        if (!amount || Number.isNaN(value) || value <= 0) {
            setMessage({ tone: 'danger', text: 'Enter a valid amount greater than 0.' });
            return;
        }
        void act(
            'pay',
            async () => {
                await api.post(`/api/school/fees/${fee.id}/payments`, {
                    amount: value,
                    method,
                    payer_name: payer.trim() || null,
                    phone_number: phone.trim() || null,
                    mpesa_receipt_number: method === 'MPESA' ? mpesaRef.trim() || null : null,
                    notes: notes.trim() || null,
                });
                setAmount('');
                setMpesaRef('');
                setNotes('');
                setPanel('history');
                payments.refresh();
                onChanged();
            },
            `Recorded ${formatCurrency(value)}.`,
        );
    };

    const voidPayment = (p: FeePayment) =>
        confirmAlert('Void this payment?', `${formatCurrency(p.amount)} · receipt ${p.receiptNumber}. The balance goes back up.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Void',
                style: 'destructive',
                onPress: () =>
                    void act(p.id, async () => {
                        await api.del(`/api/school/fees/${fee.id}/payments/${p.id}`);
                        payments.refresh();
                        onChanged();
                    }, 'Payment voided.'),
            },
        ]);

    const saveBill = () =>
        void act(
            'edit',
            async () => {
                await api.patch(`/api/school/fees/${fee.id}`, { total_fee: parseFloat(total), due_date: dueDate.trim() || null, notes: billNotes.trim() || null });
                onChanged();
                setPanel('history');
            },
            'Fee updated.',
        );

    const deleteBill = () =>
        confirmAlert('Delete this fee record?', `${fee.studentName ?? ''} · ${fee.termName ?? ''}`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void act('delete', async () => { await api.del(`/api/school/fees/${fee.id}`); onChanged(); }) },
        ]);

    const receipt = (p: FeePayment) =>
        void act(`r-${p.id}`, () => api.downloadAndShare(`/api/school/fees/payments/${p.id}/receipt`, `Receipt_${p.receiptNumber}.pdf`));

    return (
        <View style={styles.wrap}>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <ChipSelect
                options={[
                    { value: 'pay', label: 'Record payment' },
                    { value: 'history', label: 'History' },
                    { value: 'edit', label: 'Edit bill' },
                ]}
                value={panel}
                onChange={setPanel}
            />

            {panel === 'pay' ? (
                <>
                    <TextField label="Amount (KES)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                    <ChipSelect label="Method" options={METHODS} value={method} onChange={setMethod} />
                    {method === 'MPESA' ? <TextField label="M-Pesa code" value={mpesaRef} onChangeText={setMpesaRef} autoCapitalize="characters" placeholder="e.g. QGH7XK2LMN" /> : null}
                    <TextField label="Paid by (optional)" value={payer} onChangeText={setPayer} autoCapitalize="words" />
                    <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                    <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} />
                    <ButtonRow>
                        <Button label="Record payment" onPress={recordPayment} loading={busy === 'pay'} />
                    </ButtonRow>
                </>
            ) : null}

            {panel === 'history' ? (
                payments.loading ? (
                    <LoadingView />
                ) : payments.error ? (
                    <ErrorBanner message={payments.error} onRetry={payments.reload} />
                ) : (payments.data ?? []).length === 0 ? (
                    <EmptyState title="No payments yet" />
                ) : (
                    (payments.data ?? []).map((p) => (
                        <ListRow
                            key={p.id}
                            title={`${formatCurrency(p.amount)} · ${p.method}`}
                            subtitle={`${formatDate(p.paidAt)} · ${p.receiptNumber}${p.mpesaReceiptNumber ? ` · ${p.mpesaReceiptNumber}` : ''}${p.payerName ? ` · ${p.payerName}` : ''}`}
                            right={
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Badge label={p.status} variant={PAYMENT_STATUS_VARIANT[p.status]} />
                                    {p.status === 'COMPLETED' ? (
                                        <View style={{ flexDirection: 'row', gap: 4 }}>
                                            <Button size="sm" variant="ghost" label="Receipt" onPress={() => receipt(p)} loading={busy === `r-${p.id}`} />
                                            <Button size="sm" variant="ghost" label="Void" onPress={() => voidPayment(p)} loading={busy === p.id} />
                                        </View>
                                    ) : null}
                                </View>
                            }
                        />
                    ))
                )
            ) : null}

            {panel === 'edit' ? (
                <>
                    <TextField label="Total fee (KES)" value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
                    <TextField label="Due date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} />
                    <TextField label="Notes" value={billNotes} onChangeText={setBillNotes} />
                    <ButtonRow>
                        <Button variant="danger" label="Delete record" onPress={deleteBill} loading={busy === 'delete'} />
                        <Button label="Save" onPress={saveBill} loading={busy === 'edit'} />
                    </ButtonRow>
                </>
            ) : null}
            <Text style={styles.foot}>Paid {formatCurrency(fee.paidAmount)} of {formatCurrency(fee.totalFee)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { padding: spacing.md, backgroundColor: colors.mutedBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    foot: { fontSize: 11, color: colors.muted, marginTop: spacing.sm },
});
