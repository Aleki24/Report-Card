"use client";

import React, { useEffect, useState } from 'react';
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { describeMarkChange, type MarkChange, type MarkHistoryResponse } from '@/lib/mark-history';

interface MarkHistoryPanelProps {
    examId: string;
    /** Narrows the list to learners whose name matches, as the sheet's search does. */
    query: string;
    /** Changes after each save, so an open list picks up what was just saved. */
    version: number;
}

type Result = { status: 'error'; message: string } | { status: 'ready'; body: MarkHistoryResponse };

const ACTION_TONE: Record<MarkChange['action'], string> = {
    entered: 'bg-emerald-500',
    changed: 'bg-amber-500',
    removed: 'bg-rose-500',
};

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Who changed which mark, from what to what, and when: the record behind a
 * correction made after report cards went out. Loads when opened.
 */
export function MarkHistoryPanel({ examId, query, version }: MarkHistoryPanelProps) {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<{ key: string; value: Result } | null>(null);
    const key = `${examId}|${version}`;
    const loading = open && result?.key !== key;

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        fetch(`/api/school/exam-marks/history?exam_id=${encodeURIComponent(examId)}`, { signal: controller.signal, cache: 'no-store' })
            .then(async res => {
                const body = (await res.json().catch(() => null)) as (MarkHistoryResponse & { error?: string }) | null;
                if (!res.ok || !body) throw new Error(body?.error ?? `error ${res.status}`);
                setResult({ key, value: { status: 'ready', body } });
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setResult({ key, value: { status: 'error', message: err instanceof Error ? err.message : 'Could not load' } });
            });
        return () => controller.abort();
    }, [open, key, examId]);

    const value = result?.key === key ? result.value : null;
    const q = query.trim().toLowerCase();
    const changes = value?.status === 'ready' ? value.body.data.filter(c => !q || c.studentName.toLowerCase().includes(q)) : [];

    return (
        <div className="border-t border-border/60">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-controls={`mark-history-${examId}`}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/40 sm:px-5"
            >
                <History size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">Change history{q && <span className="font-normal text-muted-foreground"> · matching &ldquo;{query.trim()}&rdquo;</span>}</span>
                {loading ? <Loader2 size={15} className="animate-spin text-muted-foreground" aria-hidden /> : <ChevronDown size={15} className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />}
            </button>

            {open && value && (
                <div id={`mark-history-${examId}`} className="px-4 pb-4 sm:px-5">
                    {value.status === 'error' ? (
                        <p role="alert" className="text-sm text-destructive">Couldn&apos;t load the history: {value.message}</p>
                    ) : !value.body.recording ? (
                        <p className="text-sm text-muted-foreground">Changes aren&apos;t being recorded yet. Ask your administrator to finish the update.</p>
                    ) : changes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{q ? 'No changes for that learner.' : 'No changes recorded yet. Every mark saved from now on is listed here.'}</p>
                    ) : (
                        <ol className="flex max-h-80 flex-col divide-y divide-border/50 overflow-y-auto rounded-lg border border-border/60">
                            {changes.map(c => (
                                <li key={c.id} className="flex items-start gap-3 px-3 py-2">
                                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', ACTION_TONE[c.action])} aria-hidden />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-foreground">
                                            <span className="font-medium">{c.studentName}</span>
                                            <span className="text-muted-foreground"> · </span>
                                            <span className="tabular-nums">{describeMarkChange(c)}</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {c.changedBy ?? (c.action === 'changed' ? 'Recalculated from paper scores' : 'Not recorded')} · {when(c.changedAt)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            )}
        </div>
    );
}
