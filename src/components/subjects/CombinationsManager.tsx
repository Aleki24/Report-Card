"use client";

import React, { useMemo, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
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
    const [msg, setMsg] = useState('');

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
        setMsg('');
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
        setMsg(failed.length === 0
            ? `Added ${added} combination${added === 1 ? '' : 's'}.`
            : `Failed: could not add ${failed.join(', ')}${added > 0 ? ` (${added} others were added)` : ''}.`);
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
        setMsg('');
    };

    const save = async () => {
        setSaving(true);
        setMsg('');
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
            setMsg(editingId ? 'Combination updated — assigned students were re-synced.' : 'Combination created.');
            resetForm();
            setShowForm(false);
            await onChanged();
        } catch (err) {
            setMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (combo: CombinationRow) => {
        setSaving(true);
        setMsg('');
        try {
            const res = await fetch('/api/admin/academic-structure', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'subject_combination', id: combo.id, is_active: !combo.is_active }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
            await onChanged();
        } catch (err) {
            setMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (combo: CombinationRow) => {
        if (!confirm(`Delete combination ${combo.code}?`)) return;
        setSaving(true);
        setMsg('');
        try {
            let res = await fetch(`/api/admin/academic-structure?type=subject_combination&id=${combo.id}`, { method: 'DELETE' });
            if (res.status === 409) {
                const d = await res.json();
                const detach = confirm(`${d.student_count} student(s) are assigned to ${combo.code}. Detach them (they keep their marks and become Unassigned) and delete anyway?`);
                if (!detach) { setSaving(false); return; }
                res = await fetch(`/api/admin/academic-structure?type=subject_combination&id=${combo.id}&force=true`, { method: 'DELETE' });
            }
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
            setMsg('Combination deleted.');
            await onChanged();
        } catch (err) {
            setMsg(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const canSave = form.code.trim() && form.name.trim() && form.subject_ids.every(Boolean)
        && new Set(form.subject_ids).size === 3;

    return (
        <div>
            {msg && (
                <div className={`mb-4 p-3 rounded-md text-sm ${!msg.startsWith('Failed') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    {msg}
                </div>
            )}

            {isAdmin && (
                <div className="card p-5 mb-6">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                            <Layers size={16} className="text-primary" /> {editingId ? 'Edit Subject Combination' : 'Subject Combinations'}
                        </h3>
                        <div className="flex gap-2">
                            {showForm && (
                                <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => { resetForm(); setShowForm(false); }} title="Cancel">
                                    <RotateCcw size={14} />
                                </button>
                            )}
                            {!showForm && (
                                <button className="btn-secondary text-sm h-9 px-4" onClick={() => { resetForm(); setShowForm(true); }}>
                                    <Plus size={14} /> Custom combination
                                </button>
                            )}
                        </div>
                    </div>
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

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    {combinations.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Layers size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No subject combinations yet.</p>
                            <p className="text-xs mt-1 opacity-60">Add the official combinations your school runs from the list above.</p>
                        </div>
                    ) : (
                        <table className="data-table w-full text-left">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th>Pathway / Track</th>
                                    <th>Electives</th>
                                    <th>Learners</th>
                                    <th>Status</th>
                                    {isAdmin && <th className="text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {combinations.map(c => {
                                    const count = c.student_count ?? 0;
                                    const belowMinimum = count > 0 && count < minGroupSize;
                                    return (
                                        <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                                            <td><span className="font-mono text-sm font-semibold">{c.code}</span></td>
                                            <td className="text-sm">{c.name}</td>
                                            <td className="text-sm text-muted-foreground">
                                                {pathwayLabel(c.pathway)}{c.track ? ` — ${c.track}` : ''}
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    {(c.subjects ?? []).map(s => (
                                                        <span key={s.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                                                            {s.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`text-sm font-semibold ${belowMinimum ? 'text-amber-400' : ''}`}>
                                                    {count}
                                                    {belowMinimum && (
                                                        <span className="inline-flex items-center gap-1 ml-1.5 text-[11px] font-medium" title={`Below the ${minGroupSize}-learner minimum for a standalone class group`}>
                                                            <AlertTriangle size={12} /> &lt;{minGroupSize}
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td>
                                                {isAdmin ? (
                                                    <button
                                                        className={`text-[11px] px-2 py-0.5 rounded-full font-semibold transition-colors ${c.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                                                        onClick={() => toggleActive(c)}
                                                        disabled={saving}
                                                        title="Toggle active"
                                                    >
                                                        {c.is_active ? 'Active' : 'Inactive'}
                                                    </button>
                                                ) : (
                                                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${c.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                                        {c.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                )}
                                            </td>
                                            {isAdmin && (
                                                <td className="text-right">
                                                    <div className="flex justify-end gap-2 items-center">
                                                        <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => startEdit(c)} disabled={saving} title="Edit">
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button className="btn-icon text-red-400 hover:text-red-300" onClick={() => remove(c)} disabled={saving} title="Delete">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
