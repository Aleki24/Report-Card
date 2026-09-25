"use client";

import React, { useId, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { filterSubjectsForGrade } from '@/lib/curriculum-bands';
import { type GradeStreamOption, type SubjectOption, type GradeOption } from '@/hooks/useUsersPage';

interface SubjectTeacherFieldsProps {
  subjects: SubjectOption[];
  grades: GradeOption[];
  gradeStreams: GradeStreamOption[];
  entries: { subject_id: string; grade_id: string }[];
  setEntries: (v: { subject_id: string; grade_id: string }[]) => void;
}

/**
 * What a class actually takes.
 *
 * Two cuts, because one is not enough. The academic level separates CBC from
 * 8-4-4; the curriculum band separates Grade 4 from Grade 12, which share a
 * single CBC level. Without the second cut a Grade 4 assignment was offered
 * Community Service Learning and Essential Mathematics — Senior School
 * subjects — alongside every 8-4-4 subject in the school.
 *
 * A subject we cannot place stays on offer: a school's own invention belongs
 * wherever the school says.
 */
function subjectsForGrade(subjects: SubjectOption[], grade: GradeOption | undefined): SubjectOption[] {
  if (!grade) return subjects;
  const sameLevel = grade.academic_level_id
    ? subjects.filter(s => !s.academic_level_id || s.academic_level_id === grade.academic_level_id)
    : subjects;
  return filterSubjectsForGrade(sameLevel, grade);
}

export function SubjectTeacherFields({ subjects, grades, gradeStreams, entries, setEntries }: SubjectTeacherFieldsProps) {
  const idBase = useId();
  const gradeById = useMemo(() => new Map(grades.map(g => [g.id, g])), [grades]);

  // Only grades the school actually runs a class for.
  const gradeOptions = useMemo(
    () => grades.filter(g => gradeStreams.some(gs => gs.grade_id === g.id)),
    [grades, gradeStreams],
  );

  const update = (i: number, patch: Partial<{ subject_id: string; grade_id: string }>) => {
    const next = entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    setEntries(next);
  };

  const chooseGrade = (i: number, gradeId: string) => {
    // Changing the class can strand a subject that class does not take, so drop
    // it rather than leave an invalid pair to be submitted.
    const stillOffered = subjectsForGrade(subjects, gradeById.get(gradeId))
      .some(s => s.id === entries[i].subject_id);
    update(i, { grade_id: gradeId, ...(stillOffered ? {} : { subject_id: '' }) });
  };

  return (
    <fieldset className="mt-5 border-t border-border pt-5">
      <legend className="sr-only">Subject teacher assignments</legend>
      <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Subjects taught</p>
      <p className="mb-4 text-xs text-muted-foreground">The grades and subjects this teacher enters marks for.</p>

      {entries.map((st, i) => {
        const grade = st.grade_id ? gradeById.get(st.grade_id) : undefined;
        const options = subjectsForGrade(subjects, grade);

        return (
          <div key={i} className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-3 rounded-xl border border-border/70 bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            {/* Class first: it decides which subjects are on offer. */}
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <label htmlFor={`${idBase}-grade-${i}`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Grade</label>
              <select
                id={`${idBase}-grade-${i}`}
                className="input-field w-full"
                value={st.grade_id}
                onChange={e => chooseGrade(i, e.target.value)}
              >
                <option value="">Select grade</option>
                {gradeOptions.map(g => (
                  <option key={g.id} value={g.id}>{g.name_display}</option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor={`${idBase}-subject-${i}`} className="mb-1.5 block text-xs font-medium text-muted-foreground">Subject</label>
              <select
                id={`${idBase}-subject-${i}`}
                className="input-field w-full"
                value={st.subject_id}
                onChange={e => update(i, { subject_id: e.target.value })}
              >
                <option value="">Select subject</option>
                {options.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}{sub.code ? ` (${sub.code})` : ''}
                  </option>
                ))}
              </select>
              {grade && options.length === 0 && (
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  No subjects are set up for {grade.name_display} yet.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEntries(entries.filter((_, idx) => idx !== i))}
              aria-label="Remove this subject assignment"
              title="Remove"
              className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setEntries([...entries, { subject_id: '', grade_id: '' }])}
        className="btn-secondary mt-1 h-10 w-full border-dashed text-sm sm:w-auto"
      >
        <Plus className="size-4" aria-hidden="true" />Add subject
      </button>
    </fieldset>
  );
}
