"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import DataTable from '@/components/ui/DataTable';
import { FormField, InputField } from '@/components/ui/FormField';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { errorText, opsFetch } from '@/lib/ops/client';
import { money } from '@/lib/ops/format';

interface Line { voteHeadId: string | null; name: string; billed: number; collected: number; outstanding: number; spent: number }
interface Report { lines: Line[]; overpaid: number }

/** Billed, collected, owed and spent per vote head for a term, and balance reminders by SMS. */
export function VoteHeadReport({ canRemind }: { canRemind: boolean }) {
    const [termId, setTermId] = useState('');
    const [report, setReport] = useState<Report | null>(null);
    const [minBalance, setMinBalance] = useState('1000');
    const [reminder, setReminder] = useState<number | null>(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!termId) return;
        let live = true;
        opsFetch<Report>(`/api/finance/reports/vote-heads?term_id=${termId}`).then(r => { if (live) setReport(r); }).catch(err => toast.error(errorText(err)));
        return () => { live = false; };
    }, [termId]);

    const remind = async (dryRun: boolean) => {
        setSending(true);
        try {
            const r = await opsFetch<{ recipients: number; sent: number; failed: number }>('/api/finance/reminders', { method: 'POST', json: { term_id: termId, min_balance: Number(minBalance) || 1, dry_run: dryRun } });
            if (dryRun) setReminder(r.recipients);
            else { toast.success(`Reminders sent: ${r.sent}${r.failed ? `, ${r.failed} failed` : ''}.`); setReminder(null); }
        } catch (err) { toast.error(errorText(err)); }
        finally { setSending(false); }
    };

    const total = (key: keyof Omit<Line, 'voteHeadId' | 'name'>) => report?.lines.reduce((n, l) => n + l[key], 0) ?? 0;

    return (
        <div className="flex flex-col gap-5">
            <FormField label="Term" htmlFor="vh-term" className="sm:w-72"><LookupSelect id="vh-term" lookup="terms" value={termId} onChange={setTermId} /></FormField>
            {report && (
                <>
                    <DataTable
                        columns={[
                            { key: 'name', header: 'Vote head', render: l => <span className="font-medium">{l.name}</span> },
                            { key: 'billed', header: 'Billed', numeric: true, render: l => money(l.billed) },
                            { key: 'collected', header: 'Collected', numeric: true, render: l => money(l.collected) },
                            { key: 'outstanding', header: 'Owed', numeric: true, render: l => money(l.outstanding) },
                            { key: 'spent', header: 'Spent', numeric: true, hideOnMobile: true, render: l => money(l.spent) },
                        ]}
                        rows={report.lines}
                        rowKey={l => `${l.voteHeadId}-${l.name}`}
                        emptyState="Bill the term to see its vote-head statement."
                    />
                    <p className="text-sm text-muted-foreground">
                        Totals: billed {money(total('billed'))} · collected {money(total('collected'))} · owed {money(total('outstanding'))}
                        {report.overpaid > 0 && ` · overpayments ${money(report.overpaid)}`}
                    </p>
                </>
            )}
            {canRemind && termId && (
                <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5">
                    <div className="sm:flex-1">
                        <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4" aria-hidden />Balance reminders</h3>
                        <p className="text-sm text-muted-foreground">Text the guardians of learners who owe at least this much for the term.</p>
                    </div>
                    <FormField label="Owing at least (KES)" htmlFor="vh-min" className="sm:w-44"><InputField id="vh-min" type="number" min={1} value={minBalance} onChange={e => setMinBalance(e.target.value)} /></FormField>
                    <Button onClick={() => void remind(true)} disabled={sending}>Send reminders</Button>
                </section>
            )}
            <ConfirmDialog
                isOpen={reminder !== null}
                onClose={() => setReminder(null)}
                onConfirm={() => void remind(false)}
                loading={sending}
                title="Send fee reminders?"
                message={reminder === 0 ? 'No guardians match; nothing will be sent.' : `${reminder} guardians will get an SMS with their child's balance.`}
                confirmText="Send"
            />
        </div>
    );
}
