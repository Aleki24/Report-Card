"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { TermSelect, type TermSelectYear } from '@/components/ui';
import { cn } from '@/lib/utils';
import { computeFeeStatus, FEE_PAYMENT_METHODS, type FeePaymentMethod } from '@/lib/fees';
import {
    BATCH_CONCURRENCY, balanceColor, emptyBatchEntry, feeChanged, formatCurrency, methodLabel, runLimited, statusBadge, toStudentOption,
    type BatchEntry, type FeeRecord, type StreamOption, type StudentApiRow, type StudentOption, type TermOption,
} from './feesShared';

interface BatchEntryPanelProps {
    streams: readonly StreamOption[];
    terms: TermOption[];
    years: TermSelectYear[];
    canManageFees: boolean;
    /** Reload the page's fee records after a save. */
    onSaved: () => Promise<void>;
}

/**
 * Bill a whole class for a term and enter money received, in one sheet.
 * Leaving the tab unmounts it, which clears the sheet.
 */
export function BatchEntryPanel({ streams: gradeStreams, terms, years, canManageFees, onSaved }: BatchEntryPanelProps) {
    const [batchStream, setBatchStream] = useState('');
    const [batchTerm, setBatchTerm] = useState('');
    const [batchStudents, setBatchStudents] = useState<StudentOption[]>([]);
    const [batchEntries, setBatchEntries] = useState<Record<string, BatchEntry>>({});
    const [batchMethod, setBatchMethod] = useState<FeePaymentMethod>('CASH');
    const [bulkFee, setBulkFee] = useState('');
    const [bulkDue, setBulkDue] = useState('');
    const [batchSaving, setBatchSaving] = useState(false);
    const [batchMsg, setBatchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ── Batch entry ──

    // Only the latest class/term load may fill the sheet: a slower earlier
    // response must not overwrite it.
    const batchLoadRef = useRef(0);
    const loadBatchStudents = useCallback(async () => {
        if (!batchStream || !batchTerm) return;
        const requestId = ++batchLoadRef.current;
        try {
            const [res, feeRes] = await Promise.all([
                fetch(`/api/school/data?type=students&grade_stream_id=${encodeURIComponent(batchStream)}`, { cache: 'no-store' }),
                fetch(`/api/school/fees?term_id=${encodeURIComponent(batchTerm)}`, { cache: 'no-store' }),
            ]);
            if (requestId !== batchLoadRef.current) return;
            // A failed fees read would show every learner as not billed yet,
            // and saving would then bill them again.
            if (!res.ok || !feeRes.ok) {
                setBatchStudents([]);
                setBatchEntries({});
                setBatchMsg({ type: 'error', text: 'Could not load this class and its fees. Try again.' });
                return;
            }
            const json: { data?: StudentApiRow[] } = await res.json();
            const feeJson: { data?: FeeRecord[] } = await feeRes.json();
            if (requestId !== batchLoadRef.current) return;
            const mapped = (json.data || [])
                .filter(s => !s.status || s.status === 'ACTIVE')
                .map(toStudentOption)
                .sort((a, b) => a.name.localeCompare(b.name));
            // Matched by student id: admission numbers are optional.
            const byStudent = new Map((feeJson.data || []).filter(f => f.studentId).map(f => [f.studentId as string, f]));
            setBatchStudents(mapped);
            setBatchEntries(Object.fromEntries(mapped.map(s => [s.id, emptyBatchEntry(byStudent.get(s.id) ?? null)])));
        } catch (err) {
            if (requestId !== batchLoadRef.current) return;
            console.error('Failed to load batch students:', err);
            setBatchMsg({ type: 'error', text: 'Failed to load students.' });
        }
    }, [batchStream, batchTerm]);

    useEffect(() => {
        if (batchStream && batchTerm) {
            setBatchMsg(null);
            loadBatchStudents();
        }
    }, [batchStream, batchTerm, loadBatchStudents]);

    const updateBatchEntry = (studentId: string, field: 'total' | 'payNow' | 'dueDate' | 'notes', value: string) => {
        setBatchEntries(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: value },
        }));
    };

    const applyToAll = (field: 'total' | 'dueDate', value: string) => {
        if (!value) return;
        setBatchEntries(prev => Object.fromEntries(Object.entries(prev).map(([id, e]) => [id, { ...e, [field]: value }])));
    };

    const batchChanges = useMemo(() => {
        const rows = Object.values(batchEntries);
        const fees = rows.filter(feeChanged).length;
        const payments = rows.filter(e => Number(e.payNow) > 0);
        return { fees, payments: payments.length, paymentTotal: payments.reduce((sum, e) => sum + Number(e.payNow), 0) };
    }, [batchEntries]);

    const saveBatch = async () => {
        setBatchSaving(true);
        setBatchMsg(null);
        const errors: string[] = [];
        let savedFees = 0;
        let savedPayments = 0;
        const nameOf = (id: string) => batchStudents.find(s => s.id === id)?.name || 'A student';

        // A few at a time: a class of fifty used to send up to a hundred requests at once.
        await runLimited(Object.entries(batchEntries), BATCH_CONCURRENCY, async ([studentId, entry]) => {
            const payNow = Number(entry.payNow) || 0;
            const saveFee = feeChanged(entry);
            if (!saveFee && payNow <= 0) return;

            const total = Number(entry.total);
            if (entry.total !== '' && (isNaN(total) || total < 0)) {
                errors.push(`${nameOf(studentId)}: the fee must be 0 or more`);
                return;
            }
            if (payNow < 0) {
                errors.push(`${nameOf(studentId)}: a payment can't be negative. Void a receipt from Payment history instead.`);
                return;
            }

            let feeId = entry.existing?.id ?? null;
            if (saveFee) {
                try {
                    const res = await fetch('/api/school/fees', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ student_id: studentId, term_id: batchTerm, total_fee: total, due_date: entry.dueDate || null, notes: entry.notes || null }),
                    });
                    const body: { data?: { id: string }; error?: string } = await res.json();
                    if (!res.ok || !body.data) {
                        errors.push(`${nameOf(studentId)}: ${body.error || 'fee not saved'}`);
                        return;
                    }
                    feeId = body.data.id;
                    savedFees++;
                } catch {
                    errors.push(`${nameOf(studentId)}: fee not saved`);
                    return;
                }
            }

            if (payNow > 0) {
                if (!feeId) {
                    errors.push(`${nameOf(studentId)}: set a fee before recording a payment`);
                    return;
                }
                try {
                    const res = await fetch(`/api/school/fees/${feeId}/payments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: payNow, method: batchMethod, notes: 'Batch entry' }),
                    });
                    if (!res.ok) {
                        const body: { error?: string } = await res.json().catch(() => ({}));
                        errors.push(`${nameOf(studentId)}: payment not recorded (${body.error || res.status})`);
                        return;
                    }
                    savedPayments++;
                } catch {
                    errors.push(`${nameOf(studentId)}: payment not recorded`);
                }
            }
        });

        // Always reload: rows that did save now have a new "paid so far", and a
        // stale screen is what let a second save record the same money twice.
        await Promise.all([onSaved(), loadBatchStudents()]);
        setBatchSaving(false);

        const summary = `${savedFees} fee record(s) saved, ${savedPayments} payment(s) recorded.`;
        setBatchMsg(errors.length === 0
            ? { type: 'success', text: summary }
            : { type: 'error', text: `${summary} ${errors.length} problem(s): ${errors.slice(0, 4).join('; ')}${errors.length > 4 ? '…' : ''}` });
    };

    return (
        <div>
            <div className="mb-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                <h2 className="font-semibold">Batch fee entry</h2>
                <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
                    Pick a class and term, set each student&apos;s fee, and enter any money received now. Payments already on record are shown, not re-entered.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <label htmlFor="batch-class" className="mb-2 block text-xs font-medium text-muted-foreground">Class</label>
                        <select id="batch-class" className="input-field w-full" value={batchStream} onChange={e => setBatchStream(e.target.value)}>
                            <option value="">Select class…</option>
                            {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="batch-term" className="mb-2 block text-xs font-medium text-muted-foreground">Term</label>
                        <TermSelect id="batch-term" terms={terms} years={years} value={batchTerm} onChange={setBatchTerm} emptyLabel="Select term…" />
                    </div>
                </div>

                {batchStream && batchTerm && batchStudents.length > 0 && (
                    <div className={cn('mt-4 grid gap-3 border-t border-border/60 pt-4', canManageFees && 'md:grid-cols-3')}>
                        {canManageFees && (<>
                        <div>
                            <label htmlFor="bulk-fee" className="mb-2 block text-xs font-medium text-muted-foreground">Same fee for everyone (KSh)</label>
                            <div className="flex gap-2">
                                <input id="bulk-fee" type="number" inputMode="decimal" min="0" step="0.01" className="input-field min-w-0 flex-1" placeholder="e.g. 45000" value={bulkFee} onChange={e => setBulkFee(e.target.value)} />
                                <button type="button" className="btn-secondary h-11 shrink-0" onClick={() => applyToAll('total', bulkFee)} disabled={!bulkFee}>Apply</button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="bulk-due" className="mb-2 block text-xs font-medium text-muted-foreground">Same due date for everyone</label>
                            <div className="flex gap-2">
                                <input id="bulk-due" type="date" className="input-field min-w-0 flex-1" value={bulkDue} onChange={e => setBulkDue(e.target.value)} />
                                <button type="button" className="btn-secondary h-11 shrink-0" onClick={() => applyToAll('dueDate', bulkDue)} disabled={!bulkDue}>Apply</button>
                            </div>
                        </div>
                        </>)}
                        <div>
                            <label htmlFor="batch-method" className="mb-2 block text-xs font-medium text-muted-foreground">Payments below were received by</label>
                            <select id="batch-method" className="input-field w-full" value={batchMethod} onChange={e => setBatchMethod(e.target.value as FeePaymentMethod)}>
                                {FEE_PAYMENT_METHODS.filter(m => m !== 'PESAPAL').map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {batchMsg && (
                    <div role={batchMsg.type === 'error' ? 'alert' : 'status'} className={cn('mt-4 rounded-xl border p-3 text-sm', batchMsg.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-destructive/30 bg-destructive/5 text-destructive')}>
                        {batchMsg.text}
                    </div>
                )}
            </div>

            {!batchStream || !batchTerm ? (
                <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                    Choose a class and a term to load its students.
                </div>
            ) : batchStudents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                    No active students in this class.
                </div>
            ) : (
                <>
                    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                        <div className="w-full overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th className="min-w-44">Student</th>
                                        <th className="min-w-32">Fee (KSh)</th>
                                        <th className="min-w-28 text-right">Paid so far</th>
                                        <th className="min-w-32">Payment now (KSh)</th>
                                        <th className="min-w-28 text-right">Balance after</th>
                                        <th className="min-w-36">Due date</th>
                                        <th className="min-w-32">Notes</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batchStudents.map(s => {
                                        const entry = batchEntries[s.id];
                                        if (!entry) return null;
                                        const hasTotal = entry.total !== '';
                                        const total = Number(entry.total) || 0;
                                        const paidSoFar = entry.existing?.paidAmount ?? 0;
                                        const paidAfter = paidSoFar + (Number(entry.payNow) || 0);
                                        const balance = total - paidAfter;
                                        const dirty = feeChanged(entry) || Number(entry.payNow) > 0;
                                        return (
                                            <tr key={s.id} className={cn(dirty && 'bg-primary/[0.04]')}>
                                                <td data-label="Student">
                                                    <div className="font-semibold">{s.name}</div>
                                                    <div className="text-[11px] text-muted-foreground">{s.admission || 'No admission no.'}{entry.existing ? '' : ' · not billed yet'}</div>
                                                </td>
                                                <td data-label="Fee (KSh)">
                                                    <input type="number" inputMode="decimal" min="0" step="0.01" className="input-field input-field-sm w-full min-w-24" placeholder="0" aria-label={`Fee for ${s.name}`} value={entry.total} onChange={e => updateBatchEntry(s.id, 'total', e.target.value)} disabled={!canManageFees} />
                                                </td>
                                                <td data-label="Paid so far" className="text-right tabular-nums text-muted-foreground">{paidSoFar.toLocaleString()}</td>
                                                <td data-label="Payment now">
                                                    <input type="number" inputMode="decimal" min="0" step="0.01" className="input-field input-field-sm w-full min-w-24" placeholder="0" aria-label={`Payment received now for ${s.name}`} value={entry.payNow} onChange={e => updateBatchEntry(s.id, 'payNow', e.target.value)} disabled={!canManageFees && !entry.existing} title={!canManageFees && !entry.existing ? 'Not billed yet: the bursar or an admin sets the fee first' : undefined} />
                                                </td>
                                                <td data-label="Balance after" className="text-right font-mono font-semibold tabular-nums" style={{ color: hasTotal ? balanceColor(balance) : undefined }}>
                                                    {hasTotal ? balance.toLocaleString() : '—'}
                                                </td>
                                                <td data-label="Due date">
                                                    <input type="date" className="input-field input-field-sm min-w-32" aria-label={`Due date for ${s.name}`} value={entry.dueDate} onChange={e => updateBatchEntry(s.id, 'dueDate', e.target.value)} disabled={!canManageFees} />
                                                </td>
                                                <td data-label="Notes">
                                                    <input type="text" className="input-field input-field-sm w-full min-w-24" placeholder="Notes" aria-label={`Notes for ${s.name}`} value={entry.notes} onChange={e => updateBatchEntry(s.id, 'notes', e.target.value)} disabled={!canManageFees} />
                                                </td>
                                                <td data-label="Status">{hasTotal ? statusBadge(computeFeeStatus(total, paidAfter)) : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Sticky save bar: the table can be long, the button must stay reachable. */}
                    <div className="sticky bottom-20 z-10 mt-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-4">
                        <p className="text-sm text-muted-foreground" aria-live="polite">
                            {batchChanges.fees === 0 && batchChanges.payments === 0
                                ? 'No changes yet.'
                                : `${batchChanges.fees} fee change(s) · ${batchChanges.payments} payment(s) totalling ${formatCurrency(batchChanges.paymentTotal)}`}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button className="btn-secondary" onClick={loadBatchStudents} disabled={batchSaving}>
                                <RotateCcw className="size-4" aria-hidden="true" />Discard
                            </button>
                            <button className="btn-primary" onClick={saveBatch} disabled={batchSaving || (batchChanges.fees === 0 && batchChanges.payments === 0)}>
                                <Save className="size-4" aria-hidden="true" />{batchSaving ? 'Saving…' : 'Save all'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
