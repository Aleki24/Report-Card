"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLookup } from '@/hooks/useLookup';
import type { LookupOption, LookupType } from '@/lib/ops/lookups';

interface SearchableSelectProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly LookupOption[];
    placeholder?: string;
    loading?: boolean;
    disabled?: boolean;
    /** Offer a clear button (for optional fields). */
    clearable?: boolean;
    invalid?: boolean;
    className?: string;
}

const MAX_SHOWN = 100;

/**
 * A select you can type into: schools have hundreds of learners, and a plain
 * <select> of 900 names is unusable on a phone. Keyboard: arrows move, Enter
 * picks, Escape closes.
 */
export function SearchableSelect({
    id, value, onChange, options, placeholder = 'Select…', loading, disabled, clearable, invalid, className,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listId = useId();
    const selected = options.find(o => o.id === value);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        const hits = q ? options.filter(o => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q)) : options;
        return hits.slice(0, MAX_SHOWN);
    }, [options, query]);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        requestAnimationFrame(() => inputRef.current?.focus());
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const pick = (option: LookupOption) => {
        onChange(option.id);
        setOpen(false);
        setQuery('');
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); const o = matches[active]; if (o) pick(o); }
        else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };

    return (
        <div ref={rootRef} className={cn('relative min-w-0', className)}>
            <button
                id={id}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => { setOpen(o => !o); setActive(0); }}
                className={cn('input-field flex w-full items-center gap-2 text-left', invalid && 'border-destructive', disabled && 'opacity-60')}
            >
                <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-muted-foreground')}>
                    {selected ? selected.label : loading ? 'Loading…' : placeholder}
                    {selected?.hint && <span className="ml-2 text-xs text-muted-foreground">{selected.hint}</span>}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            {clearable && selected && !disabled && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Clear selection"
                    className="absolute top-1/2 right-8 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                    <X className="size-3.5" aria-hidden />
                </button>
            )}

            {open && (
                <div className="absolute z-[120] mt-1 w-full min-w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                    <div className="relative border-b border-border">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => { setQuery(e.target.value); setActive(0); }}
                            onKeyDown={onKeyDown}
                            placeholder="Type to search…"
                            role="combobox"
                            aria-controls={listId}
                            aria-expanded
                            aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
                            className="h-10 w-full bg-transparent pr-3 pl-9 text-sm outline-none"
                        />
                    </div>
                    <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
                        {matches.length === 0 && (
                            <li className="px-3 py-2 text-sm text-muted-foreground">{loading ? 'Loading…' : 'No matches'}</li>
                        )}
                        {matches.map((o, i) => (
                            <li
                                key={o.id}
                                id={`${listId}-${o.id}`}
                                role="option"
                                aria-selected={o.id === value}
                                onMouseEnter={() => setActive(i)}
                                onMouseDown={e => { e.preventDefault(); pick(o); }}
                                className={cn('flex cursor-pointer items-center gap-2 px-3 py-2 text-sm', i === active && 'bg-muted')}
                            >
                                <Check className={cn('size-4 shrink-0', o.id === value ? 'text-primary' : 'invisible')} aria-hidden />
                                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                {o.hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{o.hint}</span>}
                            </li>
                        ))}
                    </ul>
                    {options.length > MAX_SHOWN && matches.length === MAX_SHOWN && (
                        <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">Showing the first {MAX_SHOWN}; keep typing to narrow down.</p>
                    )}
                </div>
            )}
        </div>
    );
}

type LookupSelectProps = Omit<SearchableSelectProps, 'options' | 'loading'> & {
    lookup: LookupType;
    params?: Record<string, string | undefined>;
    /** Narrow the loaded options (e.g. only drivers). */
    filter?: (option: LookupOption) => boolean;
};

/** A SearchableSelect fed by `/api/ops/lookups`. */
export function LookupSelect({ lookup, params, filter, ...props }: LookupSelectProps) {
    const { options, loading } = useLookup(lookup, params);
    const shown = useMemo(() => (filter ? options.filter(filter) : options), [options, filter]);
    return <SearchableSelect {...props} options={shown} loading={loading} />;
}
