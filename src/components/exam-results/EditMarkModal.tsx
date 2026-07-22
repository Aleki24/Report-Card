"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { ExamSubjectComponentScheme } from '@/types';
import { calculateCompositeSubjectScore, isMultiPaper } from '@/lib/multi-paper';

interface GradeOption {
    symbol: string;
    label: string;
    systemName: string;
    min_percentage: number;
    max_percentage: number;
}

export interface EditMarkData {
    id: string;
    student_id: string;
    student_name: string;
    admission_number: string;
    raw_score: number;
    percentage: number;
    grade_symbol: string;
    rubric: string | null;
    remarks: string | null;
    /** Per-paper raw scores keyed by component id (multi-paper exams) */
    components?: Record<string, number>;
}

interface Props {
    mark: EditMarkData;
    maxScore: number;
    examId: string;
    /** Multi-paper scheme for this exam (null/undefined = single paper) */
    scheme?: ExamSubjectComponentScheme | null;
    onClose: () => void;
    /** Receives the patched row so the parent can update in place instead of refetching the whole grid. */
    onSaved: (patched?: EditMarkData) => void;
    onDeleted: () => void;
}

export function EditMarkModal({ mark, maxScore, examId, scheme, onClose, onSaved, onDeleted }: Props) {
    const multiPaper = isMultiPaper(scheme);
    const schemeComponents = multiPaper ? (scheme?.components || []) : [];

    const [score, setScore] = useState(String(mark.raw_score));
    const [componentScores, setComponentScores] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const c of schemeComponents) {
            const v = mark.components?.[c.id];
            initial[c.id] = v !== undefined && v !== null ? String(v) : '';
        }
        return initial;
    });

    const composite = multiPaper
        ? calculateCompositeSubjectScore(
            schemeComponents.map(c => ({
                componentId: c.id,
                code: c.component_code,
                maxScore: Number(c.max_score),
                score: componentScores[c.id] !== undefined && componentScores[c.id] !== ''
                    ? parseFloat(componentScores[c.id])
                    : null,
                displayOrder: c.display_order,
            })),
            scheme!.aggregation_method
        )
        : null;
    const [grade, setGrade] = useState(mark.grade_symbol);
    const [rubric, setRubric] = useState(mark.rubric || '');
    const [gradeManuallySet, setGradeManuallySet] = useState(false);
    const [remarks, setRemarks] = useState(mark.remarks || '');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);
    const [totalPoints, setTotalPoints] = useState<number>(0);
    const [isCBC, setIsCBC] = useState(false);

    // CBC grade to rubric points mapping
    const CBC_RUBRIC_MAP: Record<string, string> = {
        'EE1': '8', 'EE2': '7',
        'ME1': '6', 'ME2': '5',
        'AE1': '4', 'AE2': '3',
        'BE1': '2', 'BE2': '1',
    };

    // Fetch grade options filtered by exam's subject level
    useEffect(() => {
        const fetchGrades = async () => {
            try {
                // Get exam details first
                const examsRes = await fetch('/api/school/data?type=exams');
                const examsData = await examsRes.json();
                const exam = (examsData.data || []).find((e: any) => e.id === examId);
                
                // Check if exam is CBC type
                const examType = exam?.exam_type?.toUpperCase() || '';
                const isCBCExam = examType === 'CBC' || examType === '844';
                setIsCBC(isCBCExam);
                
                // Get academic level from subject or grade
                let academicLevelId = null;
                if (exam?.subjects?.academic_level_id) {
                    academicLevelId = exam.subjects.academic_level_id;
                } else if (exam?.grades?.academic_level_id) {
                    academicLevelId = exam.grades.academic_level_id;
                }
                
                // Fetch all grading systems and filter by academic level
                const structureRes = await fetch('/api/admin/academic-structure');
                const structureData = await structureRes.json();
                
                const allGradingSystems = structureData.grading_systems || [];
                const allScales = structureData.grading_scales || [];
                
                let options: GradeOption[] = [];
                
                // Get systems that match the academic level, or all systems as fallback
                const relevantSystems = academicLevelId 
                    ? allGradingSystems.filter((gs: any) => gs.academic_level_id === academicLevelId)
                    : allGradingSystems;
                
                relevantSystems.forEach((sys: any) => {
                    const sysScales = allScales.filter((sc: any) => sc.grading_system_id === sys.id);
                    sysScales.forEach((sc: any) => {
                        options.push({
                            symbol: sc.symbol,
                            label: sc.label || sc.symbol,
                            systemName: sys.name,
                            min_percentage: sc.min_percentage,
                            max_percentage: sc.max_percentage,
                        });
                    });
                });
                
                setGradeOptions(options);
            } catch (err) {
                console.error("Failed to load grades", err);
            }
        };
        fetchGrades();
    }, [examId]);

    // Fetch total points for this student
    useEffect(() => {
        const fetchTotalPoints = async () => {
            if (!mark.student_id) return;

            try {
                const [marksRes, structureRes] = await Promise.all([
                    fetch('/api/school/data?type=students'),
                    fetch('/api/admin/academic-structure')
                ]);

                const studentsData = await marksRes.json();
                const structureData = await structureRes.json();

                const student = (studentsData.data || []).find((s: any) => s.id === mark.student_id);
                const streamId = student?.current_grade_stream_id;

                if (!streamId) return;

                const streamMarksRes = await fetch(`/api/school/exam-marks/stream?stream_id=${streamId}`);
                const marksData = await streamMarksRes.json();

                const allMarks = marksData.data || [];
                const gradingScales = structureData.grading_scales || [];

                const scalesMap: Record<string, number> = {};
                gradingScales.forEach((sc: any) => {
                    scalesMap[sc.symbol] = sc.points ?? 0;
                });

                let totalPts = 0;
                allMarks
                    .filter((m: any) => m.student_id === mark.student_id)
                    .forEach((m: any) => {
                        const gradeSymbol = m.grade_symbol;
                        if (gradeSymbol && scalesMap[gradeSymbol]) {
                            totalPts += scalesMap[gradeSymbol];
                        }
                    });

                setTotalPoints(totalPts);
            } catch (err) {
                console.error("Failed to load total points", err);
            }
        };

        fetchTotalPoints();
    }, [mark.student_id]);

    // Auto-resolve grade when score changes (only if teacher hasn't manually set a grade)
    const autoResolveGrade = useCallback((newScore: number) => {
        if (gradeManuallySet) return; // Don't auto-resolve if teacher manually selected a grade
        if (maxScore <= 0 || gradeOptions.length === 0) return;
        // Round to a whole percent before band matching, consistent with the
        // shared getGradeFromScales helper, so gap percentages resolve uniformly.
        const newPercentage = Math.round((newScore / maxScore) * 100);

        const matching = gradeOptions.find(o => newPercentage >= o.min_percentage && newPercentage <= o.max_percentage);
        if (matching) setGrade(matching.symbol);
    }, [maxScore, gradeOptions, gradeManuallySet]);

    const handleScoreChange = (val: string) => {
        setScore(val);
        const num = parseFloat(val);
        if (val && !isNaN(num) && num >= 0 && num <= maxScore) {
            autoResolveGrade(num);
        }
    };

    const handleComponentScoreChange = (componentId: string, val: string) => {
        setComponentScores(prev => {
            const next = { ...prev, [componentId]: val };
            // Auto-resolve grade from the new final percentage
            if (!gradeManuallySet && gradeOptions.length > 0) {
                const result = calculateCompositeSubjectScore(
                    schemeComponents.map(c => ({
                        componentId: c.id,
                        code: c.component_code,
                        maxScore: Number(c.max_score),
                        score: next[c.id] !== undefined && next[c.id] !== '' ? parseFloat(next[c.id]) : null,
                        displayOrder: c.display_order,
                    })),
                    scheme!.aggregation_method
                );
                const roundedPct = Math.round(result.finalPercentage);
                const matching = gradeOptions.find(o =>
                    roundedPct >= o.min_percentage && roundedPct <= o.max_percentage
                );
                if (matching) setGrade(matching.symbol);
            }
            return next;
        });
    };

    const handleGradeChange = (val: string) => {
        setGrade(val);
        setGradeManuallySet(true); // Mark that teacher manually selected a grade
        // Auto-fill rubric for CBC exams
        if (isCBC && CBC_RUBRIC_MAP[val]) {
            setRubric(CBC_RUBRIC_MAP[val]);
        }
    };

    const handleSave = async () => {
        let numScore: number;
        let newPercentage: number;
        let componentsPayload: Record<string, number> | undefined;

        if (multiPaper && composite) {
            // Validate each paper against its own max
            for (const c of schemeComponents) {
                const v = componentScores[c.id];
                if (v === undefined || v === '') continue;
                const num = parseFloat(v);
                if (isNaN(num) || num < 0 || num > Number(c.max_score)) {
                    toast.error(`${c.component_code} score must be between 0 and ${c.max_score}`);
                    return;
                }
            }
            if (composite.enteredCount === 0) {
                toast.error('Enter at least one paper score');
                return;
            }
            componentsPayload = {};
            for (const c of schemeComponents) {
                const v = componentScores[c.id];
                if (v !== undefined && v !== '') componentsPayload[c.id] = parseFloat(v);
            }
            newPercentage = composite.finalPercentage;
            numScore = maxScore > 0 ? Math.round((newPercentage / 100) * maxScore * 100) / 100 : 0;
        } else {
            numScore = parseFloat(score);
            if (isNaN(numScore) || numScore < 0 || numScore > maxScore) {
                toast.error(`Score must be between 0 and ${maxScore}`);
                return;
            }
            newPercentage = maxScore > 0 ? Math.round((numScore / maxScore) * 10000) / 100 : 0;
        }

        if (!grade) {
            toast.error('Please select a grade');
            return;
        }

        setSaving(true);

        try {
            const res = await fetch('/api/school/exam-marks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: mark.id,
                    raw_score: numScore,
                    percentage: newPercentage,
                    grade_symbol: grade,
                    rubric: isCBC ? (rubric || null) : null,
                    remarks: remarks.trim() || null,
                    ...(componentsPayload ? { components: componentsPayload } : {}),
                })
            });

            const json = await res.json();
            if (!res.ok) {
                toast.error(`Failed to save: ${json.error}`);
            } else {
                toast.success('Saved successfully');
                // Hand the parent the updated row (server values are authoritative
                // for the multi-paper recompute) so it can patch in place rather
                // than refetch the whole grid.
                const row = json.data || {};
                onSaved({
                    ...mark,
                    raw_score: row.raw_score ?? numScore,
                    percentage: row.percentage ?? newPercentage,
                    grade_symbol: row.grade_symbol ?? grade,
                    rubric: row.rubric ?? (isCBC ? (rubric || null) : null),
                    remarks: row.remarks ?? (remarks.trim() || null),
                    components: componentsPayload ?? mark.components,
                });
            }
        } catch (err: unknown) {
            toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown Error'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);

        try {
            const res = await fetch(`/api/school/exam-marks?id=${mark.id}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(`Failed to delete: ${data.error}`);
            } else {
                toast.success('Deleted successfully');
                onDeleted();
            }
        } catch (err: unknown) {
            toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown Error'}`);
        } finally {
            setDeleting(false);
        }
    };

    // Group grade options
    const groupedOptions = gradeOptions.reduce<Record<string, GradeOption[]>>((acc, g) => {
        if (!acc[g.systemName]) acc[g.systemName] = [];
        acc[g.systemName].push(g);
        return acc;
    }, {});

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="card w-full max-w-md"
                style={{ animation: 'fadeIn .2s ease' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">Edit Result</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {mark.student_name} <span className="text-xs">({mark.admission_number})</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-[var(--color-text)] text-xl leading-none cursor-pointer"
                        title="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Fields */}
                <div className="flex flex-col gap-4 mb-6">
                    {/* Score — one input per paper for multi-paper subjects */}
                    {multiPaper ? (
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                                📑 Paper Scores *
                            </label>
                            <div className="flex flex-col gap-2">
                                {schemeComponents.map((c, idx) => (
                                    <div key={c.id} className="flex items-center gap-2">
                                        <span className="text-xs font-mono w-8" style={{ color: 'var(--color-text-muted)' }}>{c.component_code}</span>
                                        <input
                                            type="number"
                                            className="input-field flex-1"
                                            style={{ padding: '6px 10px' }}
                                            placeholder={c.component_name}
                                            value={componentScores[c.id] || ''}
                                            onChange={e => handleComponentScoreChange(c.id, e.target.value)}
                                            min={0}
                                            max={Number(c.max_score)}
                                            autoFocus={idx === 0}
                                        />
                                        <span className="text-xs w-12" style={{ color: 'var(--color-text-muted)' }}>/ {Number(c.max_score)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                                Score (max {maxScore}) *
                            </label>
                            <input
                                type="number"
                                className={`input-field w-full`}
                                value={score}
                                onChange={e => handleScoreChange(e.target.value)}
                                min={0}
                                max={maxScore}
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Grade */}
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                            Grade {isCBC ? '(EE1-BE)' : '*'}
                        </label>
                        <select
                            className="input-field w-full"
                            value={grade}
                            onChange={e => handleGradeChange(e.target.value)}
                        >
                            <option value="">Select grade</option>
                            {Object.entries(groupedOptions).map(([systemName, opts]) => (
                                <optgroup key={systemName} label={systemName}>
                                    {opts.map(o => (
                                        <option key={o.symbol} value={o.symbol}>
                                            {o.symbol} — {o.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Rubric - only for CBC */}
                    {isCBC && (
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1">Rubric (Points)</label>
                            <select
                                className="input-field w-full"
                                value={rubric}
                                onChange={e => setRubric(e.target.value)}
                            >
                                <option value="">Select points</option>
                                {/* Derived from CBC_RUBRIC_MAP so the manual options
                                    and the auto-fill mapping can't drift apart. */}
                                {Object.entries(CBC_RUBRIC_MAP).map(([grade, pts]) => (
                                    <option key={grade} value={pts}>{pts} - {grade}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs text-muted-foreground mb-1">Remarks</label>
                        <textarea
                            className="input-field w-full"
                            rows={2}
                            placeholder="Optional remarks..."
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Current percentage preview */}
                    <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
                        {multiPaper && composite ? (
                            <>
                                Final score: <strong>{composite.enteredCount > 0 ? `${composite.finalPercentage.toFixed(1)}%` : '—'}</strong>
                                {composite.enteredCount > 0 && !composite.isComplete && (
                                    <span> (some papers missing — counted as 0)</span>
                                )}
                            </>
                        ) : (
                            <>
                                Percentage: <strong>
                                    {score && !isNaN(parseFloat(score)) && maxScore > 0
                                        ? ((parseFloat(score) / maxScore) * 100).toFixed(1)
                                        : '—'}%
                                </strong>
                            </>
                        )}
                    </div>

                    {/* Total Points */}
                    <div className="text-xs text-primary bg-primary/10 p-2 rounded-md">
                        Total Points (all subjects): <strong>{totalPoints}</strong>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    {/* Delete */}
                    <div>
                        {!confirmDelete ? (
                            <button
                                className="text-sm text-destructive hover:underline cursor-pointer"
                                onClick={() => setConfirmDelete(true)}
                            >
                                🗑 Delete
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-destructive">Are you sure?</span>
                                <button
                                    className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? '...' : 'Yes, delete'}
                                </button>
                                <button
                                    className="text-xs text-muted-foreground hover:text-[var(--color-text)] cursor-pointer"
                                    onClick={() => setConfirmDelete(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Save / Cancel */}
                    <div className="flex gap-3">
                        <button className="btn-secondary" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            className="btn-primary disabled:opacity-50"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
