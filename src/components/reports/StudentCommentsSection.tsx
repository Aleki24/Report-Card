"use client";

import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { SearchBox } from '@/components/ui/SearchBox';
import { StepHeading } from '@/components/ui/StepHeading';
import { matchesLearner } from '@/lib/reports/class-roster';
import { cn } from '@/lib/utils';
import { LearnerAvatar } from './ReportDialog';

export interface StudentComment {
  student_id: string;
  admission_number: string;
  student_name: string;
  comments_class_teacher: string;
  comments_principal: string;
}

export type CommentField = 'comments_class_teacher' | 'comments_principal';

interface StudentCommentsSectionProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  /** null while loading. */
  comments: StudentComment[] | null;
  /** Learners edited since the last save. */
  dirtyIds: ReadonlySet<string>;
  /** 'all', one learner's id, or null. */
  saving: string | null;
  onChange: (studentId: string, field: CommentField, value: string) => void;
  /** Saves the given learners, or every edited one when omitted. */
  onSave: (studentIds?: string[]) => void;
  /** Only an admin writes the principal's comment; others see it read-only. */
  canEditPrincipalComment: boolean;
}

const initialsOf = (name: string) => name.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';

export function StudentCommentsSection({ open, setOpen, comments, dirtyIds, saving, onChange, onSave, canEditPrincipalComment }: StudentCommentsSectionProps) {
  const id = useId();
  const [search, setSearch] = useState('');
  const shown = useMemo(
    () => (comments ?? []).filter(c => matchesLearner({ name: c.student_name, admission_number: c.admission_number }, search)),
    [comments, search],
  );
  const unsaved = dirtyIds.size;

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StepHeading step={3} title="Comments on the cards" />
            <p className="mt-1 text-xs text-muted-foreground sm:pl-[2.625rem]">
              The class teacher&apos;s and principal&apos;s remarks for each learner this term. Leave one blank and the card writes a remark from the learner&apos;s results.
            </p>
          </div>
          <button type="button" className="btn-secondary h-9 shrink-0 text-xs" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            {open ? 'Hide' : 'Show'}
          </button>
        </div>

        {open && (
          <div id={`${id}-panel`} className="mt-4">
            <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-col gap-2 bg-card px-1 pb-2 sm:flex-row sm:items-center">
              <SearchBox value={search} onChange={setSearch} placeholder="Search by name or admission number" className="flex-1" />
              <button type="button" className="btn-primary h-10 text-sm" onClick={() => onSave()} disabled={saving !== null || unsaved === 0}>
                {saving === 'all' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                {saving === 'all' ? 'Saving…' : unsaved > 0 ? `Save ${unsaved} change${unsaved === 1 ? '' : 's'}` : 'All saved'}
              </button>
            </div>

            {comments === null ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading learners…</p>
            ) : shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{search ? 'No learner matches that search.' : 'This class has no learners yet.'}</p>
            ) : (
              <ul className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
                {shown.map(c => {
                  const dirty = dirtyIds.has(c.student_id);
                  const rowId = `${id}-${c.student_id}`;
                  return (
                    <li key={c.student_id} className={cn('rounded-xl border bg-card p-3 sm:p-4', dirty ? 'border-amber-500/50' : 'border-border/70')}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <LearnerAvatar initials={initialsOf(c.student_name)} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{c.student_name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {c.admission_number}
                              {dirty && <span className="ml-2 font-sans font-medium text-amber-600 dark:text-amber-400">Unsaved</span>}
                            </p>
                          </div>
                        </div>
                        <button type="button" className="btn-secondary h-8 shrink-0 text-xs" onClick={() => onSave([c.student_id])} disabled={!dirty || saving !== null}>
                          {saving === c.student_id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
                          Save
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor={`${rowId}-teacher`} className="text-[11px] font-medium text-muted-foreground">Class teacher</label>
                          <textarea id={`${rowId}-teacher`} className="input-field w-full text-sm" rows={2} maxLength={1000} placeholder="e.g. Excellent progress this term" value={c.comments_class_teacher} onChange={e => onChange(c.student_id, 'comments_class_teacher', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor={`${rowId}-principal`} className="text-[11px] font-medium text-muted-foreground">Principal</label>
                          <textarea id={`${rowId}-principal`} className="input-field w-full text-sm read-only:cursor-not-allowed read-only:opacity-70" rows={2} maxLength={1000} placeholder={canEditPrincipalComment ? 'e.g. Keep up the good work' : 'Written by the principal'} readOnly={!canEditPrincipalComment} value={c.comments_principal} onChange={e => onChange(c.student_id, 'comments_principal', e.target.value)} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
