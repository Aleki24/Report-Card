"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api-error-message';
import { groupReadyPapers, type ReadyGroup, type ReadyPaper } from '@/lib/release-ready';
import { releasePapers } from './releasePapers';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/**
 * Every paper this term with marks in and not yet released, grouped by class
 * and exam, each group one click from released. The dashboard's "N papers
 * ready to release" opens on this; it used to open on a class picker, so the
 * admin still had to hunt class by class for what the card had counted.
 *
 * `version` changes whenever the page below releases or withdraws something.
 */
export function ReadyToReleasePanel({ version, onReleased }: { version: number; onReleased: () => void }) {
    const [papers, setPapers] = useState<ReadyPaper[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/school/exams?ready=1', { cache: 'no-store' });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load the papers ready to release.'));
            setPapers((json as { data?: ReadyPaper[] }).data ?? []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load the papers ready to release.');
        }
    }, []);

    useEffect(() => { void load(); }, [load, version]);

    const groups = useMemo(() => groupReadyPapers(papers ?? []), [papers]);

    const release = async (key: string, list: readonly ReadyPaper[], what: string) => {
        if (!window.confirm(`Release ${plural(list.length, 'paper')} (${what})? Learners and parents will see these marks. A learner with no mark in a subject simply won't see it.`)) return;
        setBusyKey(key);
        const { ok, failures } = await releasePapers(list);
        setBusyKey(null);
        if (failures.length === 0) toast.success(`Released ${plural(ok, 'paper')}.`);
        else toast.warning(`Released ${ok}; ${failures.length} failed`, { description: failures.join('\n'), duration: 10_000 });
        await load();
        onReleased();
    };

    if (error) {
        return (
            <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-rose-700 dark:text-rose-300">{error}</span>
                <button type="button" className="btn-secondary self-start sm:self-auto" onClick={() => void load()}>Try again</button>
            </div>
        );
    }
    if (!papers || groups.length === 0) return null;

    return (
        <section aria-labelledby="ready-to-release" className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.05] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 id="ready-to-release" className="text-base font-semibold">Ready to release</h2>
                    <p className="text-sm text-muted-foreground">
                        {plural(papers.length, 'paper')} this term with marks in, not yet visible to learners and parents.
                    </p>
                </div>
                {groups.length > 1 && (
                    <button type="button" className="btn-primary w-full shrink-0 sm:w-auto" disabled={busyKey !== null} onClick={() => void release('all', papers, 'every class below')}>
                        {busyKey === 'all' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                        Release all {papers.length}
                    </button>
                )}
            </div>
            <ul className="mt-4 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
                {groups.map(g => (
                    <GroupRow key={g.key} group={g} busy={busyKey === g.key} disabled={busyKey !== null} onRelease={() => void release(g.key, g.papers, `${g.classLabel} · ${g.examName}`)} />
                ))}
            </ul>
        </section>
    );
}

function GroupRow({ group: g, busy, disabled, onRelease }: { group: ReadyGroup; busy: boolean; disabled: boolean; onRelease: () => void }) {
    const marks = g.papers.reduce((sum, p) => sum + p.mark_count, 0);
    return (
        <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div className="min-w-0 flex-1">
                <p className="font-medium">{g.classLabel} · {g.examName}</p>
                <p className="truncate text-sm text-muted-foreground" title={g.papers.map(p => p.subject_name).join(', ')}>
                    {g.papers.map(p => p.subject_name).join(', ')}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{plural(g.papers.length, 'paper')} · {plural(marks, 'mark')} entered</p>
            </div>
            <button type="button" className="btn-secondary w-full shrink-0 sm:w-auto" disabled={disabled} onClick={onRelease}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                Release {g.papers.length}
            </button>
        </li>
    );
}
