"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, FileSpreadsheet, Loader2, Scale, Upload } from 'lucide-react';
import { CardHeading } from '@/components/ui';
import { apiErrorMessage, jsonBody } from '@/lib/api-error-message';
import { formatKsh } from '@/lib/fee-account';
import { IMPORT_FILE_ACCEPT, parseTabularFile } from '@/lib/import/parse-tabular-file';
import { STATEMENT_HEADINGS, readStatement, type StatementRow, type StatementSource } from '@/lib/fee-statement';
import {
    RECONCILE_URL, type CommitResult, type DirectoryLearner, type PreviewLine, type ReconcilePreview, type ReconcileSummary,
} from '@/lib/fee-reconcile';
import {
    commitBody, decisionProblem, initialPlan, planTotals, recordTo, setAction, splitBetween, withShare, type ReconcilePlan,
} from '@/lib/fee-reconcile-plan';
import { cn } from '@/lib/utils';
import { ReviewLine } from './ReviewLine';

async function call<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: 'no-store', ...init });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(apiErrorMessage(json, 'Something went wrong. Please try again.'));
    return (json as { data: T }).data;
}

type Filter = 'check' | 'matched' | 'recorded' | 'all';
const FILTERS: readonly { id: Filter; label: string; test: (l: PreviewLine) => boolean }[] = [
    { id: 'check', label: 'To check', test: l => l.status === 'SUGGESTED' || l.status === 'UNMATCHED' },
    { id: 'matched', label: 'Matched', test: l => l.status === 'MATCHED' },
    { id: 'recorded', label: 'Already in Skulbase', test: l => l.status === 'RECORDED' },
    { id: 'all', label: 'All', test: () => true },
];
/** Lines shown at once; a month's statement can run to hundreds. */
const PAGE = 60;

const SOURCE_LABEL: Record<StatementSource, string> = { MPESA: 'M-Pesa', BANK: 'Bank' };
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** One row of the totals check. */
function TotalRow({ label, amount, count, tone }: { label: string; amount: number; count?: number; tone?: 'muted' | 'warn' }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <span className={cn(tone === 'muted' && 'text-muted-foreground', tone === 'warn' && 'font-semibold text-amber-700 dark:text-amber-300')}>{label}{count !== undefined ? ` (${count})` : ''}</span>
            <span className="tabular-nums">{formatKsh(amount)}</span>
        </div>
    );
}

/**
 * Reconcile a statement: upload the M-Pesa or bank statement, check what
 * each payment in was matched to, fix the rest, and save. Everything on the
 * statement ends up recorded, already in Skulbase, waiting in the unmatched
 * queue, or set aside as not school fees; Skulbase payments the statement
 * does not show are listed so the two can agree.
 */
