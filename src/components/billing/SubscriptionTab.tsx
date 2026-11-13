"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CircleCheck, Receipt, Smartphone, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadError } from '@/components/ui/LoadError';
import { jsonBody, requestJson } from '@/lib/api-error-message';
import { formatIsoDate } from '@/lib/dates';
import { YEAR_DISCOUNT, cyclePrice, formatKes } from '@/lib/pricing';
import { BILLING_URL, STATE_COPY, hasInstructions, type BillingState, type SchoolInvoice } from '@/lib/school-billing';
import { cn } from '@/lib/utils';
import { useSchoolBilling } from './useSchoolBilling';

const TONE = {
    good: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    warn: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    bad: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
    muted: 'bg-muted text-muted-foreground',
} as const;

const day = (iso: string) => formatIsoDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });

export function StatusPill({ state }: { state: BillingState }) {
    const copy = STATE_COPY[state.kind];
    return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[copy.tone])}>{copy.label}</span>;
}

/** When it is due, or when it was paid, in a line. */
function invoiceLine(i: SchoolInvoice): string {
    if (i.status === 'PAID') return `Paid${i.paidAt ? ` ${day(i.paidAt.slice(0, 10))}` : ''}${i.paymentRef ? ` · ${i.paymentRef}` : ''}`;
    if (i.status === 'FREE') return 'Free';
    if (i.status === 'VOID') return 'Cancelled';
    return `Due ${day(i.dueDate)}`;
}

/** Settings → Subscription: what the school owes Skulbase this term, how to pay, and past invoices. */
export function SubscriptionTab() {
    const { load, reload } = useSchoolBilling();
    const [busy, setBusy] = useState(false);

    if (load.state === 'loading') return <div className="skeleton-bone h-64 rounded-2xl" />;
    if (load.state === 'error') return <LoadError title="Couldn't load the subscription" message={load.message} onRetry={() => void reload()} />;

    const { state, invoices, instructions, schoolName } = load.data;
    const current = state.kind === 'none' ? null : state.invoice;
    const unpaid = current?.status === 'DUE' ? current : null;

    const payYear = async (invoice: SchoolInvoice) => {
        setBusy(true);
        try {
            await requestJson(`${BILLING_URL}/year`, jsonBody('POST', { invoice_id: invoice.id }));
            toast.success('Changed to the year.');
            await reload();
        } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not change it.'); }
        finally { setBusy(false); }
    };

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                {current ? (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold">{current.label}</h3>
                            <StatusPill state={state} />
                        </div>
                        <p className="mt-3 font-heading text-4xl font-bold tabular-nums">{formatKes(current.amount)}</p>
                        <p className="text-sm text-muted-foreground">{current.plan} · {current.learners.toLocaleString()} learners · {invoiceLine(current)}</p>
                        {(state.kind === 'due' || state.kind === 'overdue') && (
                            <p className={cn('mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm', state.kind === 'overdue' ? TONE.bad : TONE.warn)}>
                                <CalendarClock className="size-4 shrink-0" aria-hidden />Read-only from {day(state.lockOn)} if unpaid.
                            </p>
                        )}
                        {state.kind === 'locked' && (
                            <p className={cn('mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm', TONE.bad)}>
                                <TriangleAlert className="size-4 shrink-0" aria-hidden />Read-only until paid.
                            </p>
                        )}
                        {unpaid?.cycle === 'TERM' && (
                            <Button variant="outline" className="mt-4" disabled={busy} onClick={() => void payYear(unpaid)}>
                                Pay the year instead: {formatKes(cyclePrice(unpaid.learners, 'year'))} (save {Math.round(YEAR_DISCOUNT * 100)}%)
                            </Button>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">Set the current term in Academic calendar to see this term’s invoice.</p>
                )}
            </section>

            {unpaid && (
                <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 sm:p-6">
                    <h3 className="flex items-center gap-2 text-sm font-bold"><Smartphone className="size-4 text-primary" aria-hidden />Pay by M-Pesa or bank</h3>
                    {instructions && hasInstructions(instructions) ? (
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            {instructions.paybill && <div><dt className="text-xs text-muted-foreground">Paybill</dt><dd className="font-semibold tabular-nums">{instructions.paybill}</dd></div>}
                            {instructions.paybill && <div><dt className="text-xs text-muted-foreground">Account</dt><dd className="font-semibold">{instructions.account || schoolName}</dd></div>}
                            {instructions.till && <div><dt className="text-xs text-muted-foreground">Till</dt><dd className="font-semibold tabular-nums">{instructions.till}</dd></div>}
                            <div><dt className="text-xs text-muted-foreground">Amount</dt><dd className="font-semibold tabular-nums">{formatKes(unpaid.amount)}</dd></div>
                            {instructions.bank && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Bank</dt><dd className="font-semibold whitespace-pre-line">{instructions.bank}</dd></div>}
                            {instructions.phone && <div><dt className="text-xs text-muted-foreground">Questions</dt><dd className="font-semibold"><a href={`tel:${instructions.phone}`}>{instructions.phone}</a></dd></div>}
                        </dl>
                    ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Payment details coming soon.</p>
                    )}
                </section>
            )}

            {invoices.length > 0 && (
                <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Receipt className="size-4" aria-hidden />Invoices</h3>
                    <ul className="divide-y divide-border/60">
                        {invoices.filter(i => i.status !== 'VOID').map(i => (
                            <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                                {i.status === 'PAID' || i.status === 'FREE' ? <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden /> : <CalendarClock className="size-4 shrink-0 text-amber-600" aria-hidden />}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">{i.label}</span>
                                    <span className="block text-xs text-muted-foreground">{invoiceLine(i)}</span>
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums">{formatKes(i.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
