"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Ban, BookOpenCheck, ChevronLeft, ChevronRight, CircleAlert, Coins, History, Inbox, Loader2, ShieldCheck } from 'lucide-react';
import { CardHeading, DataTable, LoadError, StatTile } from '@/components/ui';
import { jsonBody, requestJson } from '@/lib/api-error-message';
import { addDays, formatIsoDate, schoolTimeOf, schoolToday, SCHOOL_TIME_ZONE } from '@/lib/dates';
import { formatKsh, methodLabel } from '@/lib/fee-account';
import { DAYBOOK_URL, type DayBook, type DayBookDay, type DayBookPayment, type DayReviewBody } from '@/lib/fee-daybook';
import { typedAccount } from '@/lib/fee-reconcile';
import { cn } from '@/lib/utils';
import { MoneyBars } from './MoneyBars';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; body: DayBook };

const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
const longDay = (day: string) => formatIsoDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const signedAt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: SCHOOL_TIME_ZONE });

/** Where a day stands: signed off, changed since, waiting, or nothing to sign. */
function dayState(d: Pick<DayBookDay, 'count' | 'reviewed' | 'changed'>): { label: string; dot: string } {
    if (d.changed) return { label: 'Changed since it was reviewed', dot: 'bg-amber-500' };
    if (d.reviewed) return { label: 'Reviewed', dot: 'bg-emerald-500' };
    if (d.count > 0) return { label: 'Not reviewed', dot: 'bg-muted-foreground/40' };
    return { label: 'No payments', dot: 'bg-transparent' };
}

/**
 * The day book: one day's money in, by method and by who recorded it, every
 * payment (voided ones too), and the day's sign-off. Whoever records the
 * money should not be the only one who checks it; a reviewer who recorded
 * some of it ticks that they are checking their own entries.
 */
