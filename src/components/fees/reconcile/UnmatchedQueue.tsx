"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Inbox, Loader2 } from 'lucide-react';
import { CardHeading, LoadError } from '@/components/ui';
import { apiErrorMessage, jsonBody } from '@/lib/api-error-message';
import { formatKsh } from '@/lib/fee-account';
import type { FeePayment } from '@/lib/fees';
import type { MatchCandidate } from '@/lib/fee-matching';
import type { DirectoryLearner, PreviewLine } from '@/lib/fee-reconcile';
import { decisionProblem, recordTo, splitBetween, withShare, type ReconcilePlan } from '@/lib/fee-reconcile-plan';
import { ReviewLine } from './ReviewLine';

interface UnmatchedResponse { data: FeePayment[]; suggestions?: Record<string, MatchCandidate[]>; learners?: DirectoryLearner[] }

/** Kenyan date and time of a payment, as a statement line shows them. */
function nairobiParts(iso: string): { date: string; time: string } {
    const local = new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString();
    return { date: local.slice(0, 10), time: local.slice(11, 19) };
}

/** An unmatched payment shaped like a statement line, so it is reviewed the same way. */
function asLine(p: FeePayment, index: number, candidates: MatchCandidate[]): PreviewLine {
    const { date, time } = nairobiParts(p.paidAt);
    const typed = p.unmatchedAccountReference;
    return {
        line: index + 1, date, time, amount: p.amount,
        code: p.mpesaReceiptNumber ?? null,
        accountRef: typed && !typed.startsWith('(none') ? typed : null,
        payerName: p.payerName, phone: p.phoneNumber, details: p.notes ?? '',
        status: candidates.length > 0 ? 'SUGGESTED' : 'UNMATCHED', candidates,
    };
}

/**
 * Money in that no learner has yet: a typo'd or missing account number, a
 * Till payment, a learner not billed yet. Each comes with the learners it
 * most likely belongs to; assign it (or share it between siblings), or set it
 * aside as not school fees. Chased the same week, before parents notice.
 */
