import { useDownload } from '@/lib/useDownload';
import { DateField } from '@/components/DateField';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, formatCurrency, formatDate } from '@/lib/format';
import { spacing, fonts, makeStyles } from '@/lib/theme';
import { Badge, Button, ButtonRow, ChipSelect, EmptyState, ErrorBanner, ListRow, LoadingView, Notice, TextField } from '@/components/ui';
import type { FeePayment, FeePaymentMethod, StaffFeeRecord } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';
import { VOID_REASONS, voidReasonProblem } from '@shared/fee-void';
import { PAYMENT_REFERENCE, referenceProblem } from '@shared/fees';
import { paymentShareUrl, type ShareBody, type ShareCandidates } from '@shared/fee-reconcile';
import { useCurrentUser } from '@/lib/UserContext';
import { FollowUps } from './FollowUps';

const METHODS: { value: FeePaymentMethod; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'MPESA', label: 'M-Pesa' },
    { value: 'BANK', label: 'Bank' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'OTHER', label: 'Other' },
];

export const PAYMENT_STATUS_VARIANT = { COMPLETED: 'success', PENDING: 'warning', FAILED: 'danger', CANCELLED: 'default' } as const;

type Panel = 'history' | 'pay' | 'edit' | 'follow';

/** The code a payment is traced by: M-Pesa or Pesapal code, bank slip or cheque number. */
const codeOf = (p: FeePayment) => p.mpesaReceiptNumber ?? p.pesapalConfirmationCode ?? p.reference ?? null;

