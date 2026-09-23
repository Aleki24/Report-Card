"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Search, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    MINISTRY_COMBINATION_TEMPLATES,
    PATHWAYS,
    PATHWAY_ORDER,
    type CbcPathway,
} from '@/lib/pathway-definitions';
import type { SchoolCombinationOption } from '@/lib/pathway/placement';

/** One pickable combination; `value` is the placement choice ("existing:…", "official:…", "custom:…"). */
export type ChoiceOption = { value: string; code: string; name: string; detail: string };

type Props = {
    open: boolean;
    /** Who the pick is for, e.g. "Ntoyian Rikoinet" or "5 learners". */
    subject: string;
    /** The choice currently set, highlighted in the list. */
    current: string;
    /** What the learner's marks point to, shown first. */
    suggestion: ChoiceOption | null;
    schoolCombinations: SchoolCombinationOption[];
    /** Senior subject codes the school offers. */
    offeredCodes: ReadonlySet<string>;
    onPick: (value: string) => void;
    onClose: () => void;
};

type PathwayFilter = CbcPathway | 'ALL';

const PAGE_SIZE = 40;

/**
 * Pick a combination for one or more learners: the suggestion from their
 * marks, the school's own combinations, or any official Ministry combination
 * (created for the school when the placement is applied). Full screen on
 * phones, a centred dialog from `sm` up.
 */
