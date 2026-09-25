'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TermSelectTerm { id: string; name: string; academic_year_id?: string | null }
export interface TermSelectYear { id: string; name: string }

type TermSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  terms: readonly TermSelectTerm[];
  /** Newest first. Terms are grouped under their year so "Term 1" is never ambiguous. */
  years: readonly TermSelectYear[];
  value: string;
  onChange: (termId: string) => void;
  /** Label of the empty choice ("All terms", "Select term…"); omit for no empty choice. */
  emptyLabel?: string;
};

/** A term picker grouped by academic year. Every school has a "Term 1" each year. */
export function TermSelect({ terms, years, value, onChange, emptyLabel, className, ...props }: TermSelectProps) {
  const groups = years
    .map(y => ({ year: y, terms: terms.filter(t => t.academic_year_id === y.id) }))
    .filter(g => g.terms.length > 0);
  const known = new Set(groups.flatMap(g => g.terms.map(t => t.id)));
  const orphans = terms.filter(t => !known.has(t.id));

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={cn('input-field w-full', className)} {...props}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {groups.map(g => (
        <optgroup key={g.year.id} label={g.year.name}>
          {g.terms.map(t => <option key={t.id} value={t.id}>{t.name} · {g.year.name}</option>)}
        </optgroup>
      ))}
      {orphans.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}
