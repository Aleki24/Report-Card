"use client";

import React, { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Users } from 'lucide-react';
import { ConfirmDialog, DataTable, FormField, InputField, Modal, SearchBox, SelectField, type DataTableColumn } from '@/components/ui';
import { SUBJECT_CATEGORY_THEME, subjectCategory, type SubjectCategory } from '@/components/ui/subjectCategories';
import { isSubjectOfferedAtGrade, subjectBandLabel } from '@/lib/curriculum-bands';
import { apiErrorMessage } from '@/lib/api-error-message';
import { cn } from '@/lib/utils';
import SubjectCatalogueChecklist from './SubjectCatalogueChecklist';
import SubjectEnrollmentManager from './SubjectEnrollmentManager';
import type { AcademicLevel, GradeRow, GradingSystem, OfferedSubject } from './subjectTypes';

const STRUCTURE_URL = '/api/admin/academic-structure';

const TYPE_STYLE: Record<NonNullable<OfferedSubject['subject_type']>, { label: string; className: string }> = {
    CORE: { label: 'Core', className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
    ESSENTIAL: { label: 'Essential', className: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
    OPTIONAL: { label: 'Optional', className: 'bg-amber-500/12 text-amber-700 dark:text-amber-300' },
};

const CATEGORY_OPTIONS = (Object.keys(SUBJECT_CATEGORY_THEME) as SubjectCategory[])
    .filter(c => c !== 'OTHER')
    .map(c => ({ id: c, label: SUBJECT_CATEGORY_THEME[c].label }));

const TYPE_OPTIONS = (Object.keys(TYPE_STYLE) as (keyof typeof TYPE_STYLE)[]).map(t => ({ id: t, label: TYPE_STYLE[t].label }));

function CategoryChip({ category }: { category: SubjectCategory }) {
    const theme = SUBJECT_CATEGORY_THEME[category];
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', theme.tone.tile)}>
            <theme.icon className="size-3" aria-hidden />{theme.label}
        </span>
    );
}

const EMPTY_CUSTOM = { name: '', code: '', academic_level_id: '', category: 'TECHNICAL', subject_type: 'CORE' };

/** A subject the national list doesn't have; it stays private to this school. */
function CustomSubjectModal({ open, onClose, onAdded, academicLevels, takenCodes }: {
    open: boolean;
    onClose: () => void;
    onAdded: () => Promise<void>;
    academicLevels: AcademicLevel[];
    takenCodes: ReadonlySet<string>;
}) {
    const id = useId();
    const [form, setForm] = useState(EMPTY_CUSTOM);
    const [saving, setSaving] = useState(false);
    const set = (key: keyof typeof EMPTY_CUSTOM, value: string) => setForm(p => ({ ...p, [key]: value }));
    const code = form.code.trim().toUpperCase();
    const codeTaken = code !== '' && takenCodes.has(code);

    const close = () => { if (!saving) { setForm(EMPTY_CUSTOM); onClose(); } };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch(STRUCTURE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'subject', ...form, name: form.name.trim(), code }),
            });
            if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not add the subject.'));
            toast.success(`${form.name.trim()} added`);
            // Cleared only once it saved, so a failure keeps what was typed.
            setForm(EMPTY_CUSTOM);
            await onAdded();
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not add the subject.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={close}
            title="Add a custom subject"
            footer={<>
                <button type="button" className="btn-secondary" onClick={close} disabled={saving}>Cancel</button>
                <button type="button" className="btn-primary" onClick={save} disabled={saving || !form.name.trim() || !code || codeTaken || !form.academic_level_id}>
                    {saving ? 'Adding…' : 'Add subject'}
                </button>
            </>}
        >
            <p className="mb-4 text-sm text-muted-foreground">Only for something your school teaches that has no official code. Official subjects are ticked in the list instead.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <FormField label="Name" required htmlFor={`${id}-name`}>
                    <InputField id={`${id}-name`} placeholder="e.g. Chess" value={form.name} maxLength={100} onChange={e => set('name', e.target.value)} />
                </FormField>
                <FormField label="Code" required htmlFor={`${id}-code`} error={codeTaken ? 'Already used' : undefined}>
                    <InputField id={`${id}-code`} className="font-mono uppercase" placeholder="CHS" value={form.code} maxLength={20} onChange={e => set('code', e.target.value.toUpperCase())} />
                </FormField>
                <FormField label="Curriculum" required htmlFor={`${id}-level`}>
                    <SelectField id={`${id}-level`} placeholder="Choose…" value={form.academic_level_id} onChange={v => set('academic_level_id', v)} options={academicLevels.map(l => ({ id: l.id, label: l.name }))} />
                </FormField>
                <FormField label="Type" htmlFor={`${id}-type`}>
                    <SelectField id={`${id}-type`} placeholder={null} value={form.subject_type} onChange={v => set('subject_type', v)} options={TYPE_OPTIONS} />
                </FormField>
                <FormField label="Category" htmlFor={`${id}-cat`} className="sm:col-span-2">
                    <SelectField id={`${id}-cat`} placeholder={null} value={form.category} onChange={v => set('category', v)} options={CATEGORY_OPTIONS} />
                </FormField>
            </div>
        </Modal>
    );
}

