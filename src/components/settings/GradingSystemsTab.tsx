"use client";

import React, { useState } from 'react';
import { InfoGuide } from '@/components/ui/InfoGuide';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

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

// Standard KCSE 12-point scale — points follow definitively from the grade
// (A = 12, A- = 11 … E = 1), so they auto-fill and the user rarely types them.
const STANDARD_GRADE_POINTS: Record<string, number> = {
    'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8, 'C+': 7,
    'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2, 'E': 1,
};
const GRADE_SEQUENCE = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'E'];

function pointsForSymbol(symbol: string): string {
    const p = STANDARD_GRADE_POINTS[symbol.trim().toUpperCase()];
    return p !== undefined ? String(p) : '';
}

function nextRowFrom(last: DraftRow | undefined): DraftRow {
    if (!last) return emptyRow();
    const idx = GRADE_SEQUENCE.indexOf(last.symbol.trim().toUpperCase());
    const nextSymbol = idx >= 0 && idx < GRADE_SEQUENCE.length - 1 ? GRADE_SEQUENCE[idx + 1] : '';
    const lastLow = Number(last.min_percentage);
    const nextHigh = last.min_percentage !== '' && !Number.isNaN(lastLow) ? String(lastLow - 1) : '';
    return { symbol: nextSymbol, label: '', min_percentage: '', max_percentage: nextHigh, points: pointsForSymbol(nextSymbol) };
}

