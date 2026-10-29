import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useApi } from '@/lib/api';
import { errorMessage, formatCurrency } from '@/lib/format';
import { spacing, fonts, makeStyles, useTheme } from '@/lib/theme';
import { Button, ButtonRow, Card, ErrorBanner, Notice, TextField } from '@/components/ui';
import type { PaymentSettingsStatus, PaymentStatusResponse, StkPushResponse } from '@/lib/types';
import { PAYMENT_UNCONFIRMED_MESSAGE, PESAPAL_NOT_CONFIRMED_MESSAGE, paymentWaitStep } from '@shared/fees';

/** The term being paid. */
export interface PayableFee {
    id: string;
    termName: string | null;
    balance: number;
    /** Whose fees, when a parent pays for one of several children. */
    learnerName?: string;
}

type PayState = 'form' | 'sending' | 'waiting' | 'success' | 'failed';

/** Same window as the web: stop waiting for a confirmation after 90 seconds. */
const POLL_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 3_000;

/**
 * Online payment, as on the web: M-Pesa sends a PIN prompt to the phone
 * (Daraja STK push); Pesapal opens its checkout. Either way the app then
 * polls the payment until it completes, fails or times out.
 */
export function PayPanel({ fee, provider, onClose, onPaid }: { fee: PayableFee; provider: PaymentSettingsStatus['provider']; onClose: () => void; onPaid: () => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const [phone, setPhone] = useState('');
    // M-Pesa moves whole shillings: offer the balance rounded up.
    const [amount, setAmount] = useState(String(Math.max(1, Math.ceil(fee.balance))));
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
                const step = paymentWaitStep(res.data.status, provider);
                if (step === 'paid') {
                    if (timer.current) clearInterval(timer.current);
                    setState('success');
                    onPaid();
                } else if (step === 'failed') {
                    if (timer.current) clearInterval(timer.current);
                    setState('failed');
                    setError(res.data.notes ?? 'The payment was not completed.');
                } else if (Date.now() > deadline) {
                    if (timer.current) clearInterval(timer.current);
                    setState('failed');
                    setError(res.data.status === 'FAILED' ? PESAPAL_NOT_CONFIRMED_MESSAGE : PAYMENT_UNCONFIRMED_MESSAGE);
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

    const unconfirmed = state === 'failed' && (error === PAYMENT_UNCONFIRMED_MESSAGE || error === PESAPAL_NOT_CONFIRMED_MESSAGE);

    return (
        <Card style={{ marginVertical: spacing.md, borderColor: colors.primary }}>
            <Text style={styles.title}>Pay {fee.learnerName ? `${fee.learnerName} · ` : ''}{fee.termName ?? 'fees'}</Text>
            <Text style={styles.hint}>Balance {formatCurrency(fee.balance)}</Text>
            {error ? (unconfirmed ? <Notice tone="info" message={error} /> : <ErrorBanner message={error} />) : null}
            {state === 'success' ? (
                <Notice message="Payment received — thank you. The balance updates in a moment." />
            ) : state === 'waiting' ? (
                <Notice tone="info" message={provider === 'PESAPAL' ? 'Complete the payment in the checkout page. Waiting for confirmation…' : 'Check your phone and enter your M-Pesa PIN. Waiting for confirmation…'} />
            ) : (
                <>
                    <TextField label={provider === 'PESAPAL' ? 'Phone (optional)' : 'M-Pesa phone number'} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712345678" />
                    <TextField label="Amount (KES)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                </>
            )}
            {unconfirmed ? (
                // The money may still arrive: lead with checking, so a second
                // M-Pesa prompt is not one tap away from someone who already paid.
                <ButtonRow>
                    <Button variant="secondary" label="Pay again" onPress={() => void pay()} />
                    <Button label="Check the balance" onPress={() => { onPaid(); onClose(); }} />
                </ButtonRow>
            ) : (
                <ButtonRow>
                    <Button variant="secondary" label={state === 'success' ? 'Done' : 'Close'} onPress={onClose} />
                    {state === 'form' || state === 'sending' || state === 'failed' ? (
                        <Button label={state === 'failed' ? 'Try again' : provider === 'PESAPAL' ? 'Continue to Pesapal' : 'Send M-Pesa prompt'} onPress={() => void pay()} loading={state === 'sending'} />
                    ) : null}
                </ButtonRow>
            )}
        </Card>
    );
}

const useStyles = makeStyles((colors) => ({
    title: { fontSize: 15, fontFamily: fonts.display, color: colors.foreground },
    hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.sm },
}));
