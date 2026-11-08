"use client";

import React, { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatKsh } from '@/lib/fee-account';
import type { DirectoryLearner } from '@/lib/fee-reconcile';
import { cn } from '@/lib/utils';

const MAX_SHOWN = 8;

/** Name, admission number or class contains every word typed. */
function matches(l: DirectoryLearner, words: readonly string[]): boolean {
    const hay = `${l.name} ${l.admissionNumber ?? ''} ${l.className ?? ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
}

export const learnerLine = (l: Pick<DirectoryLearner, 'name' | 'admissionNumber' | 'className'>): string =>
    [l.name, l.admissionNumber ? `Adm ${l.admissionNumber}` : null, l.className].filter(Boolean).join(' · ');

/** What a learner owes, or their credit, in a few words. */
export const balanceNote = (balance: number): string =>
    balance > 0 ? `owes ${formatKsh(balance)}` : balance < 0 ? `${formatKsh(-balance)} credit` : 'nothing owed';

/**
 * Find a learner by name, admission number or class, and pick them. A small
 * combobox: type, then choose from the list under the box.
 */
export function LearnerPicker({ learners, onPick, exclude = [], placeholder = 'Find a learner by name or admission number', autoFocus }: {
    learners: readonly DirectoryLearner[];
    onPick: (learner: DirectoryLearner) => void;
    /** Learners already chosen, left out of the list. */
    exclude?: readonly string[];
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const id = useId();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const shown = useMemo(() => {
        const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        return learners.filter(l => !exclude.includes(l.id) && matches(l, words)).slice(0, MAX_SHOWN);
    }, [learners, query, exclude]);

    const pick = (l: DirectoryLearner) => { onPick(l); setQuery(''); setActive(0); };

    return (
        <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
                role="combobox"
                aria-expanded={shown.length > 0}
                aria-controls={`${id}-list`}
                aria-activedescendant={shown[active] ? `${id}-${shown[active].id}` : undefined}
                aria-label="Find a learner"
                autoFocus={autoFocus}
                className="input-field h-10 w-full pl-9 text-sm"
                placeholder={placeholder}
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, shown.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
                    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); pick(shown[active]); }
                    else if (e.key === 'Escape') setQuery('');
                }}
            />
            {shown.length > 0 && (
                <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                    {shown.map((l, i) => (
                        <li
                            key={l.id}
                            id={`${id}-${l.id}`}
                            role="option"
                            aria-selected={i === active}
                            onMouseDown={e => { e.preventDefault(); pick(l); }}
                            onMouseEnter={() => setActive(i)}
                            className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm', i === active ? 'bg-primary/10' : 'hover:bg-muted')}
                        >
                            <span className="min-w-0 truncate">{learnerLine(l)}</span>
                            <span className={cn('shrink-0 text-xs tabular-nums', l.balance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{balanceNote(l.balance)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
