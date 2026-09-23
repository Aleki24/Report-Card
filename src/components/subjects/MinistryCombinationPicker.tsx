"use client";

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    MINISTRY_COMBINATION_TEMPLATES,
    PATHWAYS,
    PATHWAY_ORDER,
    type CbcPathway,
    type MinistryCombinationTemplate,
} from '@/lib/pathway-definitions';

type Props = {
    /** Catalogue code → subject id, for the senior subjects this school offers. */
    offeredIdByCode: ReadonlyMap<string, string>;
    /** Combination codes the school has already set up. */
    existingCodes: ReadonlySet<string>;
    busy: boolean;
    onAdd: (templates: MinistryCombinationTemplate[]) => Promise<void>;
};

type PathwayFilter = CbcPathway | 'ALL';

/** How many rows render before "Show more" — the full list is 511. */
const PAGE_SIZE = 60;

/**
 * Browse the Ministry's 511 official combinations and add the ones a school
 * runs. By default only combinations whose three electives the school already
 * offers are listed, so everything shown can be created as-is.
 */
export default function MinistryCombinationPicker({ offeredIdByCode, existingCodes, busy, onAdd }: Props) {
    const [query, setQuery] = useState('');
    const [pathway, setPathway] = useState<PathwayFilter>('ALL');
    const [track, setTrack] = useState('');
    const [runnableOnly, setRunnableOnly] = useState(true);
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [limit, setLimit] = useState(PAGE_SIZE);

    const missingFor = (t: MinistryCombinationTemplate) => t.subjectCodes.filter(c => !offeredIdByCode.has(c));

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return MINISTRY_COMBINATION_TEMPLATES.filter(t =>
            !existingCodes.has(t.code) &&
            (pathway === 'ALL' || t.pathway === pathway) &&
            (!track || t.track === track) &&
            (!runnableOnly || t.subjectCodes.every(c => offeredIdByCode.has(c))) &&
            (!q || t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)),
        );
    }, [query, pathway, track, runnableOnly, existingCodes, offeredIdByCode]);

    const toggle = (code: string) =>
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code); else next.add(code);
            return next;
        });

    const addSelected = async () => {
        const templates = MINISTRY_COMBINATION_TEMPLATES.filter(t => selected.has(t.code));
        await onAdd(templates);
        setSelected(new Set());
    };

    const tracks = pathway === 'ALL' ? [] : PATHWAYS[pathway].tracks;
    const visible = matches.slice(0, limit);

    return (
        <section aria-labelledby="official-combinations" className="flex flex-col gap-4">
            <header>
                <h4 id="official-combinations" className="text-sm font-bold">Official Ministry combinations</h4>
                <p className="text-xs text-muted-foreground">
                    All 511 combinations from the Grade 10 selection list, with their official codes. Tick the ones your school runs.
                </p>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
                <label className="relative block">
                    <span className="sr-only">Search combinations</span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input
                        type="search"
                        className="input-field w-full pl-9 text-sm"
                        placeholder="Search a code or subject, e.g. ST1004 or Chemistry"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
                    />
                </label>
                <label className="block">
                    <span className="sr-only">Pathway</span>
                    <select
                        className="input-field w-full text-sm"
                        value={pathway}
                        onChange={e => { setPathway(e.target.value as PathwayFilter); setTrack(''); setLimit(PAGE_SIZE); }}
                    >
                        <option value="ALL">All pathways</option>
                        {PATHWAY_ORDER.map(pw => <option key={pw} value={pw}>{PATHWAYS[pw].label}</option>)}
                    </select>
                </label>
                <label className="block">
                    <span className="sr-only">Track</span>
                    <select
                        className="input-field w-full text-sm"
                        value={track}
                        disabled={tracks.length === 0}
                        onChange={e => { setTrack(e.target.value); setLimit(PAGE_SIZE); }}
                    >
                        <option value="">{tracks.length === 0 ? 'Pick a pathway for tracks' : 'All tracks'}</option>
                        {tracks.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={runnableOnly} onChange={e => setRunnableOnly(e.target.checked)} />
                    Only combinations we can run with our subjects
                </label>
                <span className="text-xs text-muted-foreground">{matches.length} match{matches.length === 1 ? '' : 'es'}</span>
            </div>

            {matches.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {runnableOnly
                        ? 'No runnable combinations match. Offer more senior school subjects on the Subjects tab, or untick the filter to see every combination.'
                        : 'No combinations match your search.'}
                </p>
            ) : (
                <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {visible.map(t => {
                        const missing = missingFor(t);
                        const runnable = missing.length === 0;
                        const isSelected = selected.has(t.code);
                        return (
                            <li key={t.code}>
                                <label
                                    className={cn(
                                        'flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors',
                                        runnable ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-60',
                                        isSelected && 'bg-primary/5',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        className="size-4 shrink-0 accent-primary"
                                        checked={isSelected}
                                        disabled={!runnable || busy}
                                        onChange={() => toggle(t.code)}
                                    />
                                    <span className="w-16 shrink-0 font-mono text-sm font-semibold">{t.code}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm">{t.name}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {PATHWAYS[t.pathway].label} · {t.track}
                                            {!runnable && ` · not offered yet: ${missing.join(', ')}`}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                    {matches.length > limit && (
                        <li className="p-2 text-center">
                            <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => setLimit(l => l + PAGE_SIZE)}>
                                Show {Math.min(PAGE_SIZE, matches.length - limit)} more
                            </button>
                        </li>
                    )}
                </ul>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
                {selected.size > 0 && (
                    <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())} disabled={busy}>
                        Clear selection
                    </button>
                )}
                <button type="button" className="btn-primary h-9 px-4 text-sm" disabled={busy || selected.size === 0} onClick={addSelected}>
                    <Check className="size-4" aria-hidden />
                    {busy ? 'Adding…' : `Add ${selected.size || ''} combination${selected.size === 1 ? '' : 's'}`}
                </button>
            </div>
        </section>
    );
}
