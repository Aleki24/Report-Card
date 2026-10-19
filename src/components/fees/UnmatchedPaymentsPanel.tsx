"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { FeePayment } from '@/lib/fees';
import { apiErrorMessage } from '@/lib/api-error-message';
import { findActiveTermId } from '@/lib/term-calendar';

interface TermRow { id: string; name: string; academic_year_name: string | null; start_date?: string; end_date?: string; is_current?: boolean }
/** "Term 1" repeats every year, so the year is part of the label. */
interface TermOption { id: string; label: string }
interface FeeMatch { id: string; admissionNumber: string | null }

/**
 * M-Pesa money confirmed against an account number no learner has, and the
 * form that assigns it to the right fee record. Lives with the fees (bursars
 * and accountants do this, with fees.collect) and in Settings › Payments.
 */
export function UnmatchedPaymentsPanel({ canAssign, onCountChange, onAssigned }: {
    canAssign: boolean;
    /** Told how many payments are still unmatched after each load. */
    onCountChange?: (count: number) => void;
    /** A payment was assigned to a learner's fees: balances and logs elsewhere on the page are stale. */
    onAssigned?: () => void;
}) {
    const [unmatched, setUnmatched] = useState<FeePayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [terms, setTerms] = useState<TermOption[]>([]);
    /** The current term, preselected for each payment. */
    const [currentTermId, setCurrentTermId] = useState('');
    const [assignTerm, setAssignTerm] = useState<Record<string, string>>({});
    const [assignAdmission, setAssignAdmission] = useState<Record<string, string>>({});
    const [assigning, setAssigning] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await fetch('/api/school/fees/unmatched', { cache: 'no-store' });
            const json: unknown = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load unmatched payments.'));
            const rows = ((json as { data?: FeePayment[] }).data) ?? [];
            setUnmatched(rows);
            onCountChange?.(rows.length);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Could not load unmatched payments.');
        }
        setLoading(false);
    }, [onCountChange]);

    useEffect(() => {
        void load();
        fetch('/api/school/data?type=terms')
            .then(r => (r.ok ? r.json() : { data: [] }))
            .then((j: { data?: TermRow[] }) => {
                const rows = j.data ?? [];
                // Newest first, with the year, so last year's "Term 1" is not picked by mistake.
                setTerms([...rows].reverse().map(t => ({ id: t.id, label: t.academic_year_name ? `${t.name} · ${t.academic_year_name}` : t.name })));
                setCurrentTermId(findActiveTermId(rows) ?? '');
            })
            .catch(() => {});
    }, [load]);

    const assign = async (payment: FeePayment) => {
        const admission = (assignAdmission[payment.id] || '').trim();
        const termId = assignTerm[payment.id] || currentTermId;
        if (!admission || !termId) {
            toast.error('Enter an admission number and pick a term.');
            return;
        }
        setAssigning(payment.id);
        try {
            const feesRes = await fetch(`/api/school/fees?term_id=${encodeURIComponent(termId)}`);
            const feesJson: unknown = await feesRes.json();
            if (!feesRes.ok) throw new Error(apiErrorMessage(feesJson, 'Could not look up that learner’s fees.'));
            const match = (((feesJson as { data?: FeeMatch[] }).data) ?? [])
                .find(f => f.admissionNumber?.toLowerCase() === admission.toLowerCase());
            if (!match) {
                toast.error('No fee record found for that admission number in this term. Create one from the Fees list first.');
                return;
            }
            const res = await fetch(`/api/school/fees/unmatched/${payment.id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_fee_id: match.id }),
            });
            const json: unknown = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Failed to assign'));
            toast.success('Payment assigned.');
            onAssigned?.();
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to assign payment');
        } finally {
            setAssigning(null);
        }
    };

    return (
        <div id="unmatched-payments" className="card scroll-mt-24 p-5">
            <h3 className="mb-1 text-sm font-bold">Unmatched payments</h3>
            <p className="mb-4 text-xs text-muted-foreground">Money confirmed but not yet matched to a student&apos;s current-term bill.</p>
            {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : loadError ? (
                <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center text-sm text-destructive">
                    <p>{loadError}</p>
                    <button type="button" className="btn-secondary" onClick={() => void load()}>Try again</button>
                </div>
            ) : unmatched.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing to reconcile — all payments matched automatically.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {unmatched.map(p => (
                        <div key={p.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 p-3">
                            <div className="min-w-40">
                                <div className="text-sm font-semibold">KSh {p.amount.toLocaleString()}</div>
                                <div className="text-[11px] text-muted-foreground">
                                    Ref &quot;{p.unmatchedAccountReference}&quot; · {p.phoneNumber || '—'} · {new Date(p.paidAt).toLocaleDateString('en-GB')}
                                </div>
                            </div>
                            {canAssign && (
                                <>
                                    <label className="min-w-36 flex-1">
                                        <span className="sr-only">Admission number for KSh {p.amount.toLocaleString()}</span>
                                        <input
                                            type="text"
                                            className="input-field h-8 w-full text-xs"
                                            placeholder="Admission number"
                                            value={assignAdmission[p.id] || ''}
                                            onChange={e => setAssignAdmission(prev => ({ ...prev, [p.id]: e.target.value }))}
                                        />
                                    </label>
                                    <label className="min-w-36 flex-1">
                                        <span className="sr-only">Term for KSh {p.amount.toLocaleString()}</span>
                                        <select
                                            className="input-field h-8 w-full text-xs"
                                            value={assignTerm[p.id] || currentTermId}
                                            onChange={e => setAssignTerm(prev => ({ ...prev, [p.id]: e.target.value }))}
                                        >
                                            <option value="">Term…</option>
                                            {terms.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </label>
                                    <button type="button" className="btn-primary h-8 text-xs" onClick={() => void assign(p)} disabled={assigning === p.id}>
                                        {assigning === p.id ? 'Assigning…' : 'Assign'}
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
