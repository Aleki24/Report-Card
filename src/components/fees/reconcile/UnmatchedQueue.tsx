"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Inbox, Loader2 } from 'lucide-react';
import { CardHeading, LoadError } from '@/components/ui';
import { jsonBody, requestJson } from '@/lib/api-error-message';
import { formatKsh } from '@/lib/fee-account';
import type { FeePayment } from '@/lib/fees';
import { UNMATCHED_URL, unmatchedAsLine, type PreviewLine, type UnmatchedResponse } from '@/lib/fee-reconcile';
import { decisionProblem, queuePlan, recordTo, splitBetween, withShare, type ReconcilePlan } from '@/lib/fee-reconcile-plan';
import { ReviewLine } from './ReviewLine';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; body: UnmatchedResponse };

/** At least this long to say why money is not school fees. */
const MIN_REASON = 3;

/**
 * Money in that no learner has yet: a mistyped or missing account number, a
 * learner not billed yet. Each comes with the learners it most likely belongs
 * to; assign it (or share it between brothers and sisters), or set it aside
 * as not school fees. Chased the same week, before parents notice.
 */
export function UnmatchedQueue({ canAssign, canSetAside, onChanged, onCount }: {
    canAssign: boolean;
    canSetAside: boolean;
    /** Money moved onto a learner's record: balances elsewhere are stale. */
    onChanged: () => void;
    onCount?: (n: number) => void;
}) {
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [plan, setPlan] = useState<ReconcilePlan>({});
    const [busy, setBusy] = useState<string | null>(null);
    const [settingAside, setSettingAside] = useState<{ id: string; reason: string } | null>(null);

    const body = load.state === 'ready' ? load.body : null;
    const lines = useMemo(() => (body ? body.data.map((p, i) => unmatchedAsLine(p, i, body.suggestions?.[p.id] ?? [])) : []), [body]);
    const learners = useMemo(() => body?.learners ?? [], [body]);
    const byId = useMemo(() => new Map(learners.map(l => [l.id, l] as const)), [learners]);

    const refresh = useCallback(async () => {
        try {
            const json = await requestJson<UnmatchedResponse>(UNMATCHED_URL, { cache: 'no-store' });
            setLoad({ state: 'ready', body: json });
            setPlan(queuePlan(json.data.map((p, i) => unmatchedAsLine(p, i, json.suggestions?.[p.id] ?? []))));
            onCount?.(json.data.length);
        } catch (err) {
            setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load unmatched payments.' });
        }
    }, [onCount]);
    useEffect(() => { void refresh(); }, [refresh]);

    /** Runs a change to one payment, then reloads the queue and the page's balances. */
    const act = async (paymentId: string, run: () => Promise<unknown>, done: string, failed: string) => {
        setBusy(paymentId);
        try {
            await run();
            toast.success(done);
            setSettingAside(null);
            await refresh();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : failed);
        } finally {
            setBusy(null);
        }
    };

    const assign = (payment: FeePayment, line: PreviewLine) => {
        const decision = plan[line.line];
        if (decision?.action !== 'RECORD' || decisionProblem(line, decision)) return;
        const [first] = decision.allocations;
        void act(
            payment.id,
            () => requestJson(`${UNMATCHED_URL}/${payment.id}/assign`, jsonBody('POST', { allocations: decision.allocations })),
            decision.allocations.length > 1 ? `Shared between ${decision.allocations.length} learners.` : `Assigned to ${byId.get(first.studentId)?.name ?? 'the learner'}.`,
            'Could not assign the payment.',
        );
    };

    const setAside = () => {
        if (!settingAside || settingAside.reason.trim().length < MIN_REASON) return;
        const { id, reason } = settingAside;
        void act(
            id,
            () => requestJson(`${UNMATCHED_URL}/${id}/resolve`, jsonBody('POST', { reason: reason.trim() })),
            'Set aside as not school fees.',
            'Could not set the payment aside.',
        );
    };

    const total = body ? body.data.reduce((n, p) => n + p.amount, 0) : 0;
    const waiting = body?.data.length ?? 0;

    return (
        <section id="unmatched-payments" aria-label="Payments waiting to be matched" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <CardHeading
                className="mb-0"
                icon={Inbox}
                hue="amber"
                title={waiting > 0 ? `Waiting to be matched: ${waiting} (${formatKsh(total)})` : 'Waiting to be matched'}
                description="Payments no learner has yet. Each shows who it most likely belongs to: by a mistyped admission number, the parent’s phone, or the payer’s name. Assign it, share it between brothers and sisters, or set it aside."
            />
            {load.state === 'loading' && <div className="skeleton-bone h-24 rounded-xl" aria-busy="true" aria-label="Loading unmatched payments" />}
            {load.state === 'error' && <LoadError title="Couldn't load unmatched payments" message={load.message} onRetry={() => { setLoad({ state: 'loading' }); void refresh(); }} />}
            {body && waiting === 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.06] p-3 text-sm text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />Every payment is matched to a learner.
                </p>
            )}
            {body && waiting > 0 && (
                <ul className="flex flex-col gap-2">
                    {body.data.map((payment, i) => {
                        const line = lines[i];
                        const decision = plan[line.line];
                        const problem = decision?.action === 'RECORD' ? decisionProblem(line, decision) : null;
                        const ready = decision?.action === 'RECORD' && !problem;
                        const shares = decision?.allocations.length ?? 0;
                        const asideOpen = settingAside?.id === payment.id;
                        const working = busy === payment.id;
                        return (
                            <ReviewLine
                                key={payment.id}
                                line={line}
                                decision={decision}
                                learners={learners}
                                byId={byId}
                                problem={problem}
                                actions={{
                                    recordTo: id => setPlan(p => recordTo(p, line, id)),
                                    split: ids => setPlan(p => splitBetween(p, line, ids)),
                                    share: (id, amount) => setPlan(p => withShare(p, line, id, amount)),
                                }}
                                footer={
                                    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
                                        {payment.notes && <p className="text-xs text-muted-foreground">{payment.notes}</p>}
                                        {asideOpen && (
                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                <input
                                                    className="input-field h-9 flex-1 text-sm" autoFocus maxLength={300} aria-label="Why it is not school fees"
                                                    placeholder="Why: refunded to the parent, paid in error, a supplier’s deposit…"
                                                    value={settingAside.reason}
                                                    onChange={e => setSettingAside({ id: payment.id, reason: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Enter') setAside(); }}
                                                />
                                                <div className="grid grid-cols-2 gap-2 sm:flex">
                                                    <button type="button" className="btn-secondary h-9" onClick={() => setSettingAside(null)}>Cancel</button>
                                                    <button type="button" className="btn-primary h-9" disabled={working || settingAside.reason.trim().length < MIN_REASON} onClick={setAside}>Set aside</button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                            {canSetAside && !asideOpen && (
                                                <button type="button" className="btn-secondary h-9" onClick={() => setSettingAside({ id: payment.id, reason: '' })}>Not school fees</button>
                                            )}
                                            {canAssign && (
                                                <button type="button" className="btn-primary h-9" disabled={!ready || working} onClick={() => assign(payment, line)}>
                                                    {working && <Loader2 className="size-4 animate-spin" aria-hidden />}
                                                    {shares > 1 ? `Share between ${shares}` : 'Assign'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                }
                            />
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
