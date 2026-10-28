"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, MessageSquare, Phone, UsersRound, Wallet } from 'lucide-react';
import { DataTable, LoadError, StatTile } from '@/components/ui';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import { formatKsh, type FeeReminderSummary } from '@/lib/fee-account';
import { daysSince, type Defaulter, type DefaultersResponse } from '@/lib/fee-reports';

interface DefaultersPanelProps {
    streams: readonly { id: string; full_name: string }[];
    /** The term reminders go out for: learners billed in it who still owe. */
    termId: string;
    canRemind: boolean;
    onOpenAccount: (studentId: string, name: string) => void;
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; body: DefaultersResponse };

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function overdueTone(days: number): string {
    if (days > 60) return 'bg-red-500/12 text-red-700 dark:text-red-400';
    if (days > 0) return 'bg-amber-500/12 text-amber-800 dark:text-amber-300';
    return 'bg-muted text-muted-foreground';
}

/**
 * Who owes the school, arrears included, most owed first: with how long it
 * has been due, when they last paid and the parent to call. Opens the
 * learner's account; exports to Excel; texts reminders.
 */
export function DefaultersPanel({ streams, termId, canRemind, onOpenAccount }: DefaultersPanelProps) {
    const confirm = useConfirm();
    const [streamId, setStreamId] = useState('');
    const [minBalance, setMinBalance] = useState('1');
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState<{ key: string; load: Load } | null>(null);
    const [sending, setSending] = useState(false);
    const query = new URLSearchParams({ min_balance: String(Math.max(1, Number(minBalance) || 1)), ...(streamId ? { grade_stream_id: streamId } : {}) }).toString();
    const key = `${query}|${reload}`;
    const load: Load = result?.key === key ? result.load : { status: 'loading' };

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetch(`/api/school/fees/defaulters?${query}`, { cache: 'no-store', signal: controller.signal })
                .then(async res => {
                    const body: unknown = await res.json().catch(() => null);
                    if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not load who owes.'));
                    setResult({ key, load: { status: 'ready', body: body as DefaultersResponse } });
                })
                .catch((err: unknown) => {
                    if (!controller.signal.aborted) setResult({ key, load: { status: 'error', message: err instanceof Error ? err.message : 'Could not load who owes.' } });
                });
        }, 250);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [key, query]);

    const remind = async () => {
        const run = async (dryRun: boolean) => {
            const res = await fetch('/api/finance/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ term_id: termId, min_balance: Math.max(1, Number(minBalance) || 1), dry_run: dryRun, ...(streamId ? { grade_stream_id: streamId } : {}) }),
            });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(body, 'Could not send reminders.'));
            return body as FeeReminderSummary;
        };
        setSending(true);
        try {
            const preview = await run(true);
            if (preview.recipients === 0) {
                toast.info(preview.without_phone ? `Nobody to text: ${preview.without_phone} owing learners have no parent phone. Link parents under Parent accounts.` : 'Nobody owing has a parent to text.');
                return;
            }
            const ok = await confirm({
                title: 'Text fee reminders?',
                message: `${preview.recipients} ${preview.recipients === 1 ? 'SMS' : 'SMSes'} to the parents of ${preview.learners} ${preview.learners === 1 ? 'learner' : 'learners'}, each with their balance.${preview.without_phone ? ` ${preview.without_phone} more owe but have no parent phone.` : ''}`,
                confirmText: 'Send reminders',
            });
            if (!ok) return;
            const sent = await run(false);
            toast.success(`Reminders sent: ${sent.sent}${sent.failed ? `, ${sent.failed} failed` : ''}.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not send reminders.');
        } finally {
            setSending(false);
        }
    };

    const rows = load.status === 'ready' ? load.body.data : [];
    const noPhone = rows.filter(r => !r.guardianPhone).length;

    return (
        <div className="flex flex-col gap-4">
            <section aria-label="Filters" className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 md:grid-cols-[minmax(0,1fr)_11rem_auto_auto]">
                <select className="input-field col-span-2 md:col-span-1" aria-label="Class" value={streamId} onChange={e => setStreamId(e.target.value)}>
                    <option value="">All classes</option>
                    {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <label className="relative">
                    <span className="sr-only">Owing at least (KSh)</span>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Over KSh</span>
                    <input type="number" min={1} inputMode="numeric" className="input-field w-full pl-[4.5rem]" value={minBalance} onChange={e => setMinBalance(e.target.value)} />
                </label>
                <a href={`/api/school/fees/defaulters?${query}&format=xlsx`} className="btn-secondary justify-center">
                    <Download className="size-4" aria-hidden="true" />Excel
                </a>
                {canRemind && termId && (
                    <button type="button" className="btn-primary col-span-2 justify-center md:col-span-1" onClick={() => void remind()} disabled={sending || rows.length === 0}>
                        <MessageSquare className="size-4" aria-hidden="true" />{sending ? 'Checking…' : 'Text reminders'}
                    </button>
                )}
            </section>

            {load.status === 'error' ? (
                <LoadError title="Couldn't load who owes" message={load.message} onRetry={() => setReload(n => n + 1)} />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        <StatTile icon={UsersRound} label="Learners owing" value={load.status === 'ready' ? rows.length : '—'} tone={rows.length > 0 ? 'warn' : 'good'} />
                        <StatTile icon={Wallet} label="Total owed" value={load.status === 'ready' ? formatKsh(load.body.totalOwed) : '—'} hint="arrears included" tone={rows.length > 0 ? 'warn' : 'good'} />
                        <StatTile icon={Phone} label="No parent phone" value={load.status === 'ready' ? noPhone : '—'} hint={noPhone > 0 ? 'link parents to remind them' : 'everyone reachable'} tone={noPhone > 0 ? 'bad' : 'good'} className="col-span-2 md:col-span-1" />
                    </div>
                    <DataTable<Defaulter>
                        rows={rows}
                        rowKey={r => r.studentId}
                        loading={load.status === 'loading'}
                        onRowClick={r => onOpenAccount(r.studentId, r.name)}
                        mobileTitleKey="learner"
                        columns={[
                            {
                                key: 'learner', header: 'Learner',
                                render: r => (
                                    <div className="min-w-0">
                                        <div className="truncate font-semibold">{r.name}</div>
                                        <div className="truncate text-xs text-muted-foreground">{[r.admissionNumber, r.className].filter(Boolean).join(' · ')}</div>
                                    </div>
                                ),
                            },
                            { key: 'owed', header: 'Owed', numeric: true, render: r => <span className="font-semibold text-amber-700 dark:text-amber-400">{formatKsh(r.owed)}</span> },
                            {
                                key: 'due', header: 'Overdue',
                                render: r => {
                                    const days = daysSince(r.oldestDue);
                                    return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', overdueTone(days))}>{r.oldestDue ? (days > 0 ? `${days} days` : 'Not yet due') : 'No due date'}{r.termsOwing > 1 ? ` · ${r.termsOwing} terms` : ''}</span>;
                                },
                            },
                            { key: 'last', header: 'Last paid', hideOnMobile: true, render: r => <span className="text-xs text-muted-foreground">{r.lastPaymentAt ? shortDate(r.lastPaymentAt) : 'Never'}</span> },
                            {
                                key: 'parent', header: 'Parent',
                                render: r => r.guardianPhone ? (
                                    <a href={`tel:${r.guardianPhone}`} onClick={e => e.stopPropagation()} className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                                        <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{r.guardianName ? `${r.guardianName} · ` : ''}{r.guardianPhone}</span>
                                    </a>
                                ) : <span className="text-xs font-medium text-red-700 dark:text-red-400">No phone</span>,
                            },
                        ]}
                        emptyState={<p className="text-sm">Nobody owes over this amount{streamId ? ' in this class' : ''}.</p>}
                    />
                </>
            )}
        </div>
    );
}
