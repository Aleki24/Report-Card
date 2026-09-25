"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { classDeleteBlocker, type ClassSummary, type GradeOption } from '@/lib/classes-overview';
import { parseStreamNames } from '@/lib/classes';
import { TONES, type Hue } from '@/components/ui/tones';
import { cn } from '@/lib/utils';
import { createClasses } from './classApi';

function ClassRow({ cls, hue, onRename, onDelete }: { cls: ClassSummary; hue: Hue; onRename: () => void; onDelete: () => void }) {
  const { activeStudents } = cls.usage;
  const blocked = classDeleteBlocker(cls.usage) !== null;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold', TONES[hue].tile)} aria-hidden>
        {cls.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{cls.full_name}</p>
        <p className={cn('flex items-center gap-1 truncate text-xs', cls.class_teachers.length ? 'text-muted-foreground' : 'font-medium text-amber-600 dark:text-amber-400')}>
          <UserRound className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{cls.class_teachers.length ? cls.class_teachers.join(', ') : 'No class teacher'}</span>
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums" title={`${activeStudents} enrolled student${activeStudents === 1 ? '' : 's'}`}>
        <Users className="size-3 text-muted-foreground" aria-hidden />{activeStudents}
      </span>
      <span className="flex shrink-0">
        <button type="button" className="btn-icon text-muted-foreground hover:text-foreground" onClick={onRename} aria-label={`Rename ${cls.full_name}`} title="Rename">
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          className={cn('btn-icon', blocked ? 'text-muted-foreground/60 hover:text-muted-foreground' : 'text-destructive/80 hover:text-destructive')}
          onClick={onDelete}
          aria-label={`Delete ${cls.full_name}`}
          title={blocked ? "Can't delete: this class is in use" : 'Delete'}
        >
          <Trash2 className="size-4" />
        </button>
      </span>
    </li>
  );
}

interface GradeCardProps {
  grade: GradeOption;
  classes: ClassSummary[];
  hue: Hue;
  onChanged: () => Promise<void>;
  onRename: (cls: ClassSummary) => void;
  onDelete: (cls: ClassSummary) => void;
}

/** One grade the school teaches: its classes, and a quick way to add more. */
export function GradeCard({ grade, classes, hue, onChanged, onRename, onDelete }: GradeCardProps) {
  const [streams, setStreams] = useState('');
  const [adding, setAdding] = useState(false);
  const students = classes.reduce((n, c) => n + c.usage.activeStudents, 0);
  const inputId = `add-class-${grade.id}`;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = parseStreamNames(streams);
    if (names.length === 0) return;
    setAdding(true);
    try {
      const { created, errors } = await createClasses(grade.id, grade.name_display, names);
      errors.forEach(msg => toast.error(msg));
      if (created > 0) {
        toast.success(`${created} class${created === 1 ? '' : 'es'} added to ${grade.name_display}`);
        setStreams('');
        await onChanged();
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{grade.name_display}</h3>
          <p className="text-xs text-muted-foreground">
            {classes.length} class{classes.length === 1 ? '' : 'es'} · {students.toLocaleString()} student{students === 1 ? '' : 's'}
          </p>
        </div>
        <span className={cn('size-2.5 shrink-0 rounded-full', TONES[hue].dot)} aria-hidden />
      </header>

      <ul className="mt-2 divide-y divide-border/60">
        {classes.map(c => (
          <ClassRow key={c.id} cls={c} hue={hue} onRename={() => onRename(c)} onDelete={() => onDelete(c)} />
        ))}
      </ul>

      <form onSubmit={add} className="mt-auto flex gap-2 border-t border-border/60 pt-3">
        <label htmlFor={inputId} className="sr-only">Add streams to {grade.name_display}</label>
        <input
          id={inputId}
          className="input-field h-9 min-w-0 flex-1 text-sm"
          placeholder="Add streams, e.g. East, West"
          value={streams}
          onChange={e => setStreams(e.target.value)}
          disabled={adding}
        />
        <button type="submit" className="btn-secondary h-9 shrink-0 px-3" disabled={adding || parseStreamNames(streams).length === 0} aria-label={`Add to ${grade.name_display}`}>
          {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>
    </article>
  );
}
