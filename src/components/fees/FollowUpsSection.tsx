"use client";

import React, { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { HandCoins, Loader2, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { jsonBody, requestJson } from '@/lib/api-error-message';
import { schoolToday, SCHOOL_TIME_ZONE } from '@/lib/dates';
import { FOLLOW_UP_NOTES, FOLLOWUPS_URL, type FeeFollowUp, type FollowUpBody, type FollowUpKind } from '@/lib/fee-followups';
import { cn } from '@/lib/utils';
import { PromiseBadge } from './FollowUpBadge';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: FeeFollowUp[] };

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: SCHOOL_TIME_ZONE });

/**
 * Following up what a family owes: each call or meeting noted, and each
 * promise to pay written down with its amount and date. Skulbase checks a
 * promise against the payments, so a broken one shows without anyone
 * remembering to look.
 */
export function FollowUpsSection({ studentId, canWrite, canRemove, onChanged }: {
    studentId: string;
    canWrite: boolean;
    canRemove: boolean;
    /** A follow-up was written or removed: lists elsewhere are stale. */
    onChanged?: () => void;
}) {
    const id = useId();
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [adding, setAdding] = useState(false);
    const [kind, setKind] = useState<FollowUpKind>('NOTE');
    const [note, setNote] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [busy, setBusy] = useState(false);

    const fetchItems = useCallback(async (signal?: AbortSignal) => {
        try {
            const { data } = await requestJson<{ data: FeeFollowUp[] }>(`${FOLLOWUPS_URL}?student_id=${encodeURIComponent(studentId)}`, { cache: 'no-store', signal });
            setLoad({ state: 'ready', items: data });
        } catch (err) {
            if (!signal?.aborted) setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load follow-ups.' });
        }
    }, [studentId]);

    useEffect(() => {
        const controller = new AbortController();
        setLoad({ state: 'loading' });
        void fetchItems(controller.signal);
        return () => controller.abort();
    }, [fetchItems]);

    const reset = () => { setAdding(false); setNote(''); setAmount(''); setDueDate(''); setKind('NOTE'); };

    const problem = kind === 'NOTE'
        ? (note.trim().length < 3 ? 'Say what was said.' : null)
        : !(Number(amount) > 0) ? 'Enter the amount promised.' : !dueDate ? 'Pick the date they will pay by.' : dueDate < schoolToday() ? 'The date has already passed.' : null;

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (problem) return;
        setBusy(true);
        try {
            const body: FollowUpBody = kind === 'NOTE'
                ? { kind, studentId, note: note.trim() }
                : { kind, studentId, note: note.trim(), amount: Number(amount), dueDate };
            const { data } = await requestJson<{ data: FeeFollowUp[] }>(FOLLOWUPS_URL, jsonBody('POST', body));
            setLoad({ state: 'ready', items: data });
            toast.success(kind === 'NOTE' ? 'Note saved.' : 'Promise written down. Skulbase will check it against payments.');
            reset();
            onChanged?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save.');
        } finally {
            setBusy(false);
        }
    };

    const remove = async (item: FeeFollowUp) => {
        try {
            await requestJson(`${FOLLOWUPS_URL}/${item.id}`, { method: 'DELETE' });
            setLoad(l => (l.state === 'ready' ? { state: 'ready', items: l.items.filter(i => i.id !== item.id) } : l));
            onChanged?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not remove it.');
        }
    };

    return (
        <section aria-labelledby={`${id}-title`}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h3 id={`${id}-title`} className="text-sm font-semibold">Follow-ups</h3>
                {canWrite && !adding && (
                    <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => setAdding(true)}>
                        <Plus className="size-3.5" aria-hidden />Add
                    </button>
                )}
            </div>

            {adding && (
                <form onSubmit={save} className="mb-3 flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
                    <div role="radiogroup" aria-label="Kind of follow-up" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                        {([['NOTE', 'Note of a contact'], ['PROMISE', 'Promise to pay']] as const).map(([value, label]) => (
                            <button
                                key={value} type="button" role="radio" aria-checked={kind === value} onClick={() => setKind(value)}
                                className={cn('rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors', kind === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {kind === 'PROMISE' && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                                Amount (KSh)
                                <input type="number" min={1} step="0.01" inputMode="decimal" className="input-field h-9 text-sm tabular-nums" value={amount} onChange={e => setAmount(e.target.value)} required />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                                Will pay by
                                <input type="date" className="input-field h-9 text-sm" min={schoolToday()} value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                            </label>
                        </div>
                    )}
                    {kind === 'NOTE' && (
                        <div className="flex flex-wrap gap-1.5" aria-label="Common notes">
                            {FOLLOW_UP_NOTES.map(n => (
                                <button key={n} type="button" onClick={() => setNote(n)} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:border-primary/50">{n}</button>
                            ))}
                        </div>
                    )}
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        {kind === 'NOTE' ? 'What was said' : 'Note (optional)'}
                        <textarea
                            className="input-field min-h-16 text-sm" maxLength={500} value={note} onChange={e => setNote(e.target.value)}
                            placeholder={kind === 'NOTE' ? 'e.g. Spoke to the mother; she will clear it after harvest.' : 'e.g. Agreed by phone with the father: KSh 5,000 now, the rest in December.'}
                        />
                    </label>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {problem && (note || amount || dueDate) ? <p className="text-xs font-medium text-amber-700 sm:mr-auto dark:text-amber-300">{problem}</p> : null}
                        <button type="button" className="btn-secondary h-9 justify-center" onClick={reset} disabled={busy}>Cancel</button>
                        <button type="submit" className="btn-primary h-9 justify-center" disabled={busy || !!problem}>
                            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Save
                        </button>
                    </div>
                </form>
            )}

            {load.state === 'loading' && <div className="h-14 animate-pulse rounded-2xl bg-muted/60" aria-busy="true" />}
            {load.state === 'error' && <p role="alert" className="text-sm text-destructive">{load.message}</p>}
            {load.state === 'ready' && load.items.length === 0 && !adding && (
                <p className="text-sm text-muted-foreground">No follow-ups yet.</p>
            )}
            {load.state === 'ready' && load.items.length > 0 && (
                <ul className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/70">
                    {load.items.map(item => (
                        <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
                            <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl', item.kind === 'PROMISE' ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-muted text-muted-foreground')} aria-hidden>
                                {item.kind === 'PROMISE' ? <HandCoins className="size-4" /> : <MessageSquare className="size-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                {item.promise && <PromiseBadge promise={item.promise} className="mb-1" />}
                                {item.note && <p className="text-sm break-words">{item.note}</p>}
                                <p className="text-xs text-muted-foreground">{when(item.createdAt)}{item.createdByName ? ` · ${item.createdByName}` : ''}</p>
                            </div>
                            {canRemove && (
                                <button type="button" className="btn-icon text-muted-foreground hover:text-destructive" aria-label="Remove this follow-up" title="Remove" onClick={() => void remove(item)}>
                                    <Trash2 className="size-4" aria-hidden />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
