"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface GradeOption {
    symbol: string;
    label: string;
    systemName: string;
}

interface StudentOption {
    id: string;
    name: string;
    admission_number: string;
}

interface GradeItem { id: string; name_display: string; academic_level_id: string; }
interface StreamItem { id: string; full_name: string; grade_id: string; }

interface MarkRow {
    studentId: string;       // Selected student ID
    studentName: string;     // Display name (auto-filled)
    admissionNumber: string; // Auto-filled from selection
    score: string;
    grade: string;
    remarks: string;
    error: string;
}

interface Props {
    examId: string;
    maxScore?: number;
}

const emptyRow = (): MarkRow => ({
    studentId: '', studentName: '', admissionNumber: '', score: '', grade: '', remarks: '', error: '',
});

export function ManualEntryGrid({ examId, maxScore = 100 }: Props) {
    const supabase = createSupabaseBrowserClient();

    // Class/stream filter
    const [grades, setGrades] = useState<GradeItem[]>([]);
    const [allStreams, setAllStreams] = useState<StreamItem[]>([]);
    const [selectedGradeId, setSelectedGradeId] = useState('');
    const [selectedStreamId, setSelectedStreamId] = useState('');

    // Students for the selected class
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [studentsLoading, setStudentsLoading] = useState(false);

    // Grade scale options
    const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);

    // Grading scales for auto-grade
    const [gradingScales, setGradingScales] = useState<{ symbol: string; min_percentage: number; max_percentage: number }[]>([]);

    // Entry rows
    const [rows, setRows] = useState<MarkRow[]>([emptyRow(), emptyRow(), emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ── Fetch grades + streams on mount ──────────────────
    useEffect(() => {
        const fetchStructure = async () => {
            try {
                const res = await fetch('/api/admin/academic-structure');
                const data = await res.json();
                if (data.grades) setGrades(data.grades);
                if (data.grade_streams) setAllStreams(data.grade_streams);
            } catch (err) {
                console.error('Failed to load class structure:', err);
            }
        };
        fetchStructure();
    }, []);

    // ── Fetch grading scales + grade options on mount ────
    useEffect(() => {
        const fetchGrades = async () => {
            const { data } = await supabase
                .from('grading_scales')
                .select('symbol, label, min_percentage, max_percentage, grading_systems!inner(name)')
                .order('order_index');
            if (data) {
                setGradeOptions(data.map((d: any) => ({
                    symbol: d.symbol,
                    label: d.label,
                    systemName: d.grading_systems?.name || '',
                })));
                setGradingScales(data.map((d: any) => ({
                    symbol: d.symbol,
                    min_percentage: d.min_percentage,
                    max_percentage: d.max_percentage,
                })));
            }
        };
        fetchGrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Reset stream when grade changes ──────────────────
    useEffect(() => { setSelectedStreamId(''); }, [selectedGradeId]);

    // ── Fetch students when stream changes ───────────────
    const fetchStudents = useCallback(async () => {
        if (!selectedStreamId) {
            setStudents([]);
            return;
        }
        setStudentsLoading(true);
        const { data } = await supabase
            .from('students')
            .select('id, admission_number, users(first_name, last_name)')
            .eq('current_grade_stream_id', selectedStreamId);

        const list: StudentOption[] = (data || [])
            .map((s: any) => ({
                id: s.id,
                name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
                admission_number: s.admission_number || '',
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        setStudents(list);
        setStudentsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStreamId]);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    // ── Filtered streams ─────────────────────────────────
    const filteredStreams = allStreams.filter(s => s.grade_id === selectedGradeId);

    // ── Already-selected student IDs (prevent duplicate selection) ──
    const selectedStudentIds = new Set(rows.map(r => r.studentId).filter(Boolean));

    // ── Auto-resolve grade from score ────────────────────
    const autoResolveGrade = (scoreStr: string): string => {
        const num = parseFloat(scoreStr);
        if (!scoreStr || isNaN(num) || maxScore <= 0) return '';
        const pct = (num / maxScore) * 100;
        for (const scale of gradingScales) {
            if (pct >= scale.min_percentage && pct <= scale.max_percentage) {
                return scale.symbol;
            }
        }
        return '';
    };

    // ── Row helpers ──────────────────────────────────────
    const updateRow = (index: number, field: keyof MarkRow, value: string) => {
        setRows(prev => {
            const updated = [...prev];
            const row = { ...updated[index], [field]: value, error: '' };

            // When student is selected, auto-fill name and admission number
            if (field === 'studentId') {
                const student = students.find(s => s.id === value);
                if (student) {
                    row.studentName = student.name;
                    row.admissionNumber = student.admission_number;
                } else {
                    row.studentName = '';
                    row.admissionNumber = '';
                }
            }

            // When score changes, validate and auto-resolve grade
            if (field === 'score') {
                const num = parseFloat(value);
                if (value && isNaN(num)) {
                    row.error = 'Score must be a number';
                } else if (value && (num < 0 || num > maxScore)) {
                    row.error = `Score must be between 0 and ${maxScore}`;
                } else {
                    // Auto-resolve grade
                    const resolved = autoResolveGrade(value);
                    if (resolved) row.grade = resolved;
                }
            }

            updated[index] = row;
            return updated;
        });
    };

    const addRow = () => setRows(prev => [...prev, emptyRow()]);

    const removeRow = (index: number) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter((_, i) => i !== index));
    };

    // ── Submit ───────────────────────────────────────────
    const handleSubmit = async () => {
        if (!examId) {
            setSaveMessage({ type: 'error', text: 'Please select an exam first.' });
            return;
        }

        // Filter to only rows that have at least a student selected and a score
        const filledRows = rows.filter(r => r.studentId && r.score);
        if (filledRows.length === 0) {
            setSaveMessage({ type: 'error', text: 'Please select at least one student and enter a score.' });
            return;
        }

        const hasErrors = filledRows.some(r => r.error !== '');
        if (hasErrors) {
            setSaveMessage({ type: 'error', text: 'Please fix all errors before submitting.' });
            return;
        }

        // Check for missing grades
        const missingGrade = filledRows.some(r => !r.grade);
        if (missingGrade) {
            setSaveMessage({ type: 'error', text: 'Please ensure all rows have a grade selected.' });
            return;
        }

        setSaving(true);
        setSaveMessage(null);

        try {
            // Fetch exam max_score for accurate percentage
            const { data: examData } = await supabase
                .from('exams')
                .select('max_score')
                .eq('id', examId)
                .single();
            const examMaxScore = examData?.max_score || maxScore;

            const insertRows = filledRows.map(r => {
                const score = parseFloat(r.score);
                const percentage = examMaxScore > 0 ? Math.round((score / examMaxScore) * 10000) / 100 : 0;
                return {
                    exam_id: examId,
                    student_id: r.studentId,
                    raw_score: score,
                    percentage,
                    grade_symbol: r.grade,
                    remarks: r.remarks || null,
                };
            });

            const { error } = await supabase.from('exam_marks').insert(insertRows);

            if (error) {
                setSaveMessage({ type: 'error', text: `Database error: ${error.message}` });
            } else {
                setSaveMessage({ type: 'success', text: `✅ Successfully saved ${filledRows.length} mark${filledRows.length !== 1 ? 's' : ''}!` });
                // Refresh students list (some are now entered) and reset rows
                await fetchStudents();
                setTimeout(() => {
                    setRows([emptyRow(), emptyRow(), emptyRow()]);
                    setSaveMessage(null);
                }, 2500);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown';
            setSaveMessage({ type: 'error', text: `Unexpected error: ${message}` });
        } finally {
            setSaving(false);
        }
    };

    // ── Group grade options ──────────────────────────────
    const groupedOptions = gradeOptions.reduce<Record<string, GradeOption[]>>((acc, g) => {
        if (!acc[g.systemName]) acc[g.systemName] = [];
        acc[g.systemName].push(g);
        return acc;
    }, {});

    return (
        <div className="card overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-1">Manual Entry</h3>
                    <p className="text-[var(--color-text-muted)] text-sm">Select a class, then pick students from the dropdown · Max score: {maxScore}</p>
                </div>
            </div>

            {/* ── Class / Stream Filter ─────────────────── */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                <div className="flex-1">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-semibold uppercase tracking-wider">Class / Level</label>
                    <select
                        className="input-field w-full"
                        value={selectedGradeId}
                        onChange={e => setSelectedGradeId(e.target.value)}
                    >
                        <option value="">— Select Class —</option>
                        {grades.map(g => (
                            <option key={g.id} value={g.id}>{g.name_display}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-semibold uppercase tracking-wider">Stream</label>
                    <select
                        className="input-field w-full"
                        value={selectedStreamId}
                        onChange={e => setSelectedStreamId(e.target.value)}
                        disabled={!selectedGradeId || filteredStreams.length === 0}
                    >
                        <option value="">{!selectedGradeId ? 'Select class first' : filteredStreams.length === 0 ? 'No streams' : '— Select Stream —'}</option>
                        {filteredStreams.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                    </select>
                </div>
                {selectedStreamId && (
                    <div className="flex items-end">
                        <div className="text-xs text-[var(--color-accent)] font-semibold py-2">
                            {studentsLoading ? 'Loading…' : `${students.length} student${students.length !== 1 ? 's' : ''}`}
                        </div>
                    </div>
                )}
            </div>

            {/* No stream selected hint */}
            {!selectedStreamId && (
                <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                    👆 Select a <strong>Class</strong> and <strong>Stream</strong> above to load students
                </div>
            )}

            {/* ── Entry Table (only shown when stream selected) ── */}
            {selectedStreamId && students.length > 0 && (
                <>
                    {saveMessage && (
                        <div className={`mb-6 p-3 rounded-md text-sm ${saveMessage.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}>
                            {saveMessage.text}
                        </div>
                    )}

                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                        <table className="data-table sm:whitespace-nowrap w-full sm:min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="w-10">#</th>
                                    <th>Student</th>
                                    <th>Adm No</th>
                                    <th className="w-24">Score *</th>
                                    <th className="w-40">Grade *</th>
                                    <th>Remarks</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i} className={row.error ? 'bg-red-500/5' : ''}>
                                        <td data-label="#" className="text-[var(--color-text-muted)] text-xs">{i + 1}</td>
                                        {/* Student dropdown */}
                                        <td data-label="Student">
                                            <select
                                                className="input-field text-sm w-full min-w-[200px]"
                                                value={row.studentId}
                                                onChange={e => updateRow(i, 'studentId', e.target.value)}
                                            >
                                                <option value="">— Select Student —</option>
                                                {students.map(s => {
                                                    // Show already-selected students as disabled (except current row)
                                                    const taken = selectedStudentIds.has(s.id) && row.studentId !== s.id;
                                                    return (
                                                        <option key={s.id} value={s.id} disabled={taken}>
                                                            {s.name}{taken ? ' (already added)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </td>
                                        {/* Admission number (auto-filled, read-only) */}
                                        <td data-label="Adm No">
                                            <span className="text-sm text-[var(--color-text-muted)]">
                                                {row.admissionNumber || '—'}
                                            </span>
                                        </td>
                                        {/* Score */}
                                        <td data-label="Score">
                                            <input
                                                className={`input-field text-sm ${row.error ? 'border-[var(--color-danger)] focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : ''}`}
                                                placeholder={`0-${maxScore}`}
                                                value={row.score}
                                                onChange={e => updateRow(i, 'score', e.target.value)}
                                            />
                                        </td>
                                        {/* Grade (auto-resolved but editable) */}
                                        <td data-label="Grade">
                                            <select
                                                className="input-field text-sm"
                                                value={row.grade}
                                                onChange={e => updateRow(i, 'grade', e.target.value)}
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
                                        </td>
                                        {/* Remarks */}
                                        <td data-label="Remarks">
                                            <input
                                                className="input-field text-sm"
                                                placeholder="Optional"
                                                value={row.remarks}
                                                onChange={e => updateRow(i, 'remarks', e.target.value)}
                                            />
                                        </td>
                                        {/* Remove */}
                                        <td data-label="Action">
                                            <button
                                                onClick={() => removeRow(i)}
                                                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] p-2 text-lg transition-colors cursor-pointer"
                                                title="Remove row"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {rows.some(r => r.error) && (
                        <div className="mt-4 p-3 bg-red-500/10 rounded-md">
                            {rows.filter(r => r.error).map((r, i) => (
                                <div key={i} className="text-xs text-[var(--color-danger)] mb-1">
                                    • Row {rows.indexOf(r) + 1}: {r.error}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4">
                        <button className="btn-secondary w-full sm:w-auto justify-center" onClick={addRow}>+ Add Row</button>
                        <button
                            className="btn-primary w-full sm:w-auto justify-center shrink-0 disabled:opacity-50"
                            onClick={handleSubmit}
                            disabled={saving}
                        >
                            {saving ? '⏳ Saving...' : 'Save All'}
                        </button>
                    </div>
                </>
            )}

            {/* Stream selected but no students */}
            {selectedStreamId && !studentsLoading && students.length === 0 && (
                <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">
                    No students found in this class/stream. Add students in the <strong>Students</strong> page first.
                </div>
            )}
        </div>
    );
}