export function GradingSystemsTab({
    academicLevels, gradingSystems, gradingScales, subjects, overallGradingSystemId,
    schoolId, saving, onCreate, onDelete, onPatch, onSetOverall,
}: GradingSystemsTabProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [kind, setKind] = useState<SystemKind>('SUBJECT');
    const [name, setName] = useState('');
    const [academicLevelId, setAcademicLevelId] = useState('');
    const [rows, setRows] = useState<DraftRow[]>([{ symbol: 'A', label: '', min_percentage: '', max_percentage: '100', points: '12' }]);
    const [groupSubjectIds, setGroupSubjectIds] = useState<string[]>([]);
    const [formError, setFormError] = useState('');
    const [viewingId, setViewingId] = useState<string | null>(null);
    const [managingGroup, setManagingGroup] = useState(false);
    const [draftGroupSubjectIds, setDraftGroupSubjectIds] = useState<string[]>([]);

    const isOverall = kind === 'OVERALL';

    const resetForm = () => {
        setKind('SUBJECT'); setName(''); setAcademicLevelId('');
        setRows([{ symbol: 'A', label: '', min_percentage: '', max_percentage: '100', points: '12' }]);
        setGroupSubjectIds([]); setFormError('');
    };

    const updateRow = (i: number, field: keyof DraftRow, value: string) => {
        setRows(prev => prev.map((r, idx) => {
            if (idx !== i) return r;
            const next = { ...r, [field]: value };
            // Points follow the grade automatically (still editable afterwards).
            if (field === 'symbol') {
                const auto = pointsForSymbol(value);
                if (auto) next.points = auto;
            }
            return next;
        }));
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
                points: isOverall ? undefined : (r.points === '' ? undefined : Number(r.points)),
            });
        }

        const payload: Record<string, unknown> = { name: name.trim(), academic_level_id: academicLevelId, system_kind: kind, scales };
        if (!isOverall) payload.subject_ids = groupSubjectIds;

        const result = await onCreate('grading_system', payload);
        if (result) { setShowCreate(false); resetForm(); }
    };

    const viewing = viewingId ? gradingSystems.find(gs => gs.id === viewingId) : null;
    const viewingScales = viewing ? gradingScales.filter(sc => sc.grading_system_id === viewing.id).sort((a, b) => a.order_index - b.order_index) : [];
    const viewingOverall = viewing?.system_kind === 'OVERALL';
    const viewingOwn = !!viewing?.school_id && viewing.school_id === schoolId;
    const viewingMembers = viewing ? subjects.filter(s => s.grading_system_id === viewing.id) : [];

    const openView = (gs: GradingSystem) => {
        setViewingId(gs.id);
        setManagingGroup(false);
        setDraftGroupSubjectIds(subjects.filter(s => s.grading_system_id === gs.id).map(s => s.id));
    };
    const toggleDraftGroupSubject = (id: string) => {
        setDraftGroupSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };
    const saveGroup = async () => {
        if (!viewing) return;
        const result = await onPatch('grading_system_subjects', viewing.id, { subject_ids: draftGroupSubjectIds });
        if (result !== null) setManagingGroup(false);
    };

    const overallCandidates = gradingSystems.filter(gs => gs.system_kind === 'OVERALL' || gs.id === overallGradingSystemId);
    const levelName = (id: string) => academicLevels.find(l => l.id === id)?.name || '';

    return (
        <div className="lg:col-span-3 flex flex-col gap-6">
            <InfoGuide title="How grading works — two kinds of grading system:">
                <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                    <li><strong>Subject grading</strong> maps a subject&apos;s <em>mark %</em> → grade → points (points fill in automatically: A = 12, A- = 11 … E = 1). Assign it to one or a group of subjects.</li>
                    <li><strong>Overall grading</strong> maps a student&apos;s <em>total points</em> → the overall/mean grade (8-4-4: each subject&apos;s grade earns points, the best subjects are summed, and that total is graded here).</li>
                    <li>Pick your <strong>Overall Grading System</strong> below so report cards grade the total points your way. Leave it unset for the built-in default.</li>
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

            {/* ── Grading Systems list (Name | Actions) ── */}
            <div className="card overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h3 className="font-bold text-lg font-[family-name:var(--font-display)]">Grading Systems</h3>
                    <button type="button" className="btn-primary" onClick={() => { setShowCreate(v => !v); if (showCreate) resetForm(); }}>
                        {showCreate ? 'Cancel' : '+ Create Grading System'}
                    </button>
                </div>

                {gradingSystems.length === 0 ? (
                    <div className="text-center p-8 text-sm text-muted-foreground">Grading systems have not been configured yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table w-full text-left">
                            <thead className="bg-muted border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Name</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {gradingSystems.map(gs => {
                                    const own = !!gs.school_id && gs.school_id === schoolId;
                                    const gsOverall = gs.system_kind === 'OVERALL';
                                    return (
                                        <tr key={gs.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-sm">{gs.name}</div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {levelName(gs.academic_level_id)}
                                                    {gs.id === overallGradingSystemId ? ' · Active overall' : ''}
                                                    {!own ? ' · System default' : ''}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${gsOverall ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                                    {gsOverall ? 'Overall (points)' : 'Subject (%)'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" className="btn-secondary text-xs" onClick={() => openView(gs)}>👁 View</button>
                                                    {own && (
                                                        <button type="button" className="text-xs font-medium px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50" onClick={() => onDelete('grading_system', gs.id)} disabled={saving}>🗑 Delete</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Create form ── */}
            {showCreate && (
                <form onSubmit={handleSubmit} className="card p-5">
                    {formError && <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{formError}</div>}

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
                            <input className="input-field w-full" placeholder={isOverall ? 'e.g. Overall Mean Grade' : 'e.g. MAT,GEO,CHEM,PHY'} value={name} onChange={e => setName(e.target.value)} required />
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
                        <table className="text-left text-sm min-w-[640px] w-full">
                            <thead className="bg-muted border-b border-border">
                                <tr>
                                    <th className="px-2 py-2 text-xs font-semibold text-muted-foreground w-8">#</th>
                                    <th className="px-2 py-2 text-xs font-semibold text-muted-foreground">{isOverall ? 'Low (pts)' : 'Low'}</th>
                                    <th className="px-2 py-2 text-xs font-semibold text-muted-foreground">{isOverall ? 'High (pts)' : 'High'}</th>
                                    <th className="px-2 py-2 text-xs font-semibold text-muted-foreground">Grade</th>
                                    {!isOverall && <th className="px-2 py-2 text-xs font-semibold text-muted-foreground">Points</th>}
                                    <th className="px-2 py-2 text-xs font-semibold text-muted-foreground">Remarks</th>
                                    <th className="px-2 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {rows.map((r, i) => (
                                    <tr key={i}>
                                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                                        <td className="px-1.5 py-1.5"><input className="input-field w-full min-w-[72px] text-center" type="number" inputMode="numeric" min={0} value={r.min_percentage} onChange={e => updateRow(i, 'min_percentage', e.target.value)} /></td>
                                        <td className="px-1.5 py-1.5"><input className="input-field w-full min-w-[72px] text-center" type="number" inputMode="numeric" min={0} value={r.max_percentage} onChange={e => updateRow(i, 'max_percentage', e.target.value)} /></td>
                                        <td className="px-1.5 py-1.5"><input className="input-field w-full min-w-[64px] text-center" placeholder="A" value={r.symbol} onChange={e => updateRow(i, 'symbol', e.target.value.toUpperCase())} /></td>
                                        {!isOverall && <td className="px-1.5 py-1.5"><input className="input-field w-full min-w-[64px] text-center" type="number" inputMode="numeric" min={0} value={r.points} onChange={e => updateRow(i, 'points', e.target.value)} title="Auto-filled from the grade — editable" /></td>}
                                        <td className="px-1.5 py-1.5"><input className="input-field w-full min-w-[140px]" placeholder="Excellent" value={r.label} onChange={e => updateRow(i, 'label', e.target.value)} /></td>
                                        <td className="px-1.5 py-1.5 text-right"><button type="button" className="text-red-400 hover:text-red-300 text-xs font-medium whitespace-nowrap" onClick={() => removeRow(i)} disabled={rows.length <= 1}>Remove</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1 sm:hidden">Swipe the grid sideways to reach every column.</p>
                    <button type="button" className="btn-secondary text-xs mb-2" onClick={addRow}>+ Add Row</button>
                    <p className="text-[11px] text-muted-foreground mb-5">Adding a row auto-fills the next grade{isOverall ? '' : ', high mark, and points (A = 12, A- = 11 …)'} from the row above — just set the low value.</p>

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

            {/* ── View detail modal ── */}
            {viewing && (
                <ModalOverlay onClose={() => setViewingId(null)}>
                    <div className="flex items-start justify-between mb-1">
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">{viewing.name}</h2>
                        <button type="button" className="btn-secondary text-xs" onClick={() => setViewingId(null)}>Close</button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                        {levelName(viewing.academic_level_id)} · {viewingOverall ? 'Overall (total points → grade)' : 'Subject (mark % → grade + points)'}
                        {viewing.description ? ` · ${viewing.description}` : ''}
                    </p>

                    {!viewingOverall && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-muted-foreground"><strong>Subjects:</strong> {viewingMembers.length > 0 ? viewingMembers.map(s => s.name).join(', ') : '—'}</p>
                                {viewingOwn && !managingGroup && <button type="button" className="text-primary text-xs font-medium" onClick={() => setManagingGroup(true)}>Manage subjects</button>}
                            </div>
                            {managingGroup && (
                                <div className="border border-border rounded-lg p-3 mt-2">
                                    {subjectsForLevel(viewing.academic_level_id).length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No subjects found for this academic level.</p>
                                    ) : (
                                        <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-2 mb-3">
                                            {subjectsForLevel(viewing.academic_level_id).map(s => (
                                                <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                                    <input type="checkbox" checked={draftGroupSubjectIds.includes(s.id)} onChange={() => toggleDraftGroupSubject(s.id)} />
                                                    <span className="truncate">{s.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex justify-end gap-2">
                                        <button type="button" className="btn-secondary text-xs" onClick={() => setManagingGroup(false)} disabled={saving}>Cancel</button>
                                        <button type="button" className="btn-primary text-xs" onClick={saveGroup} disabled={saving}>{saving ? 'Saving...' : 'Save group'}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="data-table w-full text-left">
                            <thead className="bg-muted border-b border-border">
                                <tr>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">{viewingOverall ? 'Low (pts)' : 'Low'}</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">{viewingOverall ? 'High (pts)' : 'High'}</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Grade</th>
                                    {!viewingOverall && <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Points</th>}
                                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {viewingScales.map(sc => (
                                    <tr key={sc.id}>
                                        <td className="px-4 py-2.5 text-sm font-mono">{sc.min_percentage}</td>
                                        <td className="px-4 py-2.5 text-sm font-mono">{sc.max_percentage}</td>
                                        <td className="px-4 py-2.5 font-bold">{sc.symbol}</td>
                                        {!viewingOverall && <td className="px-4 py-2.5 text-sm">{sc.points ?? '—'}</td>}
                                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{sc.label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {viewingOwn && (
                        <div className="flex justify-end mt-4">
                            <button type="button" className="text-xs font-medium px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50" onClick={() => { onDelete('grading_system', viewing.id); setViewingId(null); }} disabled={saving}>🗑 Delete this grading system</button>
                        </div>
                    )}
                </ModalOverlay>
            )}
        </div>
    );
}
