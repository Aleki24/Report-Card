"use client";

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckSquare, Square } from 'lucide-react';
import { FormField, Modal, SelectField } from '@/components/ui';
import { pathwayLabel } from '@/lib/pathway-definitions';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import { SearchBox } from './PeopleUi';
import { admNoLabel, errorMessage, studentName, type CombinationOption, type GradeStreamOption, type StudentRow } from './peopleTypes';

interface BulkPathwayModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** CBC Senior School (Grades 10–12) students: the only ones pathways apply to. */
  students: StudentRow[];
  seniorStreams: GradeStreamOption[];
  combinations: CombinationOption[];
  /** Pre-selects this class (the filter in use) when it is a senior one. */
  defaultStreamId: string;
}

export function BulkPathwayModal(props: BulkPathwayModalProps) {
  return props.open ? <BulkPathway {...props} /> : null;
}

function BulkPathway({ onClose, onSaved, students, seniorStreams, combinations, defaultStreamId }: BulkPathwayModalProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [streamId, setStreamId] = useState(() => (seniorStreams.some(s => s.id === defaultStreamId) ? defaultStreamId : ''));
  const [search, setSearch] = useState('');
  const [combinationId, setCombinationId] = useState('');
  const [clear, setClear] = useState(false);
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s =>
      (!streamId || s.current_grade_stream_id === streamId)
      && (!q || `${studentName(s)} ${s.admission_number ?? ''}`.toLowerCase().includes(q)));
  }, [students, streamId, search]);

  const allShownSelected = shown.length > 0 && shown.every(s => selected.has(s.id));

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const toggleShown = () => setSelected(prev => {
    const next = new Set(prev);
    for (const s of shown) {
      if (allShownSelected) next.delete(s.id);
      else next.add(s.id);
    }
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/student-pathways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: Array.from(selected), subject_combination_id: clear ? null : combinationId, pathway: null, track: null }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not update pathways.'));
      const r = (json ?? {}) as { updated?: number; warnings?: string[] };
      const warnings = r.warnings?.length ? ` (${r.warnings.length} subject sync warning${r.warnings.length === 1 ? '' : 's'})` : '';
      toast.success(`${r.updated ?? selected.size} student${r.updated === 1 ? '' : 's'} ${clear ? 'cleared' : 'assigned'}${warnings}`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const count = selected.size;
  const noun = `student${count === 1 ? '' : 's'}`;

  return (
    <Modal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      title="Pathways & subject combinations"
      size="lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || count === 0 || (!clear && !combinationId)}>
          {saving ? 'Saving…' : clear ? `Clear ${count} ${noun}` : `Assign ${count} ${noun}`}
        </button>
      </>}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Move Senior School students (Grades 10–12) to a subject combination. Their subjects — three electives plus the compulsory core — update to match.
      </p>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <select className="input-field" aria-label="Class" value={streamId} onChange={e => setStreamId(e.target.value)}>
          <option value="">All senior classes</option>
          {seniorStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
        </select>
        <SearchBox value={search} onChange={setSearch} placeholder="Search students" />
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs">
          <button type="button" onClick={toggleShown} disabled={shown.length === 0} className="inline-flex items-center gap-2 font-medium text-foreground disabled:opacity-50">
            {allShownSelected ? <CheckSquare className="size-4 text-primary" aria-hidden /> : <Square className="size-4 text-muted-foreground" aria-hidden />}
            {allShownSelected ? 'Unselect these' : `Select all ${shown.length}`}
          </button>
          <span className="text-muted-foreground">{count} selected</span>
        </div>
        <ul className="max-h-72 min-h-[10rem] overflow-y-auto">
          {shown.length === 0 ? (
            <li className="px-4 py-10 text-center text-xs text-muted-foreground">
              {seniorStreams.length === 0
                ? 'No Grade 10–12 classes yet. Pathways only apply to Senior School students.'
                : 'No Senior School students match.'}
            </li>
          ) : shown.map(s => (
            <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 hover:bg-muted/40">
                <input type="checkbox" className="size-4 accent-primary" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{studentName(s)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{s.grade_streams?.full_name ?? 'No class'} · {admNoLabel(s.admission_number)}</span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', s.subject_combinations ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
                  {s.subject_combinations?.code ?? 'Unassigned'}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <FormField label="Assign to combination">
          <SelectField
            placeholder="Choose a combination"
            value={combinationId}
            disabled={clear}
            onChange={setCombinationId}
            options={combinations.filter(c => c.is_active).map(c => ({ id: c.id, label: `${c.code} — ${c.name} (${pathwayLabel(c.pathway)}${c.track ? ` / ${c.track}` : ''})` }))}
          />
        </FormField>
        <label className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="size-4 accent-primary" checked={clear} onChange={e => setClear(e.target.checked)} /> Clear instead
        </label>
      </div>
    </Modal>
  );
}
