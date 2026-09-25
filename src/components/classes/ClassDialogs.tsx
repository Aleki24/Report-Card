"use client";

import React, { useId, useState } from 'react';
import { toast } from 'sonner';
import { FormField, InputField, Modal } from '@/components/ui';
import { classNames, parseStreamNames } from '@/lib/classes';
import type { ClassSummary, CurriculumOption, GradeOption } from '@/lib/classes-overview';
import { createClasses, renameClass } from './classApi';

interface AddGradeModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
  /** Grades the school has no class in yet. */
  grades: GradeOption[];
  curricula: CurriculumOption[];
}

export function AddGradeModal(props: AddGradeModalProps) {
  return props.open ? <AddGrade {...props} /> : null;
}

function AddGrade({ onClose, onAdded, grades, curricula }: AddGradeModalProps) {
  const id = useId();
  const [gradeId, setGradeId] = useState('');
  const [streams, setStreams] = useState('');
  const [saving, setSaving] = useState(false);
  const grade = grades.find(g => g.id === gradeId);
  const names = parseStreamNames(streams);
  const preview = grade ? (names.length ? names.map(n => classNames(grade.name_display, n).full_name) : [grade.name_display]) : [];

  const save = async () => {
    if (!grade) return;
    setSaving(true);
    try {
      const { created, errors } = await createClasses(grade.id, grade.name_display, names);
      errors.forEach(msg => toast.error(msg));
      if (created > 0) {
        toast.success(`${grade.name_display} added with ${created} class${created === 1 ? '' : 'es'}`);
        await onAdded();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  // Grouped by curriculum so CBC's Grade 10 and 8-4-4's Form 3 aren't one long list.
  const groups = curricula
    .map(c => ({ curriculum: c, grades: grades.filter(g => g.academic_level_id === c.id) }))
    .filter(g => g.grades.length > 0);

  return (
    <Modal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      title="Add a grade"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || !grade}>{saving ? 'Adding…' : preview.length > 1 ? `Add ${preview.length} classes` : 'Add grade'}</button>
      </>}
    >
      <div className="space-y-4">
        <FormField label="Grade" required htmlFor={`${id}-grade`}>
          <select id={`${id}-grade`} className="input-field w-full" value={gradeId} onChange={e => setGradeId(e.target.value)} autoFocus>
            <option value="">Choose a grade</option>
            {groups.map(({ curriculum, grades: gs }) => (
              <optgroup key={curriculum.id} label={curriculum.name}>
                {gs.map(g => <option key={g.id} value={g.id}>{g.name_display}</option>)}
              </optgroup>
            ))}
          </select>
        </FormField>
        <FormField label="Streams" htmlFor={`${id}-streams`} hint="Separate with commas. Leave empty if the grade has just one class.">
          <InputField id={`${id}-streams`} placeholder="e.g. East, West" value={streams} onChange={e => setStreams(e.target.value)} />
        </FormField>
        {preview.length > 0 && (
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">This creates</p>
            <ul className="flex flex-wrap gap-1.5">
              {preview.map(n => <li key={n} className="rounded-lg border border-border bg-card px-2.5 py-1 text-sm font-medium">{n}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface RenameClassModalProps {
  cls: ClassSummary | null;
  gradeName: string;
  onClose: () => void;
  onRenamed: () => Promise<void>;
}

export function RenameClassModal({ cls, ...rest }: RenameClassModalProps) {
  return cls ? <RenameClass key={cls.id} cls={cls} {...rest} /> : null;
}

function RenameClass({ cls, gradeName, onClose, onRenamed }: RenameClassModalProps & { cls: ClassSummary }) {
  const id = useId();
  const [name, setName] = useState(cls.name);
  const [fullName, setFullName] = useState(cls.full_name);
  // While the full name is the one the stream name would give, it follows it.
  const [fullNameTouched, setFullNameTouched] = useState(() => cls.full_name !== classNames(gradeName, cls.name === gradeName ? '' : cls.name).full_name);
  const [saving, setSaving] = useState(false);

  const changeName = (value: string) => {
    setName(value);
    if (!fullNameTouched) setFullName(classNames(gradeName, value.trim() === gradeName ? '' : value).full_name);
  };

  const save = async () => {
    setSaving(true);
    try {
      await renameClass(cls.id, name.trim(), fullName.trim());
      toast.success(`Renamed to ${fullName.trim()}`);
      await onRenamed();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rename the class.');
    } finally {
      setSaving(false);
    }
  };

  const unchanged = name.trim() === cls.name && fullName.trim() === cls.full_name;

  return (
    <Modal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      title={`Rename ${cls.full_name}`}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || unchanged || !name.trim() || !fullName.trim()}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <div className="space-y-4">
        <FormField label="Stream name" required htmlFor={`${id}-name`} hint="The short name, e.g. East.">
          <InputField id={`${id}-name`} value={name} onChange={e => changeName(e.target.value)} maxLength={50} autoFocus />
        </FormField>
        <FormField label="Full name" required htmlFor={`${id}-full`} hint="Shown on mark sheets and report cards.">
          <InputField id={`${id}-full`} value={fullName} onChange={e => { setFullName(e.target.value); setFullNameTouched(true); }} maxLength={100} />
        </FormField>
        <p className="text-xs text-muted-foreground">Students, teachers and exams stay with the class; only its name changes.</p>
      </div>
    </Modal>
  );
}
