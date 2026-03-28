"use client";

import React, { useState, useEffect, useCallback } from 'react';

interface GradeOption {
    symbol: string;
    label: string;
    systemName: string;
    min_percentage: number;
    max_percentage: number;
}

export interface EditMarkData {
    id: string;
    student_name: string;
    admission_number: string;
    raw_score: number;
    percentage: number;
    grade_symbol: string;
    remarks: string | null;
}

interface Props {
    mark: EditMarkData;
    maxScore: number;
    examId: string;
    onClose: () => void;
    onSaved: () => void;
    onDeleted: () => void;
}

export function EditMarkModal({ mark, maxScore, examId, onClose, onSaved, onDeleted }: Props) {
    const [score, setScore] = useState(String(mark.raw_score));
    const [grade, setGrade] = useState(mark.grade_symbol);
    const [gradeManuallySet, setGradeManuallySet] = useState(false);
    const [remarks, setRemarks] = useState(mark.remarks || '');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');
    const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);

    // Fetch grade options filtered by exam's subject level
    useEffect(() => {
        const fetchGrades = async () => {
            try {
                // Get exam details first
                const examsRes = await fetch('/api/school/data?type=exams');
                const examsData = await examsRes.json();
                const exam = (examsData.data || []).find((e: any) => e.id === examId);
                
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
                
                // Filter by academic level
                allGradingSystems
                    .filter((gs: any) => gs.academic_level_id === academicLevelId)
                    .forEach((sys: any) => {
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

    // Auto-resolve grade when score changes (only if teacher hasn't manually set a grade)
    const autoResolveGrade = useCallback((newScore: number) => {
        if (gradeManuallySet) return; // Don't auto-resolve if teacher manually selected a grade
        if (maxScore <= 0 || gradeOptions.length === 0) return;
        const newPercentage = Math.round((newScore / maxScore) * 10000) / 100;

        const matching = gradeOptions.find(o => newPercentage >= o.min_percentage && newPercentage <= o.max_percentage);
        if (matching) setGrade(matching.symbol);
    }, [maxScore, gradeOptions, gradeManuallySet]);

    const handleScoreChange = (val: string) => {
        setScore(val);
        setError('');
        const num = parseFloat(val);
        if (val && !isNaN(num) && num >= 0 && num <= maxScore) {
            autoResolveGrade(num);
        }
    };

    const handleGradeChange = (val: string) => {
        setGrade(val);
        setGradeManuallySet(true); // Mark that teacher manually selected a grade
    };

    const handleSave = async () => {
        const numScore = parseFloat(score);
        if (isNaN(numScore) || numScore < 0 || numScore > maxScore) {
            setError(`Score must be between 0 and ${maxScore}`);
            return;
        }
        if (!grade) {
            setError('Please select a grade');
            return;
        }

        setSaving(true);
        setError('');

        const newPercentage = maxScore > 0 ? Math.round((numScore / maxScore) * 10000) / 100 : 0;

        try {
            const res = await fetch('/api/school/exam-marks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: mark.id,
                    raw_score: numScore,
                    percentage: newPercentage,
                    grade_symbol: grade,
                    remarks: remarks.trim() || null
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(`Failed to save: ${data.error}`);
            } else {
                onSaved();
            }
        } catch (err: unknown) {
            setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown Error'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        setError('');

        try {
            const res = await fetch(`/api/school/exam-marks?id=${mark.id}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (!res.ok) {
                setError(`Failed to delete: ${data.error}`);
            } else {
                onDeleted();
            }
        } catch (err: unknown) {
            setError(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown Error'}`);
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
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            {mark.student_name} <span className="text-xs">({mark.admission_number})</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl leading-none cursor-pointer"
                        title="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Fields */}
                <div className="flex flex-col gap-4 mb-6">
                    {/* Score */}
                    <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                            Score (max {maxScore}) *
                        </label>
                        <input
                            type="number"
                            className={`input-field w-full ${error && error.includes('Score') ? 'border-[var(--color-danger)]' : ''}`}
                            value={score}
                            onChange={e => handleScoreChange(e.target.value)}
                            min={0}
                            max={maxScore}
                            autoFocus
                        />
                    </div>

                    {/* Grade */}
                    <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Grade *</label>
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

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Remarks</label>
                        <textarea
                            className="input-field w-full"
                            rows={2}
                            placeholder="Optional remarks..."
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        />
                    </div>

                    {/* Current percentage preview */}
                    <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-raised)] p-2 rounded-md">
                        Percentage: <strong>
                            {score && !isNaN(parseFloat(score)) && maxScore > 0
                                ? ((parseFloat(score) / maxScore) * 100).toFixed(1)
                                : '—'}%
                        </strong>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                    {/* Delete */}
                    <div>
                        {!confirmDelete ? (
                            <button
                                className="text-sm text-[var(--color-danger)] hover:underline cursor-pointer"
                                onClick={() => setConfirmDelete(true)}
                            >
                                🗑 Delete
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--color-danger)]">Are you sure?</span>
                                <button
                                    className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? '...' : 'Yes, delete'}
                                </button>
                                <button
                                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
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