export function StatementReconcile({ canCollect, onSaved }: { canCollect: boolean; onSaved: () => void }) {
    const [fileName, setFileName] = useState<string | null>(null);
    const [rows, setRows] = useState<StatementRow[] | null>(null);
    const [skippedLines, setSkippedLines] = useState(0);
    const [source, setSource] = useState<StatementSource>('MPESA');
    const [preview, setPreview] = useState<ReconcilePreview | null>(null);
    const [plan, setPlan] = useState<ReconcilePlan>({});
    const [busy, setBusy] = useState<'reading' | 'matching' | 'saving' | null>(null);
    const [filter, setFilter] = useState<Filter>('check');
    const [shown, setShown] = useState(PAGE);
    const [result, setResult] = useState<CommitResult | null>(null);
    const [history, setHistory] = useState<ReconcileSummary[] | null>(null);

    const loadHistory = useCallback(() => {
        call<ReconcileSummary[]>(RECONCILE_URL).then(setHistory, () => setHistory([]));
    }, []);
    useEffect(() => { loadHistory(); }, [loadHistory]);

    const match = useCallback(async (statementRows: StatementRow[], from: StatementSource) => {
        setBusy('matching');
        try {
            const next = await call<ReconcilePreview>(`${RECONCILE_URL}/preview`, jsonBody('POST', { source: from, rows: statementRows }));
            setPreview(next);
            setPlan(initialPlan(next));
            setFilter(next.lines.some(l => l.status === 'SUGGESTED' || l.status === 'UNMATCHED') ? 'check' : 'all');
            setShown(PAGE);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not match the statement.');
        } finally {
            setBusy(null);
        }
    }, []);

    const onFile = async (file: File | undefined) => {
        if (!file) return;
        setBusy('reading');
        setResult(null);
        setPreview(null);
        try {
            const parsed = await parseTabularFile(file, STATEMENT_HEADINGS);
            const statement = readStatement(parsed.rows, parsed.headers);
            if (statement.missing.length > 0) throw new Error(`We could not find the ${statement.missing.join(' and ')} columns. Upload the statement as exported (CSV or Excel), with its column headings.`);
            if (statement.rows.length === 0) throw new Error('The statement has no payments in.');
            setFileName(file.name);
            setRows(statement.rows);
            setSkippedLines(statement.skipped);
            setSource(statement.source);
            await match(statement.rows, statement.source);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not read the file.');
            setBusy(null);
        }
    };

    const byId = useMemo(() => new Map((preview?.learners ?? []).map(l => [l.id, l] as const)), [preview]);
    const totals = useMemo(() => (preview ? planTotals(preview, plan) : null), [preview, plan]);
    const ledgerOnlyTotal = useMemo(() => (preview?.ledgerOnly ?? []).reduce((n, p) => n + p.amount, 0), [preview]);

    const save = async () => {
        if (!preview) return;
        setBusy('saving');
        try {
            const done = await call<CommitResult>(RECONCILE_URL, jsonBody('POST', commitBody(preview, plan, fileName)));
            setResult(done);
            setPreview(null);
            setRows(null);
            toast.success('Statement reconciled.');
            loadHistory();
            onSaved();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save the statement.');
        } finally {
            setBusy(null);
        }
    };

    const visible = preview ? preview.lines.filter(FILTERS.find(f => f.id === filter)!.test) : [];

    return (
        <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <CardHeading
                icon={Scale}
                hue="teal"
                title="Reconcile a statement"
                description="Download your M-Pesa (Paybill or Till) or bank statement and upload it here. Every payment in is matched to a learner by the admission number they typed, then by the parent’s phone and name. Check the rest, then save: nothing is recorded twice."
            />

            {!preview && canCollect && (
                <label className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50', busy && 'pointer-events-none opacity-60')}>
                    {busy ? <Loader2 className="size-6 animate-spin text-primary" aria-hidden /> : <Upload className="size-6 text-primary" aria-hidden />}
                    <span className="text-sm font-semibold">{busy === 'reading' ? 'Reading the statement…' : busy === 'matching' ? 'Matching payments to learners…' : 'Choose a statement file'}</span>
                    <span className="text-xs text-muted-foreground">CSV or Excel. M-Pesa: Org portal → Statements → export. Bank: your online banking’s statement export.</span>
                    <input type="file" accept={IMPORT_FILE_ACCEPT} className="sr-only" disabled={!!busy} onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
            )}

            {result && (
                <div role="status" className="flex flex-col gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.06] p-4 text-sm">
                    <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-emerald-600" aria-hidden />Statement saved: {formatKsh(result.summary.statement_total)} accounted for.</p>
                    <p className="text-muted-foreground">
                        {formatKsh(result.summary.recorded_total)} recorded against learners · {formatKsh(result.summary.already_total)} already in Skulbase ·{' '}
                        {formatKsh(result.summary.unmatched_total)} waiting to be matched · {formatKsh(result.summary.skipped_total)} not school fees.
                    </p>
                    {result.notBilled > 0 && <p className="font-semibold text-amber-700 dark:text-amber-300">{plural(result.notBilled, 'payment')} for learners with no fee record yet went to the unmatched list: bill them, then assign it.</p>}
                </div>
            )}

            {preview && totals && (
                <>
                    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex min-w-0 items-center gap-2">
                            <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="truncate"><span className="font-semibold">{fileName}</span> · {plural(preview.lines.length, 'payment')} in{preview.period.from ? `, ${preview.period.from} to ${preview.period.to}` : ''}{skippedLines > 0 ? ` · ${plural(skippedLines, 'line')} left out (money out, charges, failed)` : ''}</span>
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                            <label className="text-xs text-muted-foreground" htmlFor="statement-source">Statement from</label>
                            <select id="statement-source" className="input-field h-8 py-0 text-xs" value={source} disabled={!!busy} onChange={e => { const next = e.target.value as StatementSource; setSource(next); if (rows) void match(rows, next); }}>
                                {(['MPESA', 'BANK'] as const).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
                            </select>
                            <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => { setPreview(null); setRows(null); }}>Start over</button>
                        </div>
                    </div>

                    <div role="tablist" aria-label="Show payments" className="flex flex-wrap gap-1.5">
                        {FILTERS.map(f => {
                            const count = preview.lines.filter(f.test).length;
                            return (
                                <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setShown(PAGE); }}
                                    className={cn('rounded-full border px-3 py-1 text-xs font-semibold', filter === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                                    {f.label} {count}
                                </button>
                            );
                        })}
                    </div>

                    {visible.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nothing here.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {visible.slice(0, shown).map(line => (
                                <ReviewLine
                                    key={line.line}
                                    line={line}
                                    decision={plan[line.line]}
                                    learners={preview.learners as DirectoryLearner[]}
                                    byId={byId}
                                    problem={decisionProblem(line, plan[line.line])}
                                    actions={{
                                        recordTo: id => setPlan(p => recordTo(p, line, id)),
                                        split: ids => setPlan(p => splitBetween(p, line, ids)),
                                        share: (id, amount) => setPlan(p => withShare(p, line, id, amount)),
                                        queue: () => setPlan(p => setAction(p, line, 'QUEUE')),
                                        skip: () => setPlan(p => setAction(p, line, 'SKIP')),
                                    }}
                                />
                            ))}
                        </ul>
                    )}
                    {visible.length > shown && <button type="button" className="btn-secondary self-center" onClick={() => setShown(n => n + PAGE)}>Show {Math.min(PAGE, visible.length - shown)} more</button>}

                    {/* Sticky so the check and the save stay in reach down a long statement. */}
                    <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 grid gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-4">
                        <div className="divide-y divide-border/60">
                            <TotalRow label="Money in on the statement" amount={totals.statement} count={preview.lines.length} />
                            <div className="grid sm:grid-cols-2 sm:gap-x-6">
                                <TotalRow label="Record now" amount={totals.record} count={totals.counts.record} tone="muted" />
                                <TotalRow label="Already in Skulbase" amount={totals.already} count={totals.counts.already} tone="muted" />
                                <TotalRow label="Leave unmatched to chase" amount={totals.queue} count={totals.counts.queue} tone={totals.counts.queue > 0 ? 'warn' : 'muted'} />
                                <TotalRow label="Not school fees" amount={totals.skip} count={totals.counts.skip} tone="muted" />
                            </div>
                            {preview.ledgerOnly.length > 0 ? (
                                <details className="py-1.5 text-sm">
                                    <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-300">
                                        In Skulbase but not on this statement: {plural(preview.ledgerOnly.length, 'payment')}, {formatKsh(ledgerOnlyTotal)}
                                    </summary>
                                    <p className="mt-1 text-xs text-muted-foreground">Recorded as {SOURCE_LABEL[preview.source]} for these dates, but the statement does not show them: a wrong code, cash entered as {SOURCE_LABEL[preview.source]}, or a payment to another account. Open each learner’s account to correct it.</p>
                                    <ul className="mt-1 max-h-40 overflow-auto text-xs">
                                        {preview.ledgerOnly.map(p => <li key={p.id} className="flex justify-between gap-3 py-0.5"><span className="truncate">{p.receiptNumber} · {p.learner ?? 'Unmatched'} · {p.code ?? 'no code'} · {p.paidAt.slice(0, 10)}</span><span className="tabular-nums">{formatKsh(p.amount)}</span></li>)}
                                    </ul>
                                </details>
                            ) : (
                                <p className="flex items-center gap-1.5 py-1.5 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" aria-hidden />Skulbase has nothing for these dates that the statement does not show.</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {totals.problems > 0 && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{plural(totals.problems, 'payment')} still {totals.problems === 1 ? 'needs' : 'need'} a learner or correct shares.</p>}
                            <button type="button" className="btn-primary justify-center" disabled={!canCollect || !!busy || totals.problems > 0} onClick={() => void save()}>
                                {busy === 'saving' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                                Save: record {totals.counts.record}{totals.counts.queue > 0 ? `, leave ${totals.counts.queue} unmatched` : ''}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {history && history.length > 0 && (
                <details className="group rounded-xl border border-border/70">
                    <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">Statements reconciled ({history.length})</summary>
                    <ul className="divide-y divide-border/60 border-t border-border/60 text-sm">
                        {history.map(h => (
                            <li key={h.id} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                <span className="min-w-0">
                                    <span className="font-medium">{SOURCE_LABEL[h.source]}{h.period_from ? `, ${h.period_from} to ${h.period_to}` : ''}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{h.file_name ?? 'Statement'} · {new Date(h.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}{h.created_by_name ? ` by ${h.created_by_name}` : ''}</span>
                                </span>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                    {formatKsh(h.statement_total)} · {formatKsh(h.recorded_total)} recorded{h.unmatched_total > 0 ? ` · ${formatKsh(h.unmatched_total)} unmatched` : ''}
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}
