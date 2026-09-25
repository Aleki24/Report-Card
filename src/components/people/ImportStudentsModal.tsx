"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileSpreadsheet, Upload } from 'lucide-react';
import { FormField, Modal, SelectField } from '@/components/ui';
import { parseTabularFile, normalizeRowKeys, IMPORT_FILE_ACCEPT } from '@/lib/import/parse-tabular-file';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import { normalizeGender } from '@/lib/gender';
import type { AcademicLevelOption, CreatedCredential, GradeStreamOption, ImportRow } from './peopleTypes';

interface ImportResponse {
  imported?: number;
  message?: string;
  skipped_rows?: { row: ImportRow; reason: string }[];
  created_credentials?: CreatedCredential[];
}

/** Reads one spreadsheet row, accepting the column names schools actually use. */
function toImportRow(raw: Record<string, string>, academicLevelId: string): ImportRow {
  const row = normalizeRowKeys(raw);
  let first = row.firstname || row.first || '';
  let last = row.lastname || row.last || row.surname || '';
  const full = row.name || row.fullname || row.studentname;
  if (!first && !last && full) {
    const parts = full.trim().split(/\s+/);
    first = parts[0];
    last = parts.slice(1).join(' ');
  }
  return {
    first_name: first,
    last_name: last,
    admission_number: row.admissionnumber || row.admissionno || row.admno || row.adm || '',
    gender: normalizeGender(row.gender || row.sex) ?? '',
    date_of_birth: row.dateofbirth || row.dob || row.birthdate || '',
    guardian_phone: row.guardianphone || row.phone || row.parentphone || row.contact || '',
    guardian_name: row.guardianname || row.parentname || row.guardian || row.parent || '',
    guardian_email: row.guardianemail || row.parentemail || row.email || '',
    class: row.class || row.grade || row.form || row.level || '',
    stream: row.stream || row.section || '',
    academic_level_id: academicLevelId,
  };
}

const EDITABLE: readonly { key: 'first_name' | 'last_name' | 'admission_number'; label: string; placeholder?: string }[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'admission_number', label: 'Adm. no.', placeholder: 'Optional' },
];

interface ImportStudentsModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (created: CreatedCredential[]) => void;
  gradeStreams: GradeStreamOption[];
  academicLevels: AcademicLevelOption[];
  /** Pre-selects this class (the filter in use), if any. */
  defaultClassId: string;
}

export function ImportStudentsModal(props: ImportStudentsModalProps) {
  return props.open ? <ImportStudents {...props} /> : null;
}

function ImportStudents({ onClose, onImported, gradeStreams, academicLevels, defaultClassId }: ImportStudentsModalProps) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  /** Why each row was skipped last time, by index into `rows`. */
  const [reasons, setReasons] = useState<string[]>([]);
  const [classId, setClassId] = useState(() => (gradeStreams.length === 1 ? gradeStreams[0].id : defaultClassId));
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const editRow = (index: number, patch: Partial<ImportRow>) =>
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const readFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Excel as well as CSV: schools keep their rosters in .xlsx.
      const { rows: raw } = await parseTabularFile(file);
      const levelId = academicLevels.length === 1 ? academicLevels[0].id : '';
      const parsed = raw.map(r => toImportRow(r, levelId)).filter(r => r.first_name || r.last_name);
      if (parsed.length === 0) {
        toast.error('No student rows found. Check the file has a heading row with a name column.');
        return;
      }
      setRows(parsed);
      setReasons([]);
      setFileName(file.name);
    } catch (err) {
      console.error('Import parse failed:', err);
      toast.error('Could not read that file. Use a CSV or Excel (.xlsx) file.');
    }
  };

  const submit = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/admin/bulk-import-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: rows, default_grade_stream_id: classId || undefined }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not import the students.'));
      const r = (json ?? {}) as ImportResponse;
      const skipped = r.skipped_rows ?? [];
      const created = r.created_credentials ?? [];
      if (skipped.length > 0) {
        // Keep only the rows that failed, with why, so they can be fixed and retried.
        toast.warning(`Imported ${r.imported ?? 0}, skipped ${skipped.length}`);
        setRows(skipped.map(s => s.row));
        setReasons(skipped.map(s => s.reason));
        onImported(created);
      } else {
        toast.success(r.message || 'Students imported');
        onImported(created);
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import the students.');
    } finally {
      setImporting(false);
    }
  };

  const skippedCount = reasons.filter(Boolean).length;

  return (
    <Modal
      isOpen
      onClose={() => { if (!importing) onClose(); }}
      title="Import students"
      size="lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={importing}>Cancel</button>
        <button type="button" className="btn-primary" onClick={submit} disabled={importing || rows.length === 0 || !classId}>
          {importing ? 'Importing…' : skippedCount > 0 ? `Retry ${rows.length} student${rows.length === 1 ? '' : 's'}` : `Import ${rows.length || ''} student${rows.length === 1 ? '' : 's'}`}
        </button>
      </>}
    >
      <div className="space-y-4">
        <FormField label="Class" required hint="Everyone in the file joins this class.">
          <SelectField placeholder="Choose a class" value={classId} onChange={setClassId} options={gradeStreams.map(gs => ({ id: gs.id, label: gs.full_name }))} />
        </FormField>

        <label className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          rows.length > 0 ? 'border-emerald-500/40 bg-emerald-500/[0.05]' : 'border-border hover:border-primary/50 hover:bg-muted/40',
        )}>
          <span className={cn('flex size-11 items-center justify-center rounded-xl', rows.length > 0 ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary')}>
            {rows.length > 0 ? <FileSpreadsheet className="size-5" aria-hidden /> : <Upload className="size-5" aria-hidden />}
          </span>
          <span className="text-sm font-medium">{rows.length > 0 ? fileName : 'Choose a CSV or Excel file'}</span>
          <span className="text-xs text-muted-foreground">
            {rows.length > 0 ? `${rows.length} student${rows.length === 1 ? '' : 's'} found · choose another file to replace` : 'Columns: first_name, last_name, admission_number, gender, guardian_name, guardian_phone'}
          </span>
          <input type="file" accept={IMPORT_FILE_ACCEPT} className="sr-only" onChange={readFile} />
        </label>

        {skippedCount > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span><strong>{skippedCount} student{skippedCount === 1 ? '' : 's'} skipped.</strong> Fix the rows below and import again.</span>
          </p>
        )}

        {rows.length > 0 && (
          <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border">
            {rows.map((row, i) => (
              <li key={i} className={cn('grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-[1fr_1fr_8rem_7rem]', reasons[i] && 'bg-rose-500/[0.05]')}>
                {EDITABLE.map(f => (
                  <input
                    key={f.key}
                    aria-label={`${f.label}, row ${i + 1}`}
                    placeholder={f.placeholder ?? f.label}
                    className="input-field h-9 px-2.5 text-xs"
                    value={row[f.key]}
                    onChange={e => editRow(i, { [f.key]: e.target.value })}
                  />
                ))}
                <select aria-label={`Gender, row ${i + 1}`} className="input-field h-9 px-2.5 text-xs" value={row.gender} onChange={e => editRow(i, { gender: e.target.value })}>
                  <option value="">Gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
                </select>
                {reasons[i] && <p className="col-span-full text-[11px] font-medium text-rose-600 dark:text-rose-400">{reasons[i]}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