interface OfferedSubjectsTabProps {
    isAdmin: boolean;
    subjects: OfferedSubject[];
    gradingSystems: GradingSystem[];
    academicLevels: AcademicLevel[];
    grades: GradeRow[];
    onChanged: () => Promise<void>;
}

/** The subjects the school offers: pick from the national list, and set each one's grading and learners. */
export function OfferedSubjectsTab({ isAdmin, subjects, gradingSystems, academicLevels, grades, onChanged }: OfferedSubjectsTabProps) {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<SubjectCategory | 'ALL'>('ALL');
    const [levelOrGrade, setLevelOrGrade] = useState('');
    const [addingCustom, setAddingCustom] = useState(false);
    const [removing, setRemoving] = useState<{ subject: OfferedSubject; examCount: number | null } | null>(null);
    const [busy, setBusy] = useState(false);
    const [rosterFor, setRosterFor] = useState<OfferedSubject | null>(null);

    const levelName = useMemo(() => new Map(academicLevels.map(l => [l.id, l.name])), [academicLevels]);
    const takenCodes = useMemo(() => new Set(subjects.map(s => s.code.trim().toUpperCase())), [subjects]);

    const filtered = useMemo(() => {
        const grade = grades.find(g => g.id === levelOrGrade) ?? null;
        const levelId = grade ? grade.academic_level_id : levelOrGrade;
        const q = search.trim().toLowerCase();
        return subjects.filter(s =>
            (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
            && (category === 'ALL' || subjectCategory(s.category) === category)
            && (!levelId || s.academic_level_id === levelId)
            // A class narrows to its band: CBC is one academic level from
            // Pre-Primary to Grade 12, so the level alone would list every
            // CBC learning area under Grade 11.
            && isSubjectOfferedAtGrade(s, grade));
    }, [subjects, grades, levelOrGrade, search, category]);

    const categories = useMemo(
        () => [...new Set(subjects.map(s => subjectCategory(s.category)))].sort((a, b) => SUBJECT_CATEGORY_THEME[a].order - SUBJECT_CATEGORY_THEME[b].order),
        [subjects],
    );

    const setGrading = async (s: OfferedSubject, gradingSystemId: string) => {
        setBusy(true);
        try {
            const res = await fetch(STRUCTURE_URL, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'subject', id: s.id, grading_system_id: gradingSystemId || null }),
            });
            if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not change the grading.'));
            toast.success(`${s.name} now uses ${gradingSystems.find(g => g.id === gradingSystemId)?.name ?? 'the default grading'}`);
            await onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not change the grading.');
        } finally {
            setBusy(false);
        }
    };

    /**
     * Takes a subject off the school's list; results are kept. The server
     * answers 409 with the exam count when there are results, and the
     * dialog then asks again, naming the number.
     */
    const remove = async () => {
        if (!removing) return;
        const { subject, examCount } = removing;
        setBusy(true);
        try {
            const force = examCount !== null ? '&force=true' : '';
            const res = await fetch(`${STRUCTURE_URL}?type=subject&id=${encodeURIComponent(subject.id)}${force}`, { method: 'DELETE' });
            const json: unknown = await res.json().catch(() => null);
            if (res.status === 409) {
                setRemoving({ subject, examCount: Number((json as { examCount?: number } | null)?.examCount) || 0 });
                return;
            }
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not remove the subject.'));
            toast.success(`${subject.name} removed from your list`);
            setRemoving(null);
            await onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not remove the subject.');
        } finally {
            setBusy(false);
        }
    };

    const columns: DataTableColumn<OfferedSubject>[] = [
        {
            key: 'subject', header: 'Subject',
            render: s => {
                const theme = SUBJECT_CATEGORY_THEME[subjectCategory(s.category)];
                return (
                    <div className="flex min-w-0 items-center gap-3">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', theme.tone.tile)} aria-hidden><theme.icon className="size-4" /></span>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{s.name}</div>
                            <div className="truncate font-mono text-xs text-muted-foreground">{s.code}</div>
                        </div>
                    </div>
                );
            },
        },
        { key: 'category', header: 'Category', hideOnMobile: true, className: 'hidden lg:table-cell', render: s => <CategoryChip category={subjectCategory(s.category)} /> },
        {
            key: 'type', header: 'Type',
            render: s => {
                const t = TYPE_STYLE[s.subject_type ?? 'CORE'];
                return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', t.className)}>{t.label}</span>;
            },
        },
        {
            key: 'level', header: 'Taught in',
            render: s => (
                <div className="min-w-0 text-sm">
                    <div className="truncate">{levelName.get(s.academic_level_id ?? '') ?? '—'}</div>
                    {subjectBandLabel(s) && <div className="truncate text-[11px] text-muted-foreground">{subjectBandLabel(s)}</div>}
                </div>
            ),
        },
        {
            key: 'grading', header: 'Grading',
            render: s => isAdmin ? (
                <select
                    aria-label={`Grading for ${s.name}`}
                    className="input-field input-field-sm w-full max-w-[11rem]"
                    value={s.grading_system_id ?? ''}
                    onChange={e => void setGrading(s, e.target.value)}
                    disabled={busy}
                >
                    <option value="">Default</option>
                    {gradingSystems.filter(gs => gs.academic_level_id === s.academic_level_id).map(gs => <option key={gs.id} value={gs.id}>{gs.name}</option>)}
                </select>
            ) : <span className="text-xs text-muted-foreground">{gradingSystems.find(gs => gs.id === s.grading_system_id)?.name ?? 'Default'}</span>,
        },
    ];

    return (
        <>
            {isAdmin && <SubjectCatalogueChecklist offered={subjects} onChanged={onChanged} />}

            <section aria-label="Offered subjects" className="mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]">
                    <SearchBox className="col-span-2 md:col-span-1" value={search} onChange={setSearch} placeholder="Search subjects or codes" />
                    <select className="input-field" aria-label="Curriculum or grade" value={levelOrGrade} onChange={e => setLevelOrGrade(e.target.value)}>
                        <option value="">All curricula</option>
                        {academicLevels.map(al => (
                            <optgroup key={al.id} label={al.name}>
                                <option value={al.id}>All {al.name}</option>
                                {grades.filter(g => g.academic_level_id === al.id).sort((a, b) => a.numeric_order - b.numeric_order).map(g => (
                                    <option key={g.id} value={g.id}>{g.name_display}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    <select className="input-field" aria-label="Category" value={category} onChange={e => setCategory(e.target.value as SubjectCategory | 'ALL')}>
                        <option value="ALL">All categories</option>
                        {categories.map(c => <option key={c} value={c}>{SUBJECT_CATEGORY_THEME[c].label}</option>)}
                    </select>
                    {isAdmin && (
                        <button type="button" className="btn-secondary col-span-2 md:col-span-1" onClick={() => setAddingCustom(true)}>
                            <Plus className="size-4" aria-hidden />Custom subject
                        </button>
                    )}
                </div>
            </section>

            <p className="mb-2 px-1 text-xs text-muted-foreground" aria-live="polite">
                {filtered.length === subjects.length ? `${subjects.length} subjects offered` : `${filtered.length} of ${subjects.length} subjects`}
            </p>

            <DataTable<OfferedSubject>
                columns={columns}
                rows={filtered}
                rowKey={s => s.id}
                rowActions={isAdmin ? s => (
                    <span className="inline-flex gap-1 whitespace-nowrap">
                        <button type="button" className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => setRosterFor(s)} aria-label={`Learners taking ${s.name}`} title="Who takes it (mark entry then lists only them)">
                            <Users className="size-4" />
                        </button>
                        <button type="button" className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => setRemoving({ subject: s, examCount: null })} aria-label={`Remove ${s.name}`} title="Remove from your list">
                            <Trash2 className="size-4" />
                        </button>
                    </span>
                ) : undefined}
                emptyState={subjects.length === 0
                    ? 'No subjects yet. Tick the ones you teach in the list above.'
                    : 'No subjects match. Try another search, curriculum or category.'}
            />

            <CustomSubjectModal open={addingCustom} onClose={() => setAddingCustom(false)} onAdded={onChanged} academicLevels={academicLevels} takenCodes={takenCodes} />

            <ConfirmDialog
                isOpen={removing !== null}
                onClose={() => { if (!busy) setRemoving(null); }}
                onConfirm={() => void remove()}
                loading={busy}
                variant={removing?.examCount ? 'warning' : 'danger'}
                title={`Remove ${removing?.subject.name ?? 'subject'}?`}
                message={removing?.examCount
                    ? `${removing.subject.name} has ${removing.examCount} exam${removing.examCount === 1 ? '' : 's'} recorded. Those results are kept; the subject just leaves your list and stops appearing for new exams.`
                    : 'It leaves your subject list. Any results already recorded are kept.'}
                confirmText={removing?.examCount ? 'Remove anyway' : 'Remove'}
            />

            {rosterFor && <SubjectEnrollmentManager subject={rosterFor} onClose={() => setRosterFor(null)} />}
        </>
    );
}