export function UnmatchedQueue({ canAssign, canSetAside, onChanged, onCount }: {
    canAssign: boolean;
    canSetAside: boolean;
    onChanged: () => void;
    onCount?: (n: number) => void;
}) {
    const [load, setLoad] = useState<{ state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; body: UnmatchedResponse }>({ state: 'loading' });
    const [plan, setPlan] = useState<ReconcilePlan>({});
    const [busy, setBusy] = useState<string | null>(null);
    const [settingAside, setSettingAside] = useState<{ id: string; reason: string } | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/school/fees/unmatched', { cache: 'no-store' });
            const json = (await res.json().catch(() => null)) as UnmatchedResponse | null;
            if (!res.ok || !json) throw new Error(apiErrorMessage(json, 'Could not load unmatched payments.'));
            setLoad({ state: 'ready', body: json });
            onCount?.(json.data.length);
            // A single strong suggestion starts chosen; the bursar still presses Assign.
            const start: Record<number, { action: 'RECORD' | 'QUEUE'; allocations: { studentId: string; amount: number }[] }> = {};
            json.data.forEach((p, i) => {
                const [best, second] = json.suggestions?.[p.id] ?? [];
                start[i + 1] = best && best.score >= 60 && (!second || second.score < best.score)
                    ? { action: 'RECORD', allocations: [{ studentId: best.studentId, amount: p.amount }] }
                    : { action: 'QUEUE', allocations: [] };
            });
            setPlan(start);
        } catch (err) {
            setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load unmatched payments.' });
        }
    }, [onCount]);
    useEffect(() => { void refresh(); }, [refresh]);

    const body = load.state === 'ready' ? load.body : null;
    const lines = useMemo(() => (body ? body.data.map((p, i) => asLine(p, i, body.suggestions?.[p.id] ?? [])) : []), [body]);
    const learners = body?.learners ?? [];
    const byId = useMemo(() => new Map(learners.map(l => [l.id, l] as const)), [learners]);

    const assign = async (payment: FeePayment, line: PreviewLine) => {
        const decision = plan[line.line];
        if (!decision || decision.action !== 'RECORD' || decisionProblem(line, decision)) return;
        setBusy(payment.id);
        try {
            const res = await fetch(`/api/school/fees/unmatched/${payment.id}/assign`, jsonBody('POST', { allocations: decision.allocations }));
            if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not assign the payment.'));
            toast.success(decision.allocations.length > 1 ? `Shared between ${decision.allocations.length} learners.` : `Assigned to ${byId.get(decision.allocations[0].studentId)?.name ?? 'the learner'}.`);
            await refresh();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not assign the payment.');
        } finally {
            setBusy(null);
        }
    };

    const setAside = async () => {
        if (!settingAside || settingAside.reason.trim().length < 3) return;
        setBusy(settingAside.id);
        try {
            const res = await fetch(`/api/school/fees/unmatched/${settingAside.id}/resolve`, jsonBody('POST', { reason: settingAside.reason.trim() }));
            if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not set the payment aside.'));
            toast.success('Set aside as not school fees.');
            setSettingAside(null);
            await refresh();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not set the payment aside.');
        } finally {
            setBusy(null);
        }
    };

    const total = body ? body.data.reduce((n, p) => n + p.amount, 0) : 0;

    return (
        <section id="unmatched-payments" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <CardHeading
                icon={Inbox}
                hue="amber"
                title={body && body.data.length > 0 ? `Waiting to be matched: ${body.data.length} (${formatKsh(total)})` : 'Waiting to be matched'}
                description="Payments no learner has yet. Each shows who it most likely belongs to: by a mistyped admission number, the parent’s phone, or the payer’s name. Assign it, share it between brothers and sisters, or set it aside."
            />
            {load.state === 'loading' && <div className="skeleton-bone h-24 rounded-xl" aria-busy="true" />}
            {load.state === 'error' && <LoadError title="Couldn't load unmatched payments" message={load.message} onRetry={() => { setLoad({ state: 'loading' }); void refresh(); }} />}
            {body && body.data.length === 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.06] p-3 text-sm text-emerald-800 dark:text-emerald-200"><CheckCircle2 className="size-4" aria-hidden />Every payment is matched to a learner.</p>
            )}
            {body && body.data.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {body.data.map((payment, i) => {
                        const line = lines[i];
                        const decision = plan[line.line];
                        const ready = decision?.action === 'RECORD' && !decisionProblem(line, decision);
                        const asideOpen = settingAside?.id === payment.id;
                        return (
                            <ReviewLine
                                key={payment.id}
                                line={line}
                                decision={decision}
                                learners={learners}
                                byId={byId}
                                problem={decision?.action === 'RECORD' ? decisionProblem(line, decision) : null}
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
                                                    value={settingAside.reason} onChange={e => setSettingAside({ id: payment.id, reason: e.target.value })}
                                                />
                                                <div className="flex gap-2">
                                                    <button type="button" className="btn-secondary h-9" onClick={() => setSettingAside(null)}>Cancel</button>
                                                    <button type="button" className="btn-primary h-9" disabled={busy === payment.id || settingAside.reason.trim().length < 3} onClick={() => void setAside()}>Set aside</button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {canSetAside && !asideOpen && <button type="button" className="btn-secondary h-9" onClick={() => setSettingAside({ id: payment.id, reason: '' })}>Not school fees</button>}
                                            {canAssign && (
                                                <button type="button" className="btn-primary h-9" disabled={!ready || busy === payment.id} onClick={() => void assign(payment, line)}>
                                                    {busy === payment.id && <Loader2 className="size-4 animate-spin" aria-hidden />}
                                                    {decision?.allocations.length && decision.allocations.length > 1 ? `Share between ${decision.allocations.length}` : 'Assign'}
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
