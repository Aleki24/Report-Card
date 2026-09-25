"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckSquare, Layers, Square } from 'lucide-react';
import { Modal } from '@/components/ui';
import { SearchBox } from '@/components/ui/SearchBox';
import { apiErrorMessage } from '@/lib/api-error-message';
import type { SubjectRosterEntry } from '@/lib/subject-roster-types';
import { cn } from '@/lib/utils';

interface Props {
    subject: { id: string; name: string; code: string };
    onClose: () => void;
}

type Load = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every(id => b.has(id));

/**
 * Who takes a subject: for 8-4-4 electives (only the CRE takers, not the
 * whole class) and for checking CBC electives. Once anyone in a class is
 * enrolled, mark entry for this subject lists only enrolled learners there.
 */
export default function SubjectEnrollmentManager({ subject, onClose }: Props) {
    const [roster, setRoster] = useState<SubjectRosterEntry[]>([]);
    const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [streamFilter, setStreamFilter] = useState('');
    const [search, setSearch] = useState('');
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/admin/student-subjects?subject_id=${encodeURIComponent(subject.id)}`, { cache: 'no-store', signal: controller.signal })
            .then(async res => {
                const json: unknown = await res.json().catch(() => null);
                if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load learners.'));
                const rows = ((json as { data?: SubjectRosterEntry[] } | null)?.data) ?? [];
                const enrolled = new Set(rows.filter(s => s.enrolled).map(s => s.id));
                setRoster(rows);
                setSaved(enrolled);
                setSelected(enrolled);
                setLoad({ state: 'ready' });
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load learners.' });
            });
        return () => controller.abort();
    }, [subject.id]);

    const streams = useMemo(() => {
        const map = new Map<string, string>();
        roster.forEach(s => { if (s.stream_id) map.set(s.stream_id, s.stream_name ?? ''); });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [roster]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return roster.filter(s =>
            (!streamFilter || s.stream_id === streamFilter)
            && (!q || `${s.name} ${s.admission_number ?? ''}`.toLowerCase().includes(q)));
    }, [roster, streamFilter, search]);

    const allShownOn = shown.length > 0 && shown.every(s => selected.has(s.id));
    const dirty = !sameSet(selected, saved);

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
    });

    const toggleShown = () => setSelected(prev => {
        const next = new Set(prev);
        for (const s of shown) {
            if (allShownOn) next.delete(s.id);
            else next.add(s.id);
        }
        return next;
    });

    const save = async () => {
        const add = [...selected].filter(id => !saved.has(id));
        const remove = [...saved].filter(id => !selected.has(id));
        setSaving(true);
        try {
            const res = await fetch('/api/admin/student-subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject_id: subject.id, add, remove }),
            });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save.'));
            setSaved(new Set(selected));
            toast.success(`${selected.size} learner${selected.size === 1 ? '' : 's'} now take ${subject.name}`);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save.');
        } finally {
            setSaving(false);
        }
    };

    const combos = shown.filter(s => s.in_combination).length;

    return (
        <Modal
            isOpen
            onClose={() => { if (!saving) onClose(); }}
            title={`Learners taking ${subject.name}`}
            size="lg"
            footer={<>
                <span className="mr-auto self-center text-xs text-muted-foreground">{selected.size} enrolled</span>
                <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="button" className="btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</button>
            </>}
        >
            <p className="mb-4 text-sm text-muted-foreground">
                Tick who takes {subject.name} ({subject.code}). Once anyone in a class is ticked, mark entry for it lists only the ticked learners there; a class with nobody ticked keeps showing everyone.
            </p>

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <select className="input-field" aria-label="Class" value={streamFilter} onChange={e => setStreamFilter(e.target.value)} disabled={streams.length === 0}>
                    <option value="">All classes</option>
                    {streams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <SearchBox value={search} onChange={setSearch} placeholder="Search learners" />
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs">
                    <button type="button" onClick={toggleShown} disabled={shown.length === 0} className="inline-flex items-center gap-2 font-medium disabled:opacity-50">
                        {allShownOn ? <CheckSquare className="size-4 text-primary" aria-hidden /> : <Square className="size-4 text-muted-foreground" aria-hidden />}
                        {allShownOn ? 'Untick these' : `Tick all ${shown.length}`}
                    </button>
                    {combos > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300" title="These learners' subjects come from their combination; re-syncing it can undo changes here.">
                            <Layers className="size-3.5" aria-hidden />{combos} on a combination
                        </span>
                    )}
                </div>
                <ul className="max-h-[45vh] min-h-[10rem] overflow-y-auto" aria-busy={load.state === 'loading'}>
                    {load.state === 'loading' ? (
                        Array.from({ length: 5 }, (_, i) => <li key={i} className="skeleton-bone m-2 h-9 rounded-lg" />)
                    ) : load.state === 'error' ? (
                        <li className="px-4 py-10 text-center text-sm text-destructive">{load.message}</li>
                    ) : shown.length === 0 ? (
                        <li className="px-4 py-10 text-center text-xs text-muted-foreground">
                            {roster.length === 0 ? `No enrolled learners are in a grade that takes ${subject.name}.` : 'No learners match.'}
                        </li>
                    ) : shown.map(s => (
                        <li key={s.id}>
                            <label className={cn('flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 hover:bg-muted/40', selected.has(s.id) !== saved.has(s.id) && 'bg-primary/[0.05]')}>
                                <input type="checkbox" className="size-4 accent-primary" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{s.name}</span>
                                    <span className="block truncate text-[11px] text-muted-foreground">{s.stream_name ?? 'No class'} · {s.admission_number?.trim() || '—'}</span>
                                </span>
                                {s.in_combination && <Layers className="size-3.5 shrink-0 text-amber-500" aria-label="On a subject combination" />}
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
}
