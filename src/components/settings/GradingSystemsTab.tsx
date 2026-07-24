"use client";

import React, { useState } from 'react';
import { InfoGuide } from '@/components/ui/InfoGuide';

interface AcademicLevel { id: string; code: string; name: string; }
interface GradingSystem { id: string; name: string; description: string | null; academic_level_id: string; school_id?: string | null; system_kind?: 'SUBJECT' | 'OVERALL'; }
interface GradingScale { id: string; grading_system_id: string; min_percentage: number; max_percentage: number; symbol: string; label: string; points: number | null; order_index: number; }
interface SubjectOption { id: string; name: string; academic_level_id: string; grading_system_id: string | null; }

type SystemKind = 'SUBJECT' | 'OVERALL';

interface GradingSystemsTabProps {
    academicLevels: AcademicLevel[];
    gradingSystems: GradingSystem[];
    gradingScales: GradingScale[];
    subjects: SubjectOption[];
    overallGradingSystemId?: string | null;
    schoolId?: string;
    saving?: boolean;
    onCreate: (type: string, payload: Record<string, unknown>) => Promise<any>;
    onDelete: (type: string, id: string) => Promise<void>;
    onPatch: (type: string, id: string, payload: Record<string, unknown>) => Promise<any>;
    onSetOverall: (gradingSystemId: string) => Promise<void>;
}

interface DraftRow { symbol: string; label: string; min_percentage: string; max_percentage: string; points: string; }

const emptyRow = (): DraftRow => ({ symbol: '', label: '', min_percentage: '', max_percentage: '', points: '' });

// Standard descending letter-grade sequence — used to auto-fill the next
// row's grade (and its high mark / points) so schools don't have to retype
// a predictable progression for every band.
const GRADE_SEQUENCE = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'];

function nextRowFrom(last: DraftRow | undefined): DraftRow {
    if (!last) return emptyRow();
    const idx = GRADE_SEQUENCE.indexOf(last.symbol.trim().toUpperCase());
    const nextSymbol = idx >= 0 && idx < GRADE_SEQUENCE.length - 1 ? GRADE_SEQUENCE[idx + 1] : '';
    const lastLow = Number(last.min_percentage);
    const nextHigh = last.min_percentage !== '' && !Number.isNaN(lastLow) ? String(lastLow - 1) : '';
    const lastPoints = Number(last.points);
    const nextPoints = last.points !== '' && !Number.isNaN(lastPoints) ? String(Math.max(0, lastPoints - 1)) : '';
    return { symbol: nextSymbol, label: '', min_percentage: '', max_percentage: nextHigh, points: nextPoints };
}

