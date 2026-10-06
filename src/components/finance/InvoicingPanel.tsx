"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowRight, Eye, Layers, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import DataTable from '@/components/ui/DataTable';
import { FormField } from '@/components/ui/FormField';
import { StatTile } from '@/components/ui/StatTile';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { errorText, opsFetch } from '@/lib/ops/client';
import { admissionNo, money, studentName } from '@/lib/ops/format';
import { BILL_TERM_WARNING, type Invoice, type InvoiceSummary as Summary } from '@/lib/ops/forms/finance';

/** Bill a term from the fee structures, previewing totals first. */
export function InvoicingPanel({ canManage }: { canManage: boolean }) {
    const [termId, setTermId] = useState('');
    const [streamId, setStreamId] = useState('');
    const [preview, setPreview] = useState<Summary | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    // Billing needs a fee structure per class level; without one, say so and point to it.
    const [structures, setStructures] = useState<number | null>(null);
    useEffect(() => {
        opsFetch<{ id: string }[]>('/api/ops/fee-structures').then(r => setStructures(r.length)).catch(() => setStructures(null));
    }, []);

    const loadInvoices = useCallback(async () => {
        if (!termId) return;
        try { setInvoices(await opsFetch<Invoice[]>(`/api/finance/invoices?term_id=${termId}`)); }
        catch (err) { toast.error(errorText(err)); }
    }, [termId]);
    useEffect(() => { void loadInvoices(); }, [loadInvoices]);

    const run = async (dryRun: boolean) => {
        if (!termId) { toast.error('Choose a term.'); return; }
        setBusy(true);
        try {
            const r = await opsFetch<Summary>('/api/finance/invoices/generate', { method: 'POST', json: { term_id: termId, grade_stream_id: streamId || undefined, dry_run: dryRun } });
            setPreview(r);
            if (!dryRun) { toast.success(`${r.learners} learners billed.`); await loadInvoices(); }
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); setConfirm(false); }
    };

    return (
        <div className="flex flex-col gap-5">
            {structures === 0 && (
                <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 sm:flex-row sm:items-center sm:p-5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300"><Layers className="size-5" /></span>
                    <div className="flex-1">
                        <h2 className="text-sm font-semibold">Set up fee structures first</h2>
                        <p className="text-sm text-muted-foreground">Each class level needs a structure (its vote heads and amounts) before a term can be billed.</p>
                    </div>
                    <Link href="/dashboard/billing?tab=structures" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                        Add fee structures<ArrowRight className="size-4" />
                    </Link>
                </section>
            )}
            <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end sm:p-5">
                <FormField label="Term" htmlFor="bill-term" required><LookupSelect id="bill-term" lookup="terms" value={termId} onChange={v => { setTermId(v); setPreview(null); }} /></FormField>
                <FormField label="Class (optional)" htmlFor="bill-class"><LookupSelect id="bill-class" lookup="streams" value={streamId} onChange={v => { setStreamId(v); setPreview(null); }} clearable /></FormField>
                {canManage && <Button variant="outline" onClick={() => void run(true)} disabled={busy}><Eye />Preview</Button>}
                {canManage && <Button onClick={() => setConfirm(true)} disabled={busy || !termId}><Receipt />Bill term</Button>}
            </section>

            {preview && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatTile icon={Receipt} label={preview.dry_run ? 'Would bill' : 'Billed'} value={preview.learners} hint="learners" hue="emerald" />
                    <StatTile icon={Receipt} label="Amount" value={money(preview.billed)} hue="blue" />
                    <StatTile icon={Receipt} label="Less awards" value={money(preview.awards)} hue="violet" />
                    <StatTile icon={Receipt} label="No structure" value={preview.unbilled} tone={preview.unbilled > 0 ? 'warn' : 'good'} hint="learners skipped" />
                </div>
            )}

            {termId && (
                <DataTable
                    columns={[
                        { key: 'student', header: 'Learner', render: i => <span className="font-medium">{studentName(i.student)}</span> },
                        { key: 'adm', header: 'Adm no.', hideOnMobile: true, render: i => admissionNo(i.student) },
                        { key: 'structure', header: 'Structure', hideOnMobile: true, render: i => i.structure?.name ?? 'Transport only' },
                        { key: 'lines', header: 'Items', hideOnMobile: true, render: i => i.lines.map(l => l.description).join(', ') },
                        { key: 'total', header: 'Total', numeric: true, render: i => money(i.total) },
                    ]}
                    rows={invoices}
                    rowKey={i => i.id}
                    emptyState="No invoices for this term yet."
                />
            )}

            <ConfirmDialog
                isOpen={confirm}
                onClose={() => setConfirm(false)}
                onConfirm={() => void run(false)}
                loading={busy}
                title="Bill this term?"
                message={BILL_TERM_WARNING}
                confirmText="Bill term"
            />
        </div>
    );
}