export default function CombinationChooser({ open, subject, current, suggestion, schoolCombinations, offeredCodes, onPick, onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [query, setQuery] = useState('');
    const [pathway, setPathway] = useState<PathwayFilter>('ALL');
    const [runnableOnly, setRunnableOnly] = useState(true);
    const [limit, setLimit] = useState(PAGE_SIZE);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    const matchesQuery = (code: string, name: string) => {
        const q = query.trim().toLowerCase();
        return !q || code.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    };

    const schoolOptions = useMemo<ChoiceOption[]>(
        () => schoolCombinations.map(c => ({
            value: `existing:${c.id}`,
            code: c.code,
            name: c.name,
            detail: [PATHWAYS[c.pathway]?.label, c.track].filter(Boolean).join(' · '),
        })),
        [schoolCombinations],
    );

    const ministryOptions = useMemo(() => {
        const taken = new Set(schoolCombinations.map(c => c.code.trim().toUpperCase()));
        const rank = (p: CbcPathway) => PATHWAY_ORDER.indexOf(p);
        return MINISTRY_COMBINATION_TEMPLATES
            .filter(t => !taken.has(t.code))
            .sort((a, b) => rank(a.pathway) - rank(b.pathway) || a.code.localeCompare(b.code))
            .map(t => {
                const missing = t.subjectCodes.filter(c => !offeredCodes.has(c));
                return {
                    value: `official:${t.code}`,
                    code: t.code,
                    name: t.name,
                    pathway: t.pathway,
                    detail: `${PATHWAYS[t.pathway].label} · ${t.track}${missing.length ? ` · not offered yet: ${missing.join(', ')}` : ''}`,
                    runnable: missing.length === 0,
                };
            });
    }, [schoolCombinations, offeredCodes]);

    const visibleSchool = schoolOptions.filter(o => matchesQuery(o.code, o.name));
    const ministryMatches = ministryOptions.filter(o =>
        (pathway === 'ALL' || o.pathway === pathway) && (!runnableOnly || o.runnable) && matchesQuery(o.code, o.name),
    );
    const showSuggestion = suggestion && matchesQuery(suggestion.code, suggestion.name);

    /** Every way out (pick, ×, Esc, backdrop) starts the next opening from a clean search. */
    const close = () => {
        setQuery('');
        setLimit(PAGE_SIZE);
        onClose();
    };

    const pick = (value: string) => {
        onPick(value);
        close();
    };

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby="combination-chooser-title"
            onClose={close}
            onClick={e => { if (e.target === e.currentTarget) close(); }}
            className={cn(
                'm-0 h-dvh max-h-none w-full max-w-none bg-card p-0 text-card-foreground backdrop:bg-black/50',
                'sm:m-auto sm:h-auto sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-border sm:shadow-xl',
            )}
        >
            <div className="flex h-full max-h-[inherit] flex-col">
                <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                        <h3 id="combination-chooser-title" className="text-sm font-bold">Choose a combination</h3>
                        <p className="truncate text-xs text-muted-foreground">For {subject}</p>
                    </div>
                    <button type="button" onClick={close} className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                        <X className="size-5" aria-hidden />
                    </button>
                </header>

                <div className="grid gap-2 border-b border-border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:px-5">
                    <label className="relative block">
                        <span className="sr-only">Search combinations</span>
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <input
                            type="search"
                            className="input-field w-full pl-9 text-sm"
                            placeholder="Code or subject, e.g. ST1004 or Chemistry"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
                        />
                    </label>
                    <label className="block">
                        <span className="sr-only">Pathway</span>
                        <select
                            className="input-field w-full text-sm"
                            value={pathway}
                            onChange={e => { setPathway(e.target.value as PathwayFilter); setLimit(PAGE_SIZE); }}
                        >
                            <option value="ALL">All pathways</option>
                            {PATHWAY_ORDER.map(pw => <option key={pw} value={pw}>{PATHWAYS[pw].label}</option>)}
                        </select>
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs sm:col-span-2">
                        <input type="checkbox" className="size-4 accent-primary" checked={runnableOnly} onChange={e => setRunnableOnly(e.target.checked)} />
                        Only Ministry combinations we can run with our subjects
                    </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
                    {showSuggestion && (
                        <OptionGroup label="Suggested from marks">
                            <OptionRow option={suggestion} selected={current === suggestion.value} onPick={pick} highlight />
                        </OptionGroup>
                    )}
                    {visibleSchool.length > 0 && (
                        <OptionGroup label="Your school's combinations">
                            {visibleSchool.map(o => <OptionRow key={o.value} option={o} selected={current === o.value} onPick={pick} />)}
                        </OptionGroup>
                    )}
                    <OptionGroup label={`Ministry combinations (${ministryMatches.length})`}>
                        {ministryMatches.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-muted-foreground">
                                {runnableOnly
                                    ? 'None match with the subjects you offer. Untick the filter above, or offer more subjects on the Subjects tab.'
                                    : 'No combinations match your search.'}
                            </p>
                        ) : (
                            <>
                                {ministryMatches.slice(0, limit).map(o => (
                                    <OptionRow key={o.value} option={o} selected={current === o.value} onPick={pick} disabled={!o.runnable} />
                                ))}
                                {ministryMatches.length > limit && (
                                    <li className="p-2 text-center">
                                        <button type="button" className="min-h-9 text-sm font-semibold text-primary hover:underline" onClick={() => setLimit(l => l + PAGE_SIZE)}>
                                            Show {Math.min(PAGE_SIZE, ministryMatches.length - limit)} more
                                        </button>
                                    </li>
                                )}
                            </>
                        )}
                    </OptionGroup>
                </div>

                {current && (
                    <footer className="border-t border-border px-4 py-3 sm:px-5">
                        <button type="button" className="min-h-9 text-sm text-muted-foreground hover:text-foreground" onClick={() => pick('')}>
                            Clear the choice
                        </button>
                    </footer>
                )}
            </div>
        </dialog>
    );
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="mb-2">
            <h4 className="sticky top-0 z-10 bg-card px-3 py-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{label}</h4>
            <ul className="flex flex-col gap-0.5">{children}</ul>
        </section>
    );
}

function OptionRow({ option, selected, onPick, disabled = false, highlight = false }: {
    option: ChoiceOption;
    selected: boolean;
    onPick: (value: string) => void;
    disabled?: boolean;
    highlight?: boolean;
}) {
    return (
        <li>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(option.value)}
                className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                    'enabled:hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50',
                    selected && 'bg-primary/10 ring-1 ring-primary/40',
                )}
            >
                <span className="w-16 shrink-0 font-mono text-xs font-semibold sm:w-20 sm:text-sm">{option.code}</span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-sm">
                        {highlight && <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />}
                        {option.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">{option.detail}</span>
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary" aria-label="Selected" />}
            </button>
        </li>
    );
}