export function GradingSystemsTab({
    academicLevels, gradingSystems, gradingScales, subjects, overallGradingSystemId,
    schoolId, saving, onCreate, onDelete, onPatch, onSetOverall,
}: GradingSystemsTabProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [kind, setKind] = useState<SystemKind>('SUBJECT');
    const [name, setName] = useState('');
    const [academicLevelId, setAcademicLevelId] = useState('');
    const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);
    const [groupSubjectIds, setGroupSubjectIds] = useState<string[]>([]);
    const [formError, setFormError] = useState('');
    const [managingGroupFor, setManagingGroupFor] = useState<string | null>(null);
    const [draftGroupSubjectIds, setDraftGroupSubjectIds] = useState<string[]>([]);

    const isOverall = kind === 'OVERALL';

    const resetForm = () => {
        setKind('SUBJECT'); setName(''); setAcademicLevelId(''); setRows([emptyRow()]); setGroupSubjectIds([]); setFormError('');
    };

    const updateRow = (i: number, field: keyof DraftRow, value: string) => {
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    };

    const addRow = () => setRows(prev => [...prev, nextRowFrom(prev[prev.length - 1])]);
    const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

    const subjectsForLevel = (levelId: string) => subjects.filter(s => s.academic_level_id === levelId);

    const toggleGroupSubject = (id: string) => {
        setGroupSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!name.trim()) { setFormError('Grading system name is required.'); return; }
        if (!academicLevelId) { setFormError('Please select an academic level.'); return; }

        const filledRows = rows.filter(r => r.symbol.trim() || r.min_percentage !== '' || r.max_percentage !== '');
        if (filledRows.length === 0) { setFormError('Add at least one grade row to the grading grid.'); return; }

        const ceiling = isOverall ? 100000 : 100;
        const boundLabel = isOverall ? 'points' : '%';
        const scales = [];
        for (const r of filledRows) {
            if (!r.symbol.trim()) { setFormError('Every row needs a grade (e.g. A, B+, E).'); return; }
            if (r.min_percentage === '' || r.max_percentage === '') { setFormError(`Row "${r.symbol}" needs both a Low and High value.`); return; }
            const min = Number(r.min_percentage);
            const max = Number(r.max_percentage);
            if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max > ceiling) { setFormError(`Row "${r.symbol}": Low/High must be between 0 and ${ceiling} ${boundLabel}.`); return; }
            if (min > max) { setFormError(`Row "${r.symbol}": Low cannot be greater than High.`); return; }
            scales.push({
                symbol: r.symbol.trim(),
                label: r.label.trim(),
                min_percentage: min,
                max_percentage: max,
                // Overall systems output a grade only — no onward points.
                points: isOverall ? undefined : (r.points === '' ? undefined : Number(r.points)),
            });
        }

        const payload: Record<string, unknown> = { name: name.trim(), academic_level_id: academicLevelId, system_kind: kind, scales };
        if (!isOverall) payload.subject_ids = groupSubjectIds;

        const result = await onCreate('grading_system', payload);
        if (result) {
            setShowCreate(false);
            resetForm();
        }
    };

    const startManagingGroup = (gs: GradingSystem) => {
        setManagingGroupFor(gs.id);
        setDraftGroupSubjectIds(subjects.filter(s => s.grading_system_id === gs.id).map(s => s.id));
    };

    const toggleDraftGroupSubject = (id: string) => {
        setDraftGroupSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const saveGroup = async (gradingSystemId: string) => {
        const result = await onPatch('grading_system_subjects', gradingSystemId, { subject_ids: draftGroupSubjectIds });
        if (result !== null) setManagingGroupFor(null);
    };

    // The overall selector lists overall-kind systems the school created, plus
    // whatever is currently selected (so an older choice still shows).
    const overallCandidates = gradingSystems.filter(gs => gs.system_kind === 'OVERALL' || gs.id === overallGradingSystemId);

    return (
        <div className="lg:col-span-3 flex flex-col gap-6">
            <InfoGuide title="How grading works — two kinds of grading system:">
                <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                    <li><strong>Subject grading</strong> maps a subject&apos;s <em>mark %</em> → grade → points (e.g. 80–100% = A = 12 pts). Assign it to one or a group of subjects. As teachers enter marks, the grade fills in automatically from these bands.</li>
                    <li><strong>Overall grading</strong> maps a student&apos;s <em>total points</em> → the overall/mean grade (8-4-4 logic: each subject&apos;s grade earns points, the best subjects are summed, and that total is graded here — e.g. 81–84 pts = A).</li>
                    <li>Pick your <strong>Overall Grading System</strong> below so report cards and mark sheets grade the total points your way. Leave it unset to keep the built-in default.</li>
                    <li>The default CBC / 8-4-4 templates are shared and read-only — create your own to set your school&apos;s preferences.</li>
                </ul>
            </InfoGuide>

            <div className="card p-5">
                <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Overall Grading System</label>
                <select
                    className="input-field w-full max-w-md"
                    value={overallGradingSystemId || ''}
                    onChange={e => onSetOverall(e.target.value)}
                    disabled={saving}
                >
                    <option value="">-- Not set (use the built-in default) --</option>
                    {overallCandidates.map(gs => <option key={gs.id} value={gs.id}>{gs.name}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                    Grades each student&apos;s <strong>total points</strong> into an overall grade on report cards.
                    {overallCandidates.length === 0 && ' Create an "Overall grading" system below to use this.'}
                </p>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    className="btn-primary"
                    onClick={() => { setShowCreate(v => !v); if (showCreate) resetForm(); }}
                >
                    {showCreate ? 'Cancel' : '+ Create Grading System'}
                </button>
            </div>

            {showCreate && (
                <form onSubmit={handleSubmit} className="card p-5">
                    {formError && (
                        <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{formError}</div>
                    )}

                    <div className="mb-4">
                        <label className="block text-xs text-muted-foreground mb-1.5">System type *</label>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setKind('SUBJECT')} className={`px-3 py-2 rounded-lg border text-sm ${!isOverall ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'}`}>
                                Subject grading <span className="block text-[10px] opacity-70">mark % → grade + points</span>
                            </button>
                            <button type="button" onClick={() => setKind('OVERALL')} className={`px-3 py-2 rounded-lg border text-sm ${isOverall ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'}`}>
                                Overall grading <span className="block text-[10px] opacity-70">total points → overall grade</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1">Grading System Name *</label>
                            <input className="input-field w-full" placeholder={isOverall ? 'e.g. Overall Mean Grade' : 'e.g. Sciences Grading'} value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1">Academic Level *</label>
                            <select className="input-field w-full" value={academicLevelId} onChange={e => { setAcademicLevelId(e.target.value); setGroupSubjectIds([]); }} required>
                                <option value="">-- Select --</option>
                                {academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {isOverall ? 'Overall grid — total points → grade (start with the highest)' : 'Grading Grid (start with the highest)'}
                    </p>
                    <div className="overflow-x-auto border border-border rounded-lg mb-3">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted border-b border-border">
                                <tr>
                                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">#</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">{isOverall ? 'Low (pts)' : 'Low'}</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">{isOverall ? 'High (pts)' : 'High'}</th>
                                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Grade</th>
                                    {!isOverall && <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Points</th>}
                                    <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Remarks</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {rows.map((r, i) => (
                                    <tr key={i}>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                                        <td className="px-2 py-1.5"><input className="input-field w-20" type="number" min={0} value={r.min_percentage} onChange={e => updateRow(i, 'min_percentage', e.target.value)} /></td>
                                        <td className="px-2 py-1.5"><input className="input-field w-20" type="number" min={0} value={r.max_percentage} onChange={e => updateRow(i, 'max_percentage', e.target.value)} /></td>
                                        <td className="px-2 py-1.5"><input className="input-field w-20" placeholder="A" value={r.symbol} onChange={e => updateRow(i, 'symbol', e.target.value.toUpperCase())} /></td>
                                        {!isOverall && <td className="px-2 py-1.5"><input className="input-field w-16" type="number" min={0} value={r.points} onChange={e => updateRow(i, 'points', e.target.value)} /></td>}
                                        <td className="px-2 py-1.5"><input className="input-field w-full min-w-[120px]" placeholder="Excellent" value={r.label} onChange={e => updateRow(i, 'label', e.target.value)} /></td>
                                        <td className="px-2 py-1.5 text-right">
                                            <button type="button" className="text-red-400 hover:text-red-300 text-xs font-medium" onClick={() => removeRow(i)} disabled={rows.length <= 1}>Remove</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" className="btn-secondary text-xs mb-2" onClick={addRow}>+ Add Row</button>
                    <p className="text-[11px] text-muted-foreground mb-5">Adding a row auto-fills the next grade{isOverall ? '' : ', high mark, and points'} from the row above — just fill in the low value.</p>

                    {!isOverall && (
                        <div className="mb-2">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Subjects in this group (optional)</p>
                            {!academicLevelId ? (
                                <p className="text-xs text-muted-foreground">Pick an academic level above to choose which subjects use this system.</p>
                            ) : subjectsForLevel(academicLevelId).length === 0 ? (
                                <p className="text-xs text-muted-foreground">No subjects found for this academic level yet.</p>
                            ) : (
                                <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {subjectsForLevel(academicLevelId).map(s => (
                                        <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input type="checkbox" checked={groupSubjectIds.includes(s.id)} onChange={() => toggleGroupSubject(s.id)} />
                                            <span className="truncate">{s.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button type="button" className="btn-secondary" onClick={() => { setShowCreate(false); resetForm(); }} disabled={saving}>Cancel</button>
                        <button type="submit" className="btn-primary disabled:opacity-50" disabled={saving}>{saving ? 'Saving...' : 'Save Grading System'}</button>
                    </div>
                </form>
            )}

            {gradingSystems.length > 0 ? gradingSystems.map(gs => {
                const levelName = academicLevels.find(l => l.id === gs.academic_level_id)?.name || '';
                const scales = gradingScales.filter(sc => sc.grading_system_id === gs.id);
                const isOwn = !!gs.school_id && gs.school_id === schoolId;
                const gsOverall = gs.system_kind === 'OVERALL';
                const memberSubjects = subjects.filter(s => s.grading_system_id === gs.id);
                const isManaging = managingGroupFor === gs.id;
                return (
                    <div key={gs.id} className="card">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-lg font-[family-name:var(--font-display)]">{gs.name}</h3>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${gsOverall ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                    {gsOverall ? 'Overall (points)' : 'Subject (%)'}
                                </span>
                                {gs.id === overallGradingSystemId && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold">Active overall</span>
                                )}
                                {isOwn ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Your school</span>
                                ) : (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">System default</span>
                                )}
                                {isOwn && (
                                    <button
                                        type="button"
                                        className="text-red-400 hover:text-red-300 text-xs font-medium"
                                        onClick={() => onDelete('grading_system', gs.id)}
                                        disabled={saving}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{levelName}{gs.description ? ` · ${gs.description}` : ''}</p>

                        {!gsOverall && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs text-muted-foreground">
                                        <strong>Subjects:</strong> {memberSubjects.length > 0 ? memberSubjects.map(s => s.name).join(', ') : '—'}
                                    </p>
                                    {isOwn && !isManaging && (
                                        <button type="button" className="text-primary text-xs font-medium" onClick={() => startManagingGroup(gs)}>Manage subjects</button>
                                    )}
                                </div>
                                {isManaging && (
                                    <div className="border border-border rounded-lg p-3 mt-2">
                                        {subjectsForLevel(gs.academic_level_id).length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No subjects found for this academic level.</p>
                                        ) : (
                                            <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                                {subjectsForLevel(gs.academic_level_id).map(s => (
                                                    <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                                        <input type="checkbox" checked={draftGroupSubjectIds.includes(s.id)} onChange={() => toggleDraftGroupSubject(s.id)} />
                                                        <span className="truncate">{s.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex justify-end gap-2">
                                            <button type="button" className="btn-secondary text-xs" onClick={() => setManagingGroupFor(null)} disabled={saving}>Cancel</button>
                                            <button type="button" className="btn-primary text-xs" onClick={() => saveGroup(gs.id)} disabled={saving}>{saving ? 'Saving...' : 'Save group'}</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {scales.length > 0 && (
                            <div className="overflow-x-auto border border-border rounded-lg">
                                <table className="data-table w-full text-left sm:whitespace-nowrap">
                                    <thead className="bg-muted border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Symbol</th>
                                            {!gsOverall && <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Points</th>}
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">{gsOverall ? 'Min pts' : 'Min %'}</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">{gsOverall ? 'Max pts' : 'Max %'}</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]">
                                        {scales.map(sc => (
                                            <tr key={sc.id} className="hover:bg-muted transition-colors">
                                                <td className="px-4 py-3 font-bold">{sc.symbol}</td>
                                                {!gsOverall && <td className="px-4 py-3 text-sm">{sc.points ?? '—'}</td>}
                                                <td className="px-4 py-3 text-sm font-mono">{sc.min_percentage}{gsOverall ? '' : '%'}</td>
                                                <td className="px-4 py-3 text-sm font-mono">{sc.max_percentage}{gsOverall ? '' : '%'}</td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">{sc.label}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            }) : (
                <div className="card text-center p-8">
                    <img src="https://em-content.zobj.net/source/apple/354/triangular-ruler_1f4d0.png" alt="Settings" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <p className="text-sm text-muted-foreground">Grading systems have not been configured yet.</p>
                </div>
            )}
        </div>
    );
}
