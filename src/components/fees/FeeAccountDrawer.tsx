"use client";

import React, { useEffect, useState } from 'react';
import { ChevronDown, CircleDollarSign, Download, FileText, MessageSquare, Phone, Receipt, UserRound } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error-message';
import {
    balanceState, feeAccountUrl, feeReceiptUrl, feeStatementUrl, formatKsh, methodLabel,
    type FeeAccount, type FeeAccountLearner, type FeeAccountTerm,
} from '@/lib/fee-account';

interface FeeAccountDrawerProps {
    /** The learner to show; null keeps the drawer closed. */
    studentId: string | null;
    /** Shown in the title while the account loads. */
    studentName?: string | null;
    onClose: () => void;
    /** Records a payment against one of the learner's terms; hidden when omitted. */
    onRecordPayment?: (term: FeeAccountTerm, learner: FeeAccountLearner) => void;
    /** Bumped by the page after a payment, so an open account reloads. */
    version?: number;
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; account: FeeAccount };

const STATE_TONE = {
    owing: 'text-amber-700 dark:text-amber-400',
    credit: 'text-sky-700 dark:text-sky-400',
    clear: 'text-emerald-700 dark:text-emerald-400',
} as const;

/** "KSh 6,000 owed" / "KSh 2,000 credit" / "Cleared" */
function balanceLabel(balance: number): string {
    const state = balanceState(balance);
    if (state === 'owing') return `${formatKsh(balance)} owed`;
    if (state === 'credit') return `${formatKsh(-balance)} credit`;
    return 'Cleared';
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A learner's whole fee account in one place: what they owe across every
 * term (arrears carried forward), who to call about it, each term's bill,
 * the payments with their receipts, and the statement to hand a parent.
 */
export function FeeAccountDrawer({ studentId, studentName, onClose, onRecordPayment, version = 0 }: FeeAccountDrawerProps) {
    const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
    const key = `${studentId}|${version}`;
    const load: Load = result?.key === key ? result.load : { status: 'loading' };

    useEffect(() => {
        if (!studentId) return;
        const controller = new AbortController();
        fetch(feeAccountUrl(studentId), { cache: 'no-store', signal: controller.signal })
            .then(async res => {
                const body: unknown = await res.json().catch(() => null);
                if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not load this fee account.'));
                setResult({ key, load: { status: 'ready', account: body as FeeAccount } });
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setResult({ key, load: { status: 'error', message: err instanceof Error ? err.message : 'Could not load this fee account.' } });
            });
        return () => controller.abort();
    }, [studentId, key]);

    const account = load.status === 'ready' ? load.account : null;
    // A payment clears the oldest term still owing first, as arrears are paid before the current bill.
    const payTerm = account ? account.terms.find(t => t.balance > 0) ?? account.terms[account.terms.length - 1] ?? null : null;

    return (
        <Drawer
            isOpen={!!studentId}
            onClose={onClose}
            title={account?.learner.name ?? studentName ?? 'Fee account'}
            size="lg"
            footer={studentId ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <a href={feeStatementUrl(studentId)} target="_blank" rel="noopener noreferrer" className="btn-secondary justify-center">
                        <FileText className="size-4" aria-hidden="true" />Statement
                    </a>
                    {onRecordPayment && account && payTerm && (
                        <button type="button" className="btn-primary justify-center" onClick={() => onRecordPayment(payTerm, account.learner)}>
                            <CircleDollarSign className="size-4" aria-hidden="true" />Record payment{account.terms.length > 1 ? ` · ${payTerm.termName}` : ''}
                        </button>
                    )}
                </div>
            ) : undefined}
        >
            {load.status === 'loading' && <div className="space-y-3" aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/60" />)}</div>}
            {load.status === 'error' && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{load.message}</p>}
            {account && <AccountBody account={account} />}
        </Drawer>
    );
}

function AccountBody({ account }: { account: FeeAccount }) {
    const { learner, totals } = account;
    const state = balanceState(totals.balance);
    // Arrears: what earlier terms still owe, on top of the latest term.
    const latest = account.terms[account.terms.length - 1];
    const arrears = latest ? Math.round((totals.balance - latest.balance) * 100) / 100 : 0;

    return (
        <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">
                {[learner.admissionNumber && `Adm. ${learner.admissionNumber}`, learner.className, learner.residence === 'BOARDER' ? 'Boarder' : 'Day scholar'].filter(Boolean).join(' · ')}
            </p>

            {/* Balance across every term */}
            <section className={cn('rounded-2xl border p-4', state === 'owing' ? 'border-amber-500/30 bg-amber-500/[0.06]' : state === 'credit' ? 'border-sky-500/30 bg-sky-500/[0.06]' : 'border-emerald-500/30 bg-emerald-500/[0.06]')}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{state === 'credit' ? 'In credit' : 'Balance due'}</p>
                <p className={cn('mt-1 font-display text-3xl font-bold tabular-nums', STATE_TONE[state])}>{state === 'clear' ? 'Cleared' : formatKsh(Math.abs(totals.balance))}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Billed</dt><dd className="font-semibold tabular-nums">{formatKsh(totals.billed)}</dd></div>
                    <div><dt className="text-muted-foreground">Paid</dt><dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatKsh(totals.paid)}</dd></div>
                    <div>
                        <dt className="text-muted-foreground">Arrears</dt>
                        <dd className={cn('font-semibold tabular-nums', arrears > 0 && 'text-amber-700 dark:text-amber-400')}>{arrears > 0 ? formatKsh(arrears) : '—'}</dd>
                    </div>
                </dl>
                {arrears > 0 && latest && <p className="mt-2 text-xs text-muted-foreground">Earlier terms still owe {formatKsh(arrears)}, carried into {latest.termName}.</p>}
            </section>

            <Guardians account={account} />

            {/* Terms, newest first */}
            <section>
                <h3 className="mb-2 text-sm font-semibold">By term</h3>
                {account.terms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing billed yet.</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {[...account.terms].reverse().map(t => <TermRow key={t.feeId} term={t} />)}
                    </ul>
                )}
            </section>

            {/* Payments, newest first */}
            <section>
                <h3 className="mb-2 text-sm font-semibold">Payments</h3>
                {account.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments yet.</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/70">
                        {account.payments.map(p => (
                            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" aria-hidden="true"><Receipt className="size-4" /></span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tabular-nums">{formatKsh(p.amount)} <span className="font-normal text-muted-foreground">· {methodLabel(p.method)}{p.reference ? ` ${p.reference}` : ''}</span></p>
                                    <p className="truncate text-xs text-muted-foreground">{shortDate(p.paidAt)} · {p.termName} · {p.receiptNumber}{p.payerName ? ` · ${p.payerName}` : ''}</p>
                                </div>
                                <a href={feeReceiptUrl(p.id)} target="_blank" rel="noopener noreferrer" className="btn-icon text-muted-foreground hover:text-foreground" aria-label={`Receipt ${p.receiptNumber}`} title="Receipt">
                                    <Download className="size-4" aria-hidden="true" />
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function TermRow({ term }: { term: FeeAccountTerm }) {
    const [open, setOpen] = useState(false);
    const state = balanceState(term.balance);
    const paidPct = term.billed > 0 ? Math.min(100, Math.round((term.paid / term.billed) * 100)) : 100;
    const hasDetail = term.lines.length > 0 || term.awards > 0 || !!term.notes;
    return (
        <li className="rounded-2xl border border-border/70">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                disabled={!hasDetail}
                aria-expanded={hasDetail ? open : undefined}
                className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-default"
            >
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{term.termName}{term.yearName ? ` · ${term.yearName}` : ''}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatKsh(term.paid)} of {formatKsh(term.billed)}{term.dueDate ? ` · due ${shortDate(term.dueDate)}` : ''}</p>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className={cn('block h-full rounded-full', state === 'owing' ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${paidPct}%` }} />
                    </span>
                </div>
                <span className={cn('shrink-0 text-sm font-semibold tabular-nums', STATE_TONE[state])}>{balanceLabel(term.balance)}</span>
                {hasDetail && <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />}
            </button>
            {open && hasDetail && (
                <dl className="space-y-1 border-t border-border/60 px-3 py-2.5 text-xs">
                    {term.lines.map(l => (
                        <div key={l.description} className="flex justify-between gap-3"><dt className="text-muted-foreground">{l.description}</dt><dd className="tabular-nums">{formatKsh(l.amount)}</dd></div>
                    ))}
                    {term.awards > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Bursary / waiver</dt><dd className="tabular-nums text-emerald-700 dark:text-emerald-400">− {formatKsh(term.awards)}</dd></div>}
                    {term.notes && <p className="pt-1 text-muted-foreground">{term.notes}</p>}
                </dl>
            )}
        </li>
    );
}

function Guardians({ account }: { account: FeeAccount }) {
    if (account.guardians.length === 0) {
        return (
            <section className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-3 text-sm">
                <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">No parent or guardian on record, so reminders can&apos;t reach anyone. Add one from <strong className="text-foreground">Parent accounts</strong> or the learner&apos;s details.</p>
            </section>
        );
    }
    return (
        <section>
            <h3 className="mb-2 text-sm font-semibold">Parents &amp; guardians</h3>
            <ul className="flex flex-col gap-2">
                {account.guardians.map(g => (
                    <li key={g.linkId || g.name} className="flex items-center gap-3 rounded-2xl border border-border/70 p-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{g.name}{g.relationship ? <span className="font-normal text-muted-foreground"> · {g.relationship.charAt(0) + g.relationship.slice(1).toLowerCase()}</span> : null}</p>
                            <p className="text-xs text-muted-foreground">{g.phone ?? 'No phone'}{g.linkId ? (g.hasAccount ? ' · uses the parent portal' : ' · invited to the parent portal') : ' · from the learner’s details'}</p>
                        </div>
                        {g.phone && (
                            <span className="flex shrink-0 gap-1">
                                <a href={`tel:${g.phone}`} className="btn-icon text-muted-foreground hover:text-foreground" aria-label={`Call ${g.name}`} title="Call"><Phone className="size-4" aria-hidden="true" /></a>
                                <a href={`sms:${g.phone}`} className="btn-icon text-muted-foreground hover:text-foreground" aria-label={`Text ${g.name}`} title="Text"><MessageSquare className="size-4" aria-hidden="true" /></a>
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
