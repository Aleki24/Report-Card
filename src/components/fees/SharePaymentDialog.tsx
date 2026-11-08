"use client";

import React, { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Split } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LoadError } from '@/components/ui';
import { jsonBody, requestJson } from '@/lib/api-error-message';
import { formatKsh } from '@/lib/fee-account';
import { paymentShareUrl, type DirectoryLearner, type ShareBody, type ShareCandidates } from '@/lib/fee-reconcile';
import { cn } from '@/lib/utils';
import { LearnerPicker, balanceNote, learnerLine } from './reconcile/LearnerPicker';

/** The receipt being shared. */
export interface ShareTarget { id: string; receiptNumber: string; amount: number; code: string | null }

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; body: ShareCandidates };

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * One payment that was for two children but came in under one child's
 * admission number: part of it moves to the brother or sister as their own
 * receipt, and this receipt keeps the rest. Brothers and sisters (a parent's
 * phone in common) are offered first.
 */
export function SharePaymentDialog({ payment, onClose, onShared }: {
    payment: ShareTarget | null;
    onClose: () => void;
    onShared: () => void;
}) {
    const id = useId();
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [pick, setPick] = useState<DirectoryLearner | null>(null);
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    /** Bumped by Retry after a failed load. */
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!payment) return;
        const controller = new AbortController();
        setLoad({ state: 'loading' });
        setPick(null);
        setAmount(String(money(payment.amount / 2)));
        requestJson<{ data: ShareCandidates }>(paymentShareUrl(payment.id), { cache: 'no-store', signal: controller.signal })
            .then(({ data }) => setLoad({ state: 'ready', body: data }))
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load learners.' });
            });
        return () => controller.abort();
    }, [payment, attempt]);

    if (!payment) return null;

    const value = money(Number(amount));
    const problem = !pick ? 'Pick who else it was for.'
        : !(value > 0) ? 'Enter the share.'
        : value >= payment.amount ? `The share must be less than ${formatKsh(payment.amount)}.`
        : null;
    const body = load.state === 'ready' ? load.body : null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (problem || !pick) return;
        setBusy(true);
        try {
            const share: ShareBody = { studentId: pick.id, amount: value };
            await requestJson(paymentShareUrl(payment.id), jsonBody('POST', share));
            toast.success(`${formatKsh(value)} moved to ${pick.name}.`);
            onShared();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not share the payment.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={() => { if (!busy) onClose(); }} title={`Share receipt ${payment.receiptNumber}`} size="md">
            <form onSubmit={submit} className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    {formatKsh(payment.amount)}{payment.code ? <> (<span className="font-mono">{payment.code}</span>)</> : null} paid for more than one child?
                    Move part of it to a brother or sister: they get their own receipt, and this one keeps the rest.
                </p>

                {load.state === 'loading' && <div className="skeleton-bone h-20 rounded-xl" aria-busy="true" aria-label="Loading learners" />}
                {load.state === 'error' && <LoadError title="Couldn't load learners" message={load.message} onRetry={() => setAttempt(n => n + 1)} />}

                {body && (
                    <>
                        {body.siblings.length > 0 && (
                            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Brothers and sisters">
                                <span className="text-xs font-semibold text-muted-foreground">Same parent’s phone</span>
                                {body.siblings.map(l => {
                                    const on = pick?.id === l.id;
                                    return (
                                        <button
                                            key={l.id} type="button" role="radio" aria-checked={on} onClick={() => setPick(l)}
                                            className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors', on ? 'border-emerald-500/60 bg-emerald-500/[0.08]' : 'border-border hover:border-emerald-500/40')}
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                {on ? <Check className="size-4 shrink-0 text-emerald-600" aria-hidden /> : <span className="size-4 shrink-0 rounded-full border border-border" aria-hidden />}
                                                <span className="min-w-0 truncate">{learnerLine(l)}</span>
                                            </span>
                                            <span className="shrink-0 text-[11px] text-muted-foreground">{balanceNote(l.balance)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold text-muted-foreground">{body.siblings.length > 0 ? 'Or someone else' : 'Who else it was for'}</span>
                            {pick && !body.siblings.some(s => s.id === pick.id) && (
                                <p className="flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-500/[0.08] px-3 py-2 text-sm">
                                    <Check className="size-4 shrink-0 text-emerald-600" aria-hidden /><span className="min-w-0 truncate">{learnerLine(pick)}</span>
                                </p>
                            )}
                            <LearnerPicker learners={body.learners} exclude={pick ? [pick.id] : []} onPick={setPick} />
                        </div>
                    </>
                )}

                <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${id}-amount`} className="text-xs font-semibold text-muted-foreground">Their share (KSh)</label>
                    <div className="flex gap-2">
                        <input
                            id={`${id}-amount`} type="number" min={1} step="0.01" inputMode="decimal"
                            className="input-field h-10 w-full text-right tabular-nums sm:w-44" value={amount} onChange={e => setAmount(e.target.value)}
                        />
                        <button type="button" className="btn-secondary h-10 shrink-0 px-3" onClick={() => setAmount(String(money(payment.amount / 2)))}>Half</button>
                    </div>
                    {pick && value > 0 && value < payment.amount && (
                        <p className="text-xs text-muted-foreground">
                            {body?.owner ? body.owner.name : 'This learner'} keeps {formatKsh(money(payment.amount - value))} · {pick.name} gets {formatKsh(value)}
                        </p>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                    {problem && pick && <p className="text-xs font-medium text-amber-700 sm:mr-auto dark:text-amber-300">{problem}</p>}
                    <button type="button" className="btn-secondary justify-center" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="submit" className="btn-primary justify-center" disabled={busy || !!problem}>
                        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Split className="size-4" aria-hidden />}Share
                    </button>
                </div>
            </form>
        </Modal>
    );
}
