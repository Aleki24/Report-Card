"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface GradeOption {
    symbol: string;
    label: string;
    systemName: string;
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
    onClose: () => void;
    onSaved: () => void;
    onDeleted: () => void;
}

export function EditMarkModal({ mark, maxScore, onClose, onSaved, onDeleted }: Props) {
    const supabase = createSupabaseBrowserClient();

    const [score, setScore] = useState(String(mark.raw_score));
    const [grade, setGrade] = useState(mark.grade_symbol);
    const [remarks, setRemarks] = useState(mark.remarks || '');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');
    const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);

    // Fetch grade options
    useEffect(() => {
        const fetchGrades = async () => {
            const { data } = await supabase
                .from('grading_scales')
                .select('symbol, label, grading_systems!inner(name)')
                .order('order_index');
            if (data) {
                setGradeOptions(data.map((d: any) => ({
                    symbol: d.symbol,
                    label: d.label,
                    systemName: d.grading_systems?.name || '',
                })));
            }
        };
        fetchGrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-resolve grade when score changes
    const autoResolveGrade = useCallback(async (newScore: number) => {
        if (maxScore <= 0) return;
        const newPercentage = Math.round((newScore / maxScore) * 10000) / 100;

        try {
            const { data: examData } = await supabase
                .from('exam_marks')
                .select('exams!inner(grade_id, grades!inner(academic_level_id))')
                .eq('id', mark.id)
                .single();

            const levelId = (examData as any)?.exams?.grades?.academic_level_id;
            if (levelId) {
                const { data: gs } = await supabase
                    .from('grading_systems')
                    .select('id')
                    .eq('academic_level_id', levelId)
                    .limit(1)
                    .single();
                if (gs) {
                    const { data: scale } = await supabase
                        .from('grading_scales')
                        .select('symbol')
                        .eq('grading_system_id', gs.id)
                        .lte('min_percentage', newPercentage)
                        .gte('max_percentage', newPercentage)
                        .limit(1)
                        .single();
                    if (scale) setGrade(scale.symbol);
                }
            }
        } catch { /* best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mark.id, maxScore]);

    const handleScoreChange = (val: string) => {
        setScore(val);
        setError('');
        const num = parseFloat(val);
        if (val && !isNaN(num) && num >= 0 && num <= maxScore) {
            autoResolveGrade(num);
        }
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

        const { error: updateErr } = await supabase
            .from('exam_marks')
            .update({
                raw_score: numScore,
                percentage: newPercentage,
                grade_symbol: grade,
                remarks: remarks.trim() || null,
            })
            .eq('id', mark.id);

        setSaving(false);

        if (updateErr) {
            setError(`Failed to save: ${updateErr.message}`);
        } else {
            onSaved();
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        setError('');

        const { error: deleteErr } = await supabase
            .from('exam_marks')
            .delete()
            .eq('id', mark.id);

        setDeleting(false);

        if (deleteErr) {
            setError(`Failed to delete: ${deleteErr.message}`);
        } else {
            onDeleted();
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
                            onChange={e => setGrade(e.target.value)}
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
