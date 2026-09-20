"use client";

import React, { useMemo } from 'react';
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
    <div className="border-t border-border pt-4 mt-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Subject Teacher Assignment
      </p>

      {entries.map((st, i) => {
        const grade = st.grade_id ? gradeById.get(st.grade_id) : undefined;
        const options = subjectsForGrade(subjects, grade);

        return (
          <div key={i} className="mb-3 flex flex-col gap-2 xs:flex-row xs:items-start">
            {/* Class first: it decides which subjects are on offer. */}
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-[10px] text-muted-foreground">Grade Level</label>
              <select
                className="input-field input-field-sm w-full"
                value={st.grade_id}
                onChange={e => chooseGrade(i, e.target.value)}
              >
                <option value="">— Grade —</option>
                {gradeOptions.map(g => (
                  <option key={g.id} value={g.id}>{g.name_display}</option>
                ))}
              </select>
            </div>

            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-[10px] text-muted-foreground">Subject</label>
              <select
                className="input-field input-field-sm w-full"
                value={st.subject_id}
                onChange={e => update(i, { subject_id: e.target.value })}
              >
                <option value="">— Subject —</option>
                {options.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}{sub.code ? ` (${sub.code})` : ''}
                  </option>
                ))}
              </select>
              {grade && options.length === 0 && (
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  No subjects are set up for {grade.name_display} yet.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEntries(entries.filter((_, idx) => idx !== i))}
              aria-label="Remove this subject assignment"
              className="self-end rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-destructive xs:mt-6 xs:self-auto"
            >
              &times;
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setEntries([...entries, { subject_id: '', grade_id: '' }])}
        className="mt-1 text-xs font-medium text-primary hover:underline"
      >
        + Add Subject
      </button>
    </div>
  );
}
