"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Receipt } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PAYMENT_UNCONFIRMED_MESSAGE, PESAPAL_NOT_CONFIRMED_MESSAGE, paymentWaitStep, type PaymentProvider } from '@/lib/fees';
import { feeReceiptUrl, formatKsh } from '@/lib/fee-account';
import { normalizeMpesaPhone } from '@/lib/phone';

/** The term being paid. */
export interface PayableFee {
    id: string;
    termName: string | null;
    balance: number;
    /** Whose fees, when a parent pays for one of several children. */
    learnerName?: string;
}

interface PayOnlineDialogProps {
    fee: PayableFee | null;
    provider: PaymentProvider;
    onClose: () => void;
    /** Refresh balances: after a payment lands, or a while after closing mid-wait. */
    onSettled: () => void;
}

type PayState = 'form' | 'sending' | 'waiting' | 'success' | 'failed';

/** How long to wait for M-Pesa / Pesapal to confirm before handing back. */
const CONFIRM_TIMEOUT_MS = 90_000;
const POLL_EVERY_MS = 3_000;

/**
 * Pay a term's fees online: an M-Pesa prompt to the payer's phone, or the
 * school's Pesapal checkout, then waits for the confirmation and offers the
 * receipt. Used by learners and parents alike.
 */
export function PayOnlineDialog({ fee, provider, onClose, onSettled }: PayOnlineDialogProps) {
    const [phone, setPhone] = useState('');
    const [amount, setAmount] = useState('');
    const [state, setState] = useState<PayState>('form');
    const [error, setError] = useState('');
    const [paidPaymentId, setPaidPaymentId] = useState<string | null>(null);
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const pesapalWindow = useRef<Window | null>(null);

    const stopPolling = () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = null;
    };
    useEffect(() => stopPolling, []);

    // A new term to pay starts a fresh form, with the balance (whole shillings) offered.
    const [shownFor, setShownFor] = useState<string | null>(null);
    if (fee && fee.id !== shownFor) {
        setShownFor(fee.id);
        setPhone('');
        setAmount(String(Math.max(1, Math.ceil(fee.balance))));
        setState('form');
        setError('');
        setPaidPaymentId(null);
    }

    const close = () => {
        const wasWaiting = state === 'waiting';
        stopPolling();
        if (pesapalWindow.current && !pesapalWindow.current.closed) pesapalWindow.current.close();
        setShownFor(null);
        onClose();
        // A payment finished on the phone after closing still lands; catch up shortly.
        if (wasWaiting) window.setTimeout(onSettled, 5_000);
    };

    const pollUntilResolved = (statusUrl: string, kind: PaymentProvider) => {
        stopPolling();
        const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
        pollTimer.current = setInterval(async () => {
            try {
                const res = await fetch(statusUrl, { cache: 'no-store' });
                const json: { data?: { status?: string; notes?: string | null; id?: string } } = await res.json();
                const status = json.data?.status;
                const step = paymentWaitStep(status, kind);
                if (step === 'paid') {
                    stopPolling();
                    setPaidPaymentId(json.data?.id ?? null);
                    setState('success');
                    onSettled();
                } else if (step === 'failed') {
                    stopPolling();
                    setState('failed');
                    setError(json.data?.notes || 'The payment was not completed.');
                } else if (Date.now() > deadline) {
                    stopPolling();
                    setState('failed');
                    setError(status === 'FAILED' ? PESAPAL_NOT_CONFIRMED_MESSAGE : PAYMENT_UNCONFIRMED_MESSAGE);
                    onSettled();
                }
            } catch {
                // A network blip: keep polling until the deadline.
            }
        }, POLL_EVERY_MS);
    };

    /** The whole-shilling amount, or null after showing why not. */
    const validAmount = (): number | null => {
        const value = Math.round(Number(amount));
        if (!amount || isNaN(value) || value < 1) {
            setError('Enter an amount of at least KSh 1.');
            return null;
        }
        return value;
    };

    const sendMpesaPrompt = async () => {
        if (!fee) return;
        if (!normalizeMpesaPhone(phone)) {
            setError('Enter the Safaricom number to pay from, like 0712 345 678.');
            return;
        }
        const value = validAmount();
        if (value === null) return;
        setState('sending');
        setError('');
        try {
            const res = await fetch('/api/mpesa/stkpush', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_fee_id: fee.id, phone_number: phone.trim(), amount: value }),
            });
            const json: { data?: { checkoutRequestId: string }; error?: string } = await res.json();
            if (!res.ok || !json.data) {
                setState('failed');
                setError(json.error || 'We couldn’t send the M-Pesa prompt.');
                return;
            }
            setState('waiting');
            pollUntilResolved(`/api/mpesa/stkpush/status?checkout_request_id=${json.data.checkoutRequestId}`, 'DARAJA');
        } catch (err) {
            setState('failed');
            setError(err instanceof Error ? err.message : 'We couldn’t send the M-Pesa prompt.');
        }
    };

    const openPesapal = async () => {
        if (!fee) return;
        if (phone.trim() && !normalizeMpesaPhone(phone)) {
            setError('That phone number doesn’t look right. Leave it empty or use a format like 0712 345 678.');
            return;
        }
        const value = validAmount();
        if (value === null) return;
        // Opened inside the click, so popup blockers let it through after the await.
        const win = window.open('', '_blank');
        pesapalWindow.current = win;
        setState('sending');
        setError('');
        try {
            const res = await fetch('/api/pesapal/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_fee_id: fee.id, amount: value, phone_number: phone.trim() || undefined }),
            });
            const json: { data?: { redirectUrl: string; orderTrackingId: string }; error?: string } = await res.json();
            if (!res.ok || !json.data) {
                if (win) win.close();
                setState('failed');
                setError(json.error || 'We couldn’t start the Pesapal checkout.');
                return;
            }
            if (win) win.location.href = json.data.redirectUrl;
            else window.open(json.data.redirectUrl, '_blank');
            setState('waiting');
            pollUntilResolved(`/api/pesapal/status?order_tracking_id=${json.data.orderTrackingId}`, 'PESAPAL');
        } catch (err) {
            if (win) win.close();
            setState('failed');
            setError(err instanceof Error ? err.message : 'We couldn’t start the Pesapal checkout.');
        }
    };

    const pesapal = provider === 'PESAPAL';
    const unconfirmed = state === 'failed' && (error === PAYMENT_UNCONFIRMED_MESSAGE || error === PESAPAL_NOT_CONFIRMED_MESSAGE);

    return (
        <Modal isOpen={!!fee} onClose={close} title={pesapal ? 'Pay fees' : 'Pay with M-Pesa'}>
            {fee && (
                <div className="flex flex-col gap-4">
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                        <div className="font-semibold">{fee.learnerName ? `${fee.learnerName} · ` : ''}{fee.termName}</div>
                        <div className="text-xs text-muted-foreground">Balance {formatKsh(fee.balance)}</div>
                    </div>

                    {state === 'form' || state === 'sending' ? (
                        <>
                            <div>
                                <label htmlFor="pay-phone" className="mb-2 block text-xs font-semibold text-muted-foreground">{pesapal ? 'Phone number (optional)' : 'M-Pesa phone number'}</label>
                                <input id="pay-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712 345 678" className="input-field w-full" />
                                {!pesapal && <p className="mt-1 text-[11px] text-muted-foreground">You&apos;ll get a prompt on this phone to enter your M-Pesa PIN.</p>}
                            </div>
                            <div>
                                <label htmlFor="pay-amount" className="mb-2 block text-xs font-semibold text-muted-foreground">Amount (KSh)</label>
                                <input id="pay-amount" type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} className="input-field w-full" />
                                <p className="mt-1 text-[11px] text-muted-foreground">Whole shillings. You can pay part of the balance.</p>
                            </div>
                            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
                                <button type="button" className="btn-primary" onClick={() => void (pesapal ? openPesapal() : sendMpesaPrompt())} disabled={state === 'sending'}>
                                    {state === 'sending' ? (pesapal ? 'Opening checkout…' : 'Sending prompt…') : (pesapal ? 'Continue to checkout' : 'Send M-Pesa prompt')}
                                </button>
                            </div>
                        </>
                    ) : state === 'waiting' ? (
                        <div className="py-6 text-center" role="status">
                            <span className="mx-auto mb-3 block size-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden="true" />
                            <p className="mb-1 text-sm font-medium">{pesapal ? 'Complete payment in the new tab' : 'Check your phone'}</p>
                            <p className="text-sm text-muted-foreground">
                                {pesapal ? 'Finish paying on the Pesapal page, then come back here.' : `Enter your M-Pesa PIN on the prompt sent to ${phone}.`} This updates automatically.
                            </p>
                        </div>
                    ) : state === 'success' ? (
                        <div className="py-6 text-center" role="status">
                            <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-600" aria-hidden="true" />
                            <p className="mb-1 text-sm font-medium">Payment received</p>
                            <p className="text-sm text-muted-foreground">The balance has been updated.</p>
                            <div className="mt-4 flex justify-center gap-2">
                                {paidPaymentId && (
                                    <a className="btn-secondary" href={feeReceiptUrl(paidPaymentId)} target="_blank" rel="noreferrer">
                                        <Receipt className="size-4" aria-hidden="true" />View receipt
                                    </a>
                                )}
                                <button type="button" className="btn-primary" onClick={close}>Done</button>
                            </div>
                        </div>
                    ) : unconfirmed ? (
                        // The money may still arrive: lead with checking, so a second
                        // prompt is not one tap away from someone who already paid.
                        <div className="py-6 text-center" role="status">
                            <Clock3 className="mx-auto mb-2 size-8 text-amber-600" aria-hidden="true" />
                            <p className="mb-1 text-sm font-medium">Not confirmed yet</p>
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <div className="mt-4 flex flex-col-reverse justify-center gap-2 sm:flex-row">
                                <button type="button" className="btn-secondary" onClick={() => setState('form')}>Pay again</button>
                                <button type="button" className="btn-primary" onClick={() => { close(); onSettled(); }}>Check the balance</button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 text-center" role="alert">
                            <AlertTriangle className="mx-auto mb-2 size-8 text-destructive" aria-hidden="true" />
                            <p className="mb-1 text-sm font-medium">Payment not completed</p>
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <div className="mt-4 flex justify-center gap-2">
                                <button type="button" className="btn-secondary" onClick={close}>Close</button>
                                <button type="button" className="btn-primary" onClick={() => setState('form')}>Try again</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
