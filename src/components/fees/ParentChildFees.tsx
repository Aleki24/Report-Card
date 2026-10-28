"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Info, Receipt, RotateCcw, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error-message';
import type { PaymentProvider } from '@/lib/fees';
import {
    balanceState, feeAccountUrl, feeReceiptUrl, feeStatementUrl, formatKsh, methodLabel,
    type FeeAccountResponse,
} from '@/lib/fee-account';
import { PayOnlineDialog, type PayableFee } from './PayOnlineDialog';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; account: FeeAccountResponse };

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A child's fees for their parent: what is owed across every term, each
 * term with a Pay button when the school takes online payments, the
 * receipts, the statement, and how else to pay.
 */
export function ParentChildFees({ studentId, provider }: { studentId: string; provider: PaymentProvider }) {
    const [load, setLoad] = useState<Load>({ status: 'loading' });
    const [paying, setPaying] = useState<PayableFee | null>(null);

    const fetchAccount = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch(feeAccountUrl(studentId), { cache: 'no-store', signal });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not load the fees.'));
            setLoad({ status: 'ready', account: body as FeeAccountResponse });
        } catch (err) {
            if (!signal?.aborted) setLoad({ status: 'error', message: err instanceof Error ? err.message : 'Could not load the fees.' });
        }
    }, [studentId]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchAccount(controller.signal);
        return () => controller.abort();
    }, [fetchAccount]);

    if (load.status === 'loading') return <div className="h-40 animate-pulse rounded-2xl bg-muted/60" aria-busy="true" />;
    if (load.status === 'error') {
        return (
            <div role="alert" className="flex flex-col items-start gap-2 text-sm">
                <p className="text-destructive">{load.message}</p>
                <button type="button" className="btn-secondary h-9 text-xs" onClick={() => { setLoad({ status: 'loading' }); void fetchAccount(); }}>
                    <RotateCcw className="size-3.5" aria-hidden="true" />Try again
                </button>
            </div>
        );
    }

    const { account } = load;
    if (account.terms.length === 0) return <p className="text-sm text-muted-foreground">No fees billed yet.</p>;
    const state = balanceState(account.totals.balance);
    const canPay = provider !== 'NONE';
    const owing = [...account.terms].filter(t => t.balance > 0);

    return (
        <div className="flex flex-col gap-4">
            <div className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between', state === 'owing' ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-emerald-500/30 bg-emerald-500/[0.06]')}>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{state === 'credit' ? 'In credit' : 'Balance to pay'}</p>
                    <p className={cn('font-display text-2xl font-bold tabular-nums', state === 'owing' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')}>
                        {state === 'clear' ? 'All paid' : formatKsh(Math.abs(account.totals.balance))}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatKsh(account.totals.paid)} paid of {formatKsh(account.totals.billed)} across {account.terms.length} {account.terms.length === 1 ? 'term' : 'terms'}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <a href={feeStatementUrl(studentId)} target="_blank" rel="noopener noreferrer" className="btn-secondary justify-center">
                        <FileText className="size-4" aria-hidden="true" />Statement
                    </a>
                    {canPay && owing.length > 0 && (
                        <button
                            type="button"
                            className="btn-primary justify-center"
                            // The oldest term owing first, so arrears clear before the current bill.
                            onClick={() => setPaying({ id: owing[0].feeId, termName: owing[0].termName, balance: owing[0].balance, learnerName: account.learner.name })}
                        >
                            <Smartphone className="size-4" aria-hidden="true" />Pay {owing[0].termName}
                        </button>
                    )}
                </div>
            </div>

            <ul className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/70">
                {[...account.terms].reverse().map(t => {
                    const termState = balanceState(t.balance);
                    return (
                        <li key={t.feeId} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{t.termName}{t.yearName ? ` · ${t.yearName}` : ''}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">{formatKsh(t.paid)} of {formatKsh(t.billed)}{t.dueDate ? ` · due ${shortDate(t.dueDate)}` : ''}</p>
                            </div>
                            <span className={cn('text-sm font-semibold tabular-nums', termState === 'owing' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')}>
                                {termState === 'owing' ? formatKsh(t.balance) : termState === 'credit' ? `${formatKsh(-t.balance)} credit` : 'Paid'}
                            </span>
                            {canPay && termState === 'owing' && (
                                <button type="button" className="btn-secondary h-9 shrink-0 px-3 text-xs" onClick={() => setPaying({ id: t.feeId, termName: t.termName, balance: t.balance, learnerName: account.learner.name })}>
                                    Pay
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            {account.payments.length > 0 && (
                <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receipts</h3>
                    <ul className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/70">
                        {account.payments.slice(0, 6).map(p => (
                            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                                <Receipt className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tabular-nums">{formatKsh(p.amount)} <span className="font-normal text-muted-foreground">· {methodLabel(p.method)}</span></p>
                                    <p className="truncate text-xs text-muted-foreground">{shortDate(p.paidAt)} · {p.receiptNumber}</p>
                                </div>
                                <a href={feeReceiptUrl(p.id)} target="_blank" rel="noopener noreferrer" className="btn-icon text-muted-foreground hover:text-foreground" aria-label={`Download receipt ${p.receiptNumber}`} title="Receipt">
                                    <Download className="size-4" aria-hidden="true" />
                                </a>
                            </li>
                        ))}
                    </ul>
                    {account.payments.length > 6 && <p className="mt-1 text-xs text-muted-foreground">Older receipts are on the statement.</p>}
                </div>
            )}

            {account.howToPay.length > 0 && (
                <div className="flex items-start gap-2 rounded-2xl bg-muted/40 p-3 text-xs">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="space-y-1 text-muted-foreground">{account.howToPay.map(line => <p key={line}>{line}</p>)}</div>
                </div>
            )}

            <PayOnlineDialog fee={paying} provider={provider} onClose={() => setPaying(null)} onSettled={() => void fetchAccount()} />
        </div>
    );
}
