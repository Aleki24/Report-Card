"use client";

import React, { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { formatKsh } from '@/lib/fee-account';
import { VOID_REASONS, voidReasonProblem } from '@/lib/fee-void';

export interface VoidTarget {
    id: string;
    receiptNumber: string;
    amount: number;
    /** Set when this receipt is one learner's share of a payment split between learners. */
    splitFromPaymentId?: string | null;
}

/**
 * Voiding a receipt asks why. The reason is kept with who voided it and when,
 * so the person reviewing the day can see what changed.
 */
export function VoidPaymentDialog({ payment, onClose, onVoid }: {
    payment: VoidTarget | null;
    onClose: () => void;
    onVoid: (reason: string) => Promise<void>;
}) {
    const id = useId();
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (payment) setReason(''); }, [payment]);
    const problem = voidReasonProblem(reason);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (problem) return;
        setBusy(true);
        try { await onVoid(reason.trim()); } finally { setBusy(false); }
    };

    return (
        <Modal isOpen={payment !== null} onClose={() => { if (!busy) onClose(); }} title={payment ? `Void receipt ${payment.receiptNumber}?` : ''} size="sm">
            <form onSubmit={submit} className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                    {payment?.splitFromPaymentId
                        ? <>This receipt is one learner’s share of a payment. Voiding it gives {formatKsh(payment.amount)} back to the receipt it was shared from; to cancel the whole payment (a reversal), void that one instead.</>
                        : <>{payment ? formatKsh(payment.amount) : ''} comes off the balance it paid, and any shares of it for other learners are voided with it. The receipt stays on record as voided, with your name and the reason.</>}
                </p>
                <div className="flex flex-wrap gap-1.5" aria-label="Common reasons">
                    {VOID_REASONS.map(r => (
                        <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/50">{r}</button>
                    ))}
                </div>
                <label htmlFor={`${id}-reason`} className="text-sm font-medium">Reason</label>
                <textarea id={`${id}-reason`} className="input-field min-h-20 text-sm" maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: M-Pesa reversed the payment on 4 Nov" />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" className="btn-secondary justify-center" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="submit" className="btn-primary justify-center bg-destructive hover:bg-destructive/90" disabled={busy || !!problem}>
                        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Void receipt
                    </button>
                </div>
            </form>
        </Modal>
    );
}