/** One fee record, expanded: its payments, recording a payment, and editing the bill. */
export function FeeDetail({ fee, onChanged }: { fee: StaffFeeRecord; onChanged: () => void }) {
    // Editing a bill and voiding receipts are fees.manage; collectors record payments.
    const { can } = useCurrentUser();
    const canManage = can('fees.manage');
    const download = useDownload();
    const styles = useStyles();
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
    // The M-Pesa code, bank slip or cheque number.
    const [reference, setReference] = useState('');
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
        const refProblem = referenceProblem(method, reference);
        if (refProblem) {
            setMessage({ tone: 'danger', text: refProblem });
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
                    reference: PAYMENT_REFERENCE[method] ? reference.trim() || null : null,
                    notes: notes.trim() || null,
                });
                setAmount('');
                setReference('');
                setNotes('');
                setPanel('history');
                payments.refresh();
                onChanged();
            },
            `Recorded ${formatCurrency(value)}.`,
        );
    };

    /** The payment being voided, and why: a void needs a reason, kept with who voided it. */
    const [voiding, setVoiding] = useState<{ payment: FeePayment; reason: string } | null>(null);
    const voidPayment = () => {
        if (!voiding || voidReasonProblem(voiding.reason)) return;
        const { payment: p, reason } = voiding;
        void act(p.id, async () => {
            await api.del(`/api/school/fees/${fee.id}/payments/${p.id}`, { reason: reason.trim() });
            setVoiding(null);
            payments.refresh();
            onChanged();
        }, 'Payment voided.');
    };

    /** One payment for two children under one admission number: part of it moves to the other. */
    const [sharing, setSharing] = useState<FeePayment | null>(null);
    const [shareTo, setShareTo] = useState<string | null>(null);
    const [shareAmount, setShareAmount] = useState('');
    const candidates = useApiQuery<ShareCandidates>(sharing ? paymentShareUrl(sharing.id) : null);
    const startShare = (p: FeePayment) => {
        setVoiding(null);
        setSharing(p);
        setShareTo(null);
        setShareAmount(String(Math.round((p.amount / 2) * 100) / 100));
    };
    const share = () => {
        if (!sharing || !shareTo) return;
        const body: ShareBody = { studentId: shareTo, amount: Number(shareAmount) };
        void act(sharing.id, async () => {
            await api.post(paymentShareUrl(sharing.id), body);
            setSharing(null);
            payments.refresh();
            onChanged();
        }, 'Payment shared.');
    };
    const shareValue = Number(shareAmount);
    const shareProblem = sharing && (!(shareValue > 0) || shareValue >= sharing.amount) ? `The share must be more than 0 and less than ${formatCurrency(sharing.amount)}.` : null;

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
        void act(`r-${p.id}`, () => download(`/api/school/fees/payments/${p.id}/receipt`, `Receipt_${p.receiptNumber}.pdf`));

    return (
        <View style={styles.wrap}>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <ChipSelect
                options={[
                    { value: 'pay', label: 'Record payment' },
                    { value: 'history', label: 'History' },
                    ...(fee.studentId && can('fees.view') ? [{ value: 'follow' as const, label: 'Follow-ups' }] : []),
                    ...(canManage ? [{ value: 'edit' as const, label: 'Edit bill' }] : []),
                ]}
                value={panel}
                onChange={setPanel}
            />

            {panel === 'pay' ? (
                <>
                    <TextField label="Amount (KES)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                    <ChipSelect label="Method" options={METHODS} value={method} onChange={setMethod} />
                    {PAYMENT_REFERENCE[method] ? (
                        <TextField
                            label={PAYMENT_REFERENCE[method].label}
                            value={reference}
                            onChangeText={(text) => setReference(text.toUpperCase())}
                            autoCapitalize="characters"
                            placeholder={PAYMENT_REFERENCE[method].placeholder}
                        />
                    ) : null}
                    <TextField label="Paid by (optional)" value={payer} onChangeText={setPayer} autoCapitalize="words" />
                    <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                    <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} />
                    <ButtonRow>
                        <Button label="Record payment" onPress={recordPayment} loading={busy === 'pay'} />
                    </ButtonRow>
                </>
            ) : null}

            {panel === 'history' && voiding ? (
                <Notice
                    tone="danger"
                    message={voiding.payment.splitFromPaymentId
                        ? `Void ${formatCurrency(voiding.payment.amount)} · receipt ${voiding.payment.receiptNumber}? It is one learner's share of a payment: the money goes back to the receipt it was shared from.`
                        : `Void ${formatCurrency(voiding.payment.amount)} · receipt ${voiding.payment.receiptNumber}? The balance goes back up, and any shares of it for other learners are voided with it. The receipt stays on record as voided, with your name and the reason.`}
                />
            ) : null}
            {panel === 'history' && voiding ? (
                <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
                    <ChipSelect label="Reason" wrap options={VOID_REASONS.map((r) => ({ value: r, label: r }))} value={(VOID_REASONS as readonly string[]).includes(voiding.reason) ? voiding.reason : null} onChange={(reason) => setVoiding({ ...voiding, reason })} />
                    <TextField label="Or say why" value={voiding.reason} onChangeText={(reason) => setVoiding({ ...voiding, reason })} placeholder="For example: M-Pesa reversed it" />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setVoiding(null)} />
                        <Button variant="danger" label="Void payment" disabled={!!voidReasonProblem(voiding.reason)} loading={busy === voiding.payment.id} onPress={voidPayment} />
                    </ButtonRow>
                </View>
            ) : null}
            {panel === 'history' && sharing ? (
                <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
                    <Notice tone="info" message={`Share ${formatCurrency(sharing.amount)}${codeOf(sharing) ? ` (${codeOf(sharing)})` : ''} with a brother or sister: they get their own receipt, and this one keeps the rest.`} />
                    {candidates.loading && !candidates.data ? <LoadingView /> : candidates.error && !candidates.data ? <ErrorBanner message={candidates.error} onRetry={candidates.reload} /> : (
                        <ChipSelect
                            label="Who else it was for"
                            layout="picker"
                            placeholder="Pick the learner"
                            options={[
                                ...(candidates.data?.siblings ?? []).map((l) => ({ value: l.id, label: l.name, hint: `${l.className ?? ''} · same parent's phone` })),
                                ...(candidates.data?.learners ?? []).filter((l) => !(candidates.data?.siblings ?? []).some((s) => s.id === l.id)).map((l) => ({ value: l.id, label: l.name, hint: [l.admissionNumber, l.className].filter(Boolean).join(' · ') })),
                            ]}
                            value={shareTo}
                            onChange={setShareTo}
                        />
                    )}
                    <TextField label="Their share (KES)" value={shareAmount} keyboardType="decimal-pad" onChangeText={(text) => setShareAmount(text.replace(/[^0-9.]/g, ''))} error={shareProblem} />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setSharing(null)} />
                        <Button label="Share" disabled={!shareTo || !!shareProblem} loading={busy === sharing.id} onPress={share} />
                    </ButtonRow>
                </View>
            ) : null}
            {panel === 'follow' && fee.studentId ? <FollowUps studentId={fee.studentId} /> : null}
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
                            subtitle={`${formatDate(p.paidAt)} · ${p.receiptNumber}${codeOf(p) ? ` · ${codeOf(p)}` : ''}${p.payerName ? ` · ${p.payerName}` : ''}`}
                            right={
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Badge label={p.status} variant={PAYMENT_STATUS_VARIANT[p.status]} />
                                    {p.status === 'COMPLETED' ? (
                                        <View style={{ flexDirection: 'row', gap: 4 }}>
                                            <Button size="sm" variant="ghost" label="Receipt" onPress={() => receipt(p)} loading={busy === `r-${p.id}`} />
                                            {canManage && !p.splitFromPaymentId ? <Button size="sm" variant="ghost" label="Share" onPress={() => startShare(p)} /> : null}
                                            {canManage ? <Button size="sm" variant="ghost" label="Void" onPress={() => { setSharing(null); setVoiding({ payment: p, reason: '' }); }} loading={busy === p.id} /> : null}
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
                    <DateField label="Due date" value={dueDate} onChange={setDueDate} />
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

const useStyles = makeStyles((colors) => ({
    wrap: { padding: spacing.md, backgroundColor: colors.mutedBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    foot: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: spacing.sm },
}));
