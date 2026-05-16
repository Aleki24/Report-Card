"use client";

import React from 'react';
import { type GradeStreamOption, type SubjectOption, type GradeOption } from '@/hooks/useUsersPage';

interface SubjectTeacherFieldsProps {
  subjects: SubjectOption[];
  grades: GradeOption[];
  gradeStreams: GradeStreamOption[];
  entries: {subject_id: string, grade_id: string}[];
  setEntries: (v: {subject_id: string, grade_id: string}[]) => void;
}

export function SubjectTeacherFields({ subjects, grades, gradeStreams, entries, setEntries }: SubjectTeacherFieldsProps) {
  return (
    <div className="border-t border-border pt-4 mt-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Subject Teacher Assignment</p>
      {entries.map((st, i) => (
        <div key={i} className="flex items-start gap-2 mb-2">
          <div className="flex-1">
            <label className="block text-[10px] text-muted-foreground mb-1">Subject</label>
            <select className="input-field w-full py-1 text-sm" value={st.subject_id} onChange={e => {
              const newSubj = [...entries]; newSubj[i].subject_id = e.target.value; setEntries(newSubj);
            }}>
              <option value="">-- Subject --</option>
              {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-muted-foreground mb-1">Grade Level</label>
            <select className="input-field w-full py-1 text-sm" value={st.grade_id} onChange={e => {
              const newSubj = [...entries]; newSubj[i].grade_id = e.target.value; setEntries(newSubj);
            }}>
              <option value="">-- Grade --</option>
              {grades.filter(g => gradeStreams.some(gs => gs.grade_id === g.id)).map(g => <option key={g.id} value={g.id}>{g.name_display}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setEntries(entries.filter((_, idx) => idx !== i))} className="mt-6 text-red-500 hover:text-red-400 p-1">&times;</button>
        </div>
      ))}
      <button type="button" onClick={() => setEntries([...entries, { subject_id: '', grade_id: '' }])} className="text-xs text-primary hover:underline mt-1">+ Add Subject</button>
    </div>
  );
}