export function DayBookPanel({ canReview }: { canReview: boolean }) {
    const today = schoolToday();
    const [day, setDay] = useState(today);
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [note, setNote] = useState('');
    const [ownEntries, setOwnEntries] = useState(false);
    const [signing, setSigning] = useState(false);

    const fetchDay = useCallback(async (signal?: AbortSignal) => {
        setLoad({ state: 'loading' });
        try {
            const { data } = await requestJson<{ data: DayBook }>(`${DAYBOOK_URL}?day=${day}`, { cache: 'no-store', signal });
            setLoad({ state: 'ready', body: data });
        } catch (err) {
            if (signal?.aborted) return;
            setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load the day book.' });
        }
    }, [day]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchDay(controller.signal);
        setNote('');
        setOwnEntries(false);
        return () => controller.abort();
    }, [fetchDay]);

    const sign = async () => {
        setSigning(true);
        try {
            const body: DayReviewBody = { day, note: note.trim() || null, ownEntries };
            const { data } = await requestJson<{ data: DayBook }>(DAYBOOK_URL, jsonBody('POST', body));
            setLoad({ state: 'ready', body: data });
            setNote('');
            toast.success(`${longDay(day)} marked as reviewed.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not sign the day off.');
        } finally {
            setSigning(false);
        }
    };

    const book = load.state === 'ready' ? load.body : null;

    return (
        <div className="flex flex-col gap-4">
            <section aria-label="Day" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <CardHeading
                        className="mb-0"
                        icon={BookOpenCheck}
                        hue="teal"
                        title="Day book"
                        description="Each day’s money in, and who looked it over. Someone other than the person who recorded the money signs each day off."
                    />
                    <div className="flex items-center gap-1.5 lg:shrink-0">
                        <button type="button" className="btn-icon" aria-label="Day before" onClick={() => setDay(d => addDays(d, -1))}>
                            <ChevronLeft className="size-4" />
                        </button>
                        <input
                            type="date" className="input-field h-9 w-full min-w-0 sm:w-44" aria-label="Day" max={today} value={day}
                            onChange={e => e.target.value && e.target.value <= today && setDay(e.target.value)}
                        />
                        <button type="button" className="btn-icon" aria-label="Next day" disabled={day >= today} onClick={() => setDay(d => (d < today ? addDays(d, 1) : d))}>
                            <ChevronRight className="size-4" />
                        </button>
                        {day !== today && <button type="button" className="btn-secondary h-9 px-3" onClick={() => setDay(today)}>Today</button>}
                    </div>
                </div>
                {book && (
                    <ol aria-label="Recent days" className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {book.recent.map(d => {
                            const state = dayState(d);
                            const on = d.day === day;
                            return (
                                <li key={d.day} className="shrink-0">
                                    <button
                                        type="button"
                                        aria-current={on ? 'date' : undefined}
                                        title={`${longDay(d.day)} · ${state.label}`}
                                        onClick={() => setDay(d.day)}
                                        className={cn(
                                            // relative: keeps the screen-reader text inside the scrolling strip, not widening the page.
                                            'relative flex w-16 flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-center transition-colors',
                                            on ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40',
                                        )}
                                    >
                                        <span className={cn('text-[11px]', on ? 'text-background/80' : 'text-muted-foreground')}>{formatIsoDate(d.day, { weekday: 'short', day: 'numeric' })}</span>
                                        <span className="text-xs font-semibold tabular-nums">{d.count > 0 ? compact.format(d.amount) : '—'}</span>
                                        <span className={cn('size-1.5 rounded-full', state.dot)} aria-hidden />
                                        <span className="sr-only">{state.label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>

            {load.state === 'error' && <LoadError title="Couldn't load the day book" message={load.message} onRetry={() => void fetchDay()} />}
            {load.state === 'loading' && <div className="skeleton-bone h-48 rounded-2xl" aria-busy="true" aria-label="Loading the day" />}

            {book && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile icon={Coins} label="Received" value={formatKsh(book.received.amount)} hint={plural(book.received.count, 'payment')} tone="good" />
                        <StatTile icon={Ban} label="Voided" value={formatKsh(book.voided.amount)} hint={plural(book.voided.count, 'payment')} tone={book.voided.count > 0 ? 'warn' : 'default'} />
                        <StatTile icon={Inbox} label="Not matched" value={formatKsh(book.unmatched.amount)} hint={book.unmatched.count > 0 ? `${plural(book.unmatched.count, 'payment')} to assign` : 'all matched'} tone={book.unmatched.count > 0 ? 'warn' : 'default'} />
                        <StatTile icon={History} label="Entered late" value={book.recordedLate} hint="entered on a later day" tone={book.recordedLate > 0 ? 'warn' : 'default'} />
                    </div>

                    <ReviewCard
                        book={book}
                        canReview={canReview}
                        note={note}
                        onNote={setNote}
                        ownEntries={ownEntries}
                        onOwnEntries={setOwnEntries}
                        signing={signing}
                        onSign={() => void sign()}
                    />

                    <div className="grid gap-3 lg:grid-cols-2">
                        <MoneyBars title="By method" rows={book.byMethod} />
                        <MoneyBars title="By who recorded it" rows={book.byRecorder} barClassName="bg-sky-500" />
                    </div>

                    <section aria-label={`Payments on ${longDay(day)}`}>
                        <DataTable<DayBookPayment>
                            columns={[
                                { key: 'time', header: 'Time', render: p => <span className="text-xs tabular-nums text-muted-foreground">{schoolTimeOf(p.paidAt).slice(0, 5)}</span> },
                                {
                                    key: 'learner', header: 'Learner',
                                    render: p => p.learner ? (
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold">{p.learner}</div>
                                            {p.admissionNumber && <div className="text-[11px] text-muted-foreground">{p.admissionNumber}</div>}
                                        </div>
                                    ) : (
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">Not matched</div>
                                            <div className="truncate text-[11px] text-muted-foreground">{typedAccount(p.unmatchedReference) ? `typed “${typedAccount(p.unmatchedReference)}”` : 'no account number'}</div>
                                        </div>
                                    ),
                                },
                                { key: 'receipt', header: 'Receipt', hideOnMobile: true, render: p => <span className="font-mono text-xs">{p.receiptNumber}</span> },
                                {
                                    key: 'method', header: 'Method',
                                    render: p => (
                                        <span className="flex flex-col">
                                            <span className="text-sm">{methodLabel(p.method)}</span>
                                            {p.code && <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'amount', header: 'Amount', numeric: true,
                                    render: p => (
                                        <span className="flex flex-col items-end">
                                            <span className={cn('font-semibold', p.voided && 'text-muted-foreground line-through')}>{formatKsh(p.amount)}</span>
                                            {p.voided && <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">Voided{p.voidedByName ? ` by ${p.voidedByName}` : ''}</span>}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'recordedBy', header: 'Recorded by', hideOnMobile: true,
                                    render: p => (
                                        <span className="flex flex-col items-start gap-0.5">
                                            <span className="text-xs text-muted-foreground">{p.automatic ? 'Came in on its own' : p.recordedByName ?? '—'}</span>
                                            {p.recordedLateOn && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">Entered {formatIsoDate(p.recordedLateOn, { day: 'numeric', month: 'short' })}</span>}
                                        </span>
                                    ),
                                },
                            ]}
                            rows={book.payments}
                            rowKey={p => p.id}
                            mobileTitleKey="learner"
                            emptyState={<p className="py-6 text-sm">No payments on {longDay(day)}.</p>}
                        />
                    </section>
                </>
            )}
        </div>
    );
}

/** The day's sign-off: who looked it over and when, or the form to do it. */
function ReviewCard({ book, canReview, note, onNote, ownEntries, onOwnEntries, signing, onSign }: {
    book: DayBook;
    canReview: boolean;
    note: string;
    onNote: (v: string) => void;
    ownEntries: boolean;
    onOwnEntries: (v: boolean) => void;
    signing: boolean;
    onSign: () => void;
}) {
    const { review, changedSinceReview } = book;
    const hasPayments = book.payments.length > 0;
    const canSign = canReview && hasPayments && (!review || changedSinceReview);
    const tone = changedSinceReview ? 'border-amber-500/40 bg-amber-500/[0.06]' : review ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-border/70 bg-card';

    return (
        <section aria-label="Sign-off" className={cn('flex flex-col gap-3 rounded-2xl border p-4 shadow-sm', tone)}>
            {review ? (
                <div className="flex items-start gap-2.5 text-sm">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                    <div className="min-w-0">
                        <p>
                            Reviewed by <span className="font-semibold">{review.reviewedByName ?? 'a former staff member'}</span>, {signedAt(review.reviewedAt)}:{' '}
                            {formatKsh(review.total)} in {plural(review.payments, 'payment')} when signed.
                        </p>
                        {review.ownEntries && <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">They recorded some of these payments themselves.</p>}
                        {review.note && <p className="mt-1 text-xs text-muted-foreground">“{review.note}”</p>}
                    </div>
                </div>
            ) : (
                <p className="flex items-center gap-2 text-sm">
                    <CircleAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {hasPayments ? 'Not reviewed yet.' : 'Nothing to review: no payments on this day.'}
                </p>
            )}

            {changedSinceReview && (
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Changed since: a payment was recorded or voided after the sign-off. It is now {formatKsh(book.received.amount)} in {plural(book.received.count, 'payment')}. Look it over again.
                </p>
            )}

            {canSign && (
                <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Note (optional)
                        <input
                            className="input-field h-9 text-sm" maxLength={500} value={note} onChange={e => onNote(e.target.value)}
                            placeholder="e.g. Cash KSh 12,000 banked at Equity, slip 004512"
                        />
                    </label>
                    {book.viewerRecorded && (
                        <label className="flex items-start gap-2 rounded-xl bg-amber-500/[0.08] p-3 text-sm">
                            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-amber-600" checked={ownEntries} onChange={e => onOwnEntries(e.target.checked)} />
                            <span>
                                I recorded some of these payments and I am checking my own entries.
                                <span className="block text-xs text-muted-foreground">Better: ask someone else (the head or a second bursar) to sign this day.</span>
                            </span>
                        </label>
                    )}
                    <button type="button" className="btn-primary self-stretch sm:self-start" disabled={signing || (book.viewerRecorded && !ownEntries)} onClick={onSign}>
                        {signing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
                        {review ? 'Review again' : 'Mark day as reviewed'}
                    </button>
                </div>
            )}

            {!canReview && hasPayments && !review && <p className="text-xs text-muted-foreground">The bursar or the head signs each day off.</p>}
        </section>
    );
}
