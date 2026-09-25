"use client";

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { CardHeading, ConfirmDialog, DataTable, type DataTableColumn } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
    PATHWAYS,
    PATHWAY_ORDER,
    pathwayLabel,
    type CbcPathway,
    type MinistryCombinationTemplate,
} from '@/lib/pathway-definitions';
import MinistryCombinationPicker from './MinistryCombinationPicker';
import { isSubjectOfferedInBand } from '@/lib/curriculum-bands';
import { apiErrorMessage } from '@/lib/api-error-message';

interface SubjectOption { id: string; name: string; code: string; academic_level_id?: string; }
interface CombinationRow {
    id: string;
    code: string;
    name: string;
    pathway: CbcPathway;
    track?: string | null;
    is_active: boolean;
    subjects?: { id: string; name: string; code: string }[];
    student_count?: number;
}

interface Props {
    combinations: CombinationRow[];
    subjects: SubjectOption[];
    cbcLevelId?: string;
    minGroupSize: number;
    isAdmin: boolean;
    onChanged: () => Promise<void> | void;
}

const emptyForm = {
    code: '',
    name: '',
    pathway: 'STEM' as CbcPathway,
    track: '',
    subject_ids: ['', '', ''] as [string, string, string],
};

export default function CombinationsManager({ combinations, subjects, cbcLevelId, minGroupSize, isAdmin, onChanged }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<{ combo: CombinationRow; studentCount: number | null } | null>(null);

    // Electives can come from any pathway (2+1 blends are legal), but a
    // combination is a Senior School construct, so only Senior School subjects
    // belong in it. Filtering on the CBC academic level alone was not enough:
    // that one level covers Grade 1 to Grade 12, so Lower Primary learning
    // areas like "Environmental Activities" were offered as Grade 10 electives.
    // `sync-student-subjects` already narrows to this band when it writes the
    // student's subject list, so the picker was offering options the sync would
    // then refuse.
    const electiveOptions = useMemo(
        () =>
            subjects.filter(
                s =>
                    (!cbcLevelId || s.academic_level_id === cbcLevelId) &&
                    isSubjectOfferedInBand(s, 'CBC_SENIOR_SCHOOL')
            ),
        [subjects, cbcLevelId]
    );
    const offeredIdByCode = useMemo(
        () => new Map(electiveOptions.map(s => [s.code.trim().toUpperCase(), s.id])),
        [electiveOptions]
    );
    const existingCodes = useMemo(
        () => new Set(combinations.map(c => c.code.trim().toUpperCase())),
        [combinations]
    );

    const resetForm = () => {
        setForm({ ...emptyForm });
        setEditingId(null);
    };

    /** Create each chosen official combination; one failure doesn't stop the rest. */
    const addOfficial = async (templates: MinistryCombinationTemplate[]) => {
        setSaving(true);
        const failed: string[] = [];
        for (const t of templates) {
            const subjectIds = t.subjectCodes.map(c => offeredIdByCode.get(c));
            try {
                if (subjectIds.some(id => !id)) throw new Error('subject not offered');
                const res = await fetch('/api/admin/academic-structure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'subject_combination',
                        code: t.code,
                        name: t.name,
                        pathway: t.pathway,
                        track: t.track,
                        subject_ids: subjectIds,
                    }),
                });
                if (!res.ok) throw new Error(apiErrorMessage(await res.json(), 'Failed'));
            } catch {
                failed.push(t.code);
            }
        }
        const added = templates.length - failed.length;
        if (failed.length === 0) toast.success(`Added ${added} combination${added === 1 ? '' : 's'}.`);
        else toast.error(`Could not add ${failed.join(', ')}${added > 0 ? ` (${added} others were added)` : ''}.`);
        setSaving(false);
        await onChanged();
    };

    const startEdit = (combo: CombinationRow) => {
        setEditingId(combo.id);
        const ids = (combo.subjects ?? []).map(s => s.id);
        setForm({
            code: combo.code,
            name: combo.name,
            pathway: combo.pathway,
            track: combo.track || '',
            subject_ids: [ids[0] || '', ids[1] || '', ids[2] || ''],
        });
        setShowForm(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                pathway: form.pathway,
                track: form.track.trim() || null,
                subject_ids: form.subject_ids,
            };
            const res = await fetch('/api/admin/academic-structure', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingId
                    ? { type: 'subject_combination', id: editingId, ...payload }
                    : { type: 'subject_combination', ...payload }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed'));
            toast.success(editingId ? 'Combination updated; assigned students were re-synced.' : 'Combination created.');
            resetForm();
            setShowForm(false);
            await onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (combo: CombinationRow) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/academic-structure', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'subject_combination', id: combo.id, is_active: !combo.is_active }),
            });
            if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Something went wrong.'));
            await onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    /**
     * Deleting asks first; when learners are assigned the server answers 409
     * with how many, and the dialog asks again before detaching them.
     */
    const remove = async () => {
        if (!deleting) return;
        const { combo, studentCount } = deleting;
        setSaving(true);
        try {
            const force = studentCount !== null ? '&force=true' : '';
            const res = await fetch(`/api/admin/academic-structure?type=subject_combination&id=${encodeURIComponent(combo.id)}${force}`, { method: 'DELETE' });
            const json: unknown = await res.json().catch(() => null);
            if (res.status === 409) {
                setDeleting({ combo, studentCount: Number((json as { student_count?: number } | null)?.student_count) || 0 });
                return;
            }
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not delete the combination.'));
            toast.success(`${combo.code} deleted`);
            setDeleting(null);
            await onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not delete the combination.');
        } finally {
            setSaving(false);
        }
    };

    const statusClass = (active: boolean) => cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', active ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground');

    const columns: DataTableColumn<CombinationRow>[] = [
        {
            key: 'combo', header: 'Combination',
            render: c => (
                <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold">{c.code}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.name}</div>
                </div>
            ),
        },
        { key: 'pathway', header: 'Pathway / track', hideOnMobile: true, render: c => <span className="text-sm text-muted-foreground">{pathwayLabel(c.pathway)}{c.track ? ` — ${c.track}` : ''}</span> },
        {
            key: 'electives', header: 'Electives', hideOnMobile: true,
            render: c => (
                <div className="flex flex-wrap gap-1">
                    {(c.subjects ?? []).map(sub => <span key={sub.id} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">{sub.name}</span>)}
                </div>
            ),
        },
        {
            key: 'learners', header: 'Learners', numeric: true,
            render: c => {
                const count = c.student_count ?? 0;
                const below = count > 0 && count < minGroupSize;
                return (
                    <span className={cn('inline-flex items-center gap-1 font-semibold', below && 'text-amber-600 dark:text-amber-400')} title={below ? `Below the ${minGroupSize}-learner minimum for its own class group` : undefined}>
                        {below && <AlertTriangle className="size-3.5" aria-hidden />}{count}
                    </span>
                );
            },
        },
        {
            key: 'status', header: 'Status',
            render: c => isAdmin ? (
                <button type="button" className={cn(statusClass(c.is_active), 'hover:ring-1 hover:ring-current')} onClick={e => { e.stopPropagation(); void toggleActive(c); }} disabled={saving} title={c.is_active ? 'Mark inactive' : 'Mark active'}>
                    {c.is_active ? 'Active' : 'Inactive'}
                </button>
            ) : <span className={statusClass(c.is_active)}>{c.is_active ? 'Active' : 'Inactive'}</span>,
        },
    ];

    const canSave = form.code.trim() && form.name.trim() && form.subject_ids.every(Boolean)
        && new Set(form.subject_ids).size === 3;

    return (
        <div>
            {isAdmin && (
                <div className="mb-6 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                    <CardHeading
                        icon={Layers}
                        hue="violet"
                        className="mb-2"
                        title={editingId ? 'Edit combination' : 'Subject combinations'}
                        action={showForm ? (
                            <button type="button" className="btn-secondary h-9 whitespace-nowrap px-3" onClick={() => { resetForm(); setShowForm(false); }}>
                                <X className="size-4" aria-hidden />Cancel
                            </button>
                        ) : (
                            <button type="button" className="btn-secondary h-9 whitespace-nowrap px-3" onClick={() => { resetForm(); setShowForm(true); }}>
                                <Plus className="size-4" aria-hidden />Custom
                            </button>
                        )}
                    />
                    <p className="text-xs text-muted-foreground mb-4">
                        A combination is a Ministry code for a track plus exactly 3 electives (e.g. AS2009 = Biology + Geography + Sports &amp; Recreation).
                        Learners take these 3 electives alongside English, Kiswahili, Community Service Learning and Mathematics — Essential Mathematics
                        unless the combination includes Core Mathematics. Groups need {minGroupSize}+ learners to run as their own class.
                    </p>

                    {!showForm && (
                        <div className="mb-2 rounded-lg border border-border/50 bg-muted/30 p-4">
                            <MinistryCombinationPicker
                                offeredIdByCode={offeredIdByCode}
                                existingCodes={existingCodes}
                                busy={saving}
                                onAdd={addOfficial}
                            />
                        </div>
                    )}

                    {showForm && (
                        <>
                            {!editingId && (
                                <p className="mb-3 text-xs text-muted-foreground">
                                    A custom combination is for one your school runs that is not on the Ministry list. Official ones are added from the list above.
                                </p>
                            )}

                            <div className="flex flex-wrap gap-3 items-end mb-3">
                                <div className="w-32">
                                    <label className="block text-xs text-muted-foreground mb-2 font-medium">Code *</label>
                                    <input className="input-field input-field-mono w-full text-sm font-mono uppercase" placeholder="SPORTS" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                                </div>
                                <div className="flex-[2] min-w-[180px]">
                                    <label className="block text-xs text-muted-foreground mb-2 font-medium">Name *</label>
                                    <input className="input-field w-full text-sm" placeholder="e.g. Sports Science" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                                </div>
                                <div className="w-44">
                                    <label className="block text-xs text-muted-foreground mb-2 font-medium">Pathway *</label>
                                    <select className="input-field w-full text-sm" value={form.pathway} onChange={e => setForm(p => ({ ...p, pathway: e.target.value as CbcPathway, track: '' }))}>
                                        {PATHWAY_ORDER.map(pw => <option key={pw} value={pw}>{PATHWAYS[pw].label}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1 min-w-[180px]">
                                    <label className="block text-xs text-muted-foreground mb-2 font-medium">Track</label>
                                    <select className="input-field w-full text-sm" value={form.track} onChange={e => setForm(p => ({ ...p, track: e.target.value }))}>
                                        <option value="">No track / other</option>
                                        {PATHWAYS[form.pathway].tracks.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3 items-end">
                                {[0, 1, 2].map(i => (
                                    <div className="flex-1 min-w-[180px]" key={i}>
                                        <label className="block text-xs text-muted-foreground mb-2 font-medium">Elective {i + 1} *</label>
                                        <select
                                            className="input-field w-full text-sm"
                                            value={form.subject_ids[i]}
                                            onChange={e => setForm(p => {
                                                const ids = [...p.subject_ids] as [string, string, string];
                                                ids[i] = e.target.value;
                                                return { ...p, subject_ids: ids };
                                            })}
                                        >
                                            <option value="">Select subject...</option>
                                            {electiveOptions.map(s => (
                                                <option key={s.id} value={s.id} disabled={form.subject_ids.includes(s.id) && form.subject_ids[i] !== s.id}>
                                                    {s.name} ({s.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={save}
                                    className="btn-primary text-sm h-9 px-4 whitespace-nowrap"
                                    disabled={saving || !canSave}
                                >
                                    {saving ? 'Saving...' : (editingId ? 'Save Changes' : <><Plus size={14} /> Create</>)}
                                </button>
                            </div>
                            {electiveOptions.length === 0 && (
                                <p className="text-xs text-amber-400 mt-3">No CBC subjects found — add senior-school subjects on the Subjects tab first.</p>
                            )}
                        </>
                    )}
                </div>
            )}

            <DataTable<CombinationRow>
                columns={columns}
                rows={combinations}
                rowKey={c => c.id}
                rowActions={isAdmin ? c => (
                    <span className="inline-flex gap-1 whitespace-nowrap">
                        <button type="button" className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => startEdit(c)} disabled={saving} aria-label={`Edit ${c.code}`} title="Edit"><Pencil className="size-4" /></button>
                        <button type="button" className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => setDeleting({ combo: c, studentCount: null })} disabled={saving} aria-label={`Delete ${c.code}`} title="Delete"><Trash2 className="size-4" /></button>
                    </span>
                ) : undefined}
                emptyState="No subject combinations yet. Add the official ones your school runs from the list above."
            />

            <ConfirmDialog
                isOpen={deleting !== null}
                onClose={() => { if (!saving) setDeleting(null); }}
                onConfirm={() => void remove()}
                loading={saving}
                variant={deleting?.studentCount ? 'warning' : 'danger'}
                title={`Delete ${deleting?.combo.code ?? 'combination'}?`}
                message={deleting?.studentCount
                    ? `${deleting.studentCount} learner${deleting.studentCount === 1 ? ' is' : 's are'} assigned to it. They keep their marks but become Unassigned, and their elective subjects are cleared.`
                    : 'It is removed from your school’s list.'}
                confirmText={deleting?.studentCount ? 'Detach and delete' : 'Delete'}
            />
        </div>
    );
}
