"use client";

import React, { useState, useEffect } from 'react';
import type { ExamSubjectComponentScheme } from '@/types';
import { calculateCompositeSubjectScore, isMultiPaper } from '@/lib/multi-paper';

interface StudentMissing {
    id: string;
    name: string;
    admission_number: string;
}

interface Props {
    examId: string;
    gradeStreamId: string;
    onSaved: () => void;
}

export function QuickMarkEntry({ examId, gradeStreamId, onSaved }: Props) {
    const [students, setStudents] = useState<StudentMissing[]>([]);
    const [scores, setScores] = useState<Record<string, string>>({});
    // Per-paper scores: studentId -> componentId -> score (multi-paper exams)
    const [componentScores, setComponentScores] = useState<Record<string, Record<string, string>>>({});
    const [scheme, setScheme] = useState<ExamSubjectComponentScheme | null>(null);
    const [manualGrades, setManualGrades] = useState<Record<string, string>>({});
    const [gradingScales, setGradingScales] = useState<{ symbol: string; label: string; systemName: string; min_percentage: number; max_percentage: number }[]>([]);
    const [examAcademicLevelId, setExamAcademicLevelId] = useState<string | null>(null);
    const [examMaxScore, setExamMaxScore] = useState<number>(100);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch students in the class who don't have marks for this exam
    useEffect(() => {
        if (!examId || !gradeStreamId) return;

        const fetchMissing = async () => {
            setLoading(true);
            setMessage(null);

            try {
                // Get all students in the stream
                const stuRes = await fetch('/api/school/data?type=students');
                const stuData = await stuRes.json();
                const allStudents = (stuData.data || []).filter((s: any) => s.current_grade_stream_id === gradeStreamId);

                // Get existing marks
                const marksRes = await fetch(`/api/school/exam-marks?exam_id=${examId}`);
                const existingData = await marksRes.json();
                const markedIds = new Set((existingData.data || []).map((m: any) => m.student_id));

                const missing = allStudents
                    .filter((s: any) => !markedIds.has(s.id))
                    .map((s: any) => ({
                        id: s.id,
                        name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
                        admission_number: s.admission_number || '',
                    }))
                    .sort((a: any, b: any) => a.name.localeCompare(b.name));

                setStudents(missing);
                setScores({});
                setComponentScores({});
            } catch (err) {
                console.error('Failed to load missing students:', err);
                setMessage({ type: 'error', text: 'Error loading students.' });
            } finally {
                setLoading(false);
            }
        };

        fetchMissing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examId, gradeStreamId]);

    // Fetch multi-paper configuration for this exam (if any)
    useEffect(() => {
        if (!examId) { setScheme(null); return; }
        (async () => {
            try {
                const res = await fetch(`/api/school/exams/${examId}/components`, { cache: 'no-store' });
                const json = await res.json();
                setScheme(json.data || null);
            } catch {
                setScheme(null);
            }
        })();
    }, [examId]);

    const multiPaper = isMultiPaper(scheme);
    const schemeComponents = multiPaper ? (scheme?.components || []) : [];

    const compositeForStudent = (studentId: string) => {
        const entries = componentScores[studentId] || {};
        return calculateCompositeSubjectScore(
            schemeComponents.map(c => ({
                componentId: c.id,
                code: c.component_code,
                maxScore: Number(c.max_score),
                score: entries[c.id] !== undefined && entries[c.id] !== '' ? parseFloat(entries[c.id]) : null,
                displayOrder: c.display_order,
            })),
            scheme?.aggregation_method || 'sum_then_percentage'
        );
    };

    const handleComponentScoreChange = (studentId: string, componentId: string, value: string) => {
        setComponentScores(prev => ({
            ...prev,
            [studentId]: { ...(prev[studentId] || {}), [componentId]: value },
        }));
    };

    // Fetch grading scales filtered by exam's subject level
    useEffect(() => {
        const fetchScales = async () => {
            try {
                // First get exam details to find the academic level
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
                setExamAcademicLevelId(academicLevelId);
                if (exam?.max_score) setExamMaxScore(exam.max_score);

                // Fetch all grading systems and filter by academic level
                const structureRes = await fetch('/api/admin/academic-structure');
                const structureData = await structureRes.json();
                
                const allGradingSystems = structureData.grading_systems || [];
                const allScales = structureData.grading_scales || [];
                
                // Build filtered scales
                const filteredScales: typeof gradingScales = [];
                
                // Get systems that match the academic level, or all systems as fallback
                const relevantSystems = academicLevelId 
                    ? allGradingSystems.filter((gs: any) => gs.academic_level_id === academicLevelId)
                    : allGradingSystems;
                
                relevantSystems.forEach((sys: any) => {
                    const sysScales = allScales.filter((sc: any) => sc.grading_system_id === sys.id);
                    sysScales.forEach((sc: any) => {
                        filteredScales.push({
                            symbol: sc.symbol,
                            label: sc.label || '',
                            systemName: sys.name,
                            min_percentage: sc.min_percentage,
                            max_percentage: sc.max_percentage,
                        });
                    });
                });
                
                setGradingScales(filteredScales);
            } catch (err) {
                console.error('Failed to load grading scales:', err);
            }
        };
        if (examId) fetchScales();
    }, [examId]);

    const autoResolveGrade = (scoreStr: string, maxScoreVal: number): string => {
        const num = parseFloat(scoreStr);
        if (!scoreStr || isNaN(num) || maxScoreVal <= 0) return '';
        const pct = (num / maxScoreVal) * 100;
        for (const scale of gradingScales) {
            if (pct >= scale.min_percentage && pct <= scale.max_percentage) {
                return scale.symbol;
            }
        }
        return '';
    };

    const handleScoreChange = (studentId: string, value: string) => {
        setScores(prev => ({ ...prev, [studentId]: value }));
        // Auto-resolve grade only if the user hasn't manually set one
        if (!manualGrades[studentId]) {
            // We'll resolve on render since we may not have max_score yet
        }
    };

    const handleGradeChange = (studentId: string, value: string) => {
        setManualGrades(prev => ({ ...prev, [studentId]: value }));
    };

    const handleSubmit = async () => {
        setMessage(null);

        // ── Multi-paper: submit per-paper scores, server resolves final ──
        if (multiPaper) {
            const studentIds = students
                .map(s => s.id)
                .filter(id => schemeComponents.some(c => {
                    const v = componentScores[id]?.[c.id];
                    return v !== undefined && v !== '' && !isNaN(Number(v));
                }));

            if (studentIds.length === 0) {
                setMessage({ type: 'error', text: 'Enter at least one paper score before submitting.' });
                return;
            }

            // Validate against each paper's max score
            for (const id of studentIds) {
                for (const c of schemeComponents) {
                    const v = componentScores[id]?.[c.id];
                    if (v === undefined || v === '') continue;
                    const num = Number(v);
                    if (isNaN(num) || num < 0 || num > Number(c.max_score)) {
                        const student = students.find(s => s.id === id);
                        setMessage({ type: 'error', text: `${student?.name || 'Student'}: ${c.component_code} must be between 0 and ${c.max_score}` });
                        return;
                    }
                }
            }

            setSaving(true);
            try {
                const entries = studentIds.map(id => {
                    const composite = compositeForStudent(id);
                    const components: Record<string, number> = {};
                    for (const c of schemeComponents) {
                        const v = componentScores[id]?.[c.id];
                        if (v !== undefined && v !== '') components[c.id] = Number(v);
                    }
                    return {
                        student_id: id,
                        raw_score: examMaxScore > 0 ? Math.round((composite.finalPercentage / 100) * examMaxScore * 100) / 100 : 0,
                        percentage: composite.finalPercentage,
                        grade_symbol: manualGrades[id] || autoResolveGrade(String(composite.finalPercentage), 100) || null,
                        remarks: '',
                        components,
                    };
                });

                const res = await fetch('/api/school/exam-marks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exam_id: examId, marks: entries })
                });
                const result = await res.json();

                if (!res.ok) {
                    setMessage({ type: 'error', text: `Failed to save: ${result.error}` });
                } else {
                    setMessage({ type: 'success', text: `${entries.length} mark(s) saved successfully!` });
                    onSaved();
                }
            } catch (err: unknown) {
                setMessage({ type: 'error', text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` });
            }
            setSaving(false);
            return;
        }

        // Only submit rows that have a score entered
        const rawEntries = Object.entries(scores)
            .filter(([, val]) => val !== '' && !isNaN(Number(val)));

        if (rawEntries.length === 0) {
            setMessage({ type: 'error', text: 'Enter at least one score before submitting.' });
            return;
        }

        setSaving(true);

        try {
            // 1. Fetch exam max_score
            const examsRes = await fetch('/api/school/data?type=exams');
            const { data: examsData } = await examsRes.json();
            const examData = examsData?.find((e: any) => e.id === examId);
            const examMaxScore = examData?.max_score || 100;

            // 2. Fetch grading scales
            const scalesRes = await fetch('/api/school/data?type=grading_scales');
            const scalesObj = await scalesRes.json();
            let gradingScales: { symbol: string; min_percentage: number; max_percentage: number }[] = [];
            
            // Assume the first grading system applies, or flatten all scales (adjust if multiple systems exist)
            if (scalesObj.data) {
                scalesObj.data.forEach((sys: any) => {
                    sys.grading_scales?.forEach((sc: any) => {
                        gradingScales.push({
                            symbol: sc.symbol,
                            min_percentage: sc.min_percentage,
                            max_percentage: sc.max_percentage,
                        });
                    });
                });
            }

            // 3. Build entries with percentage and auto-grade
            const entries = rawEntries.map(([studentId, val]) => {
                const rawScore = Number(val);
                const percentage = examMaxScore > 0 ? Math.round((rawScore / examMaxScore) * 10000) / 100 : 0;

                // Find matching grade from scales
                let gradeSymbol: string | null = null;
                for (const scale of gradingScales) {
                    if (percentage >= scale.min_percentage && percentage <= scale.max_percentage) {
                        gradeSymbol = scale.symbol;
                        break;
                    }
                }

                return {
                    student_id: studentId,
                    raw_score: rawScore,
                    percentage,
                    grade_symbol: manualGrades[studentId] || gradeSymbol,
                    remarks: '',
                };
            });

            const res = await fetch('/api/school/exam-marks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exam_id: examId, marks: entries })
            });
            const result = await res.json();

            if (!res.ok) {
                setMessage({ type: 'error', text: `Failed to save: ${result.error}` });
            } else {
                setMessage({ type: 'success', text: `${entries.length} mark(s) saved successfully!` });
                onSaved();
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setMessage({ type: 'error', text: `Error: ${msg}` });
        }

        setSaving(false);
    };

    if (loading) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading students…</p>
            </div>
        );
    }

    if (students.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                <div style={{ fontSize: 32, marginBottom: 'var(--space-3)' }}>✅</div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    All students in this class already have marks for this exam.
                </p>
            </div>
        );
    }

    return (
        <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                {students.length} student{students.length !== 1 ? 's' : ''} missing marks — enter scores below and submit.
                {multiPaper && (
                    <span style={{ display: 'block', marginTop: 4, color: 'var(--color-accent)' }}>
                        📑 Multi-paper subject: enter each paper separately ({schemeComponents.map(c => `${c.component_code}/${Number(c.max_score)}`).join(' + ')}). * = some papers still missing (counted as 0).
                    </span>
                )}
            </p>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={thStyle}>#</th>
                                <th style={thStyle}>Student</th>
                                <th style={thStyle}>Admission No</th>
                                {multiPaper ? (
                                    <>
                                        {schemeComponents.map(c => (
                                            <th key={c.id} style={{ ...thStyle, textAlign: 'center' }} title={c.component_name}>
                                                {c.component_code} /{Number(c.max_score)}
                                            </th>
                                        ))}
                                        <th style={{ ...thStyle, textAlign: 'center' }}>Final %</th>
                                    </>
                                ) : (
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Score</th>
                                )}
                                <th style={{ ...thStyle, textAlign: 'center' }}>Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s, i) => (
                                <tr
                                    key={s.id}
                                    style={{
                                        borderBottom: '1px solid var(--color-border)',
                                        background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-raised)',
                                    }}
                                >
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{i + 1}</td>
                                    <td style={tdStyle}>{s.name}</td>
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{s.admission_number}</td>
                                    {multiPaper ? (
                                        <>
                                            {schemeComponents.map(c => {
                                                const v = componentScores[s.id]?.[c.id] || '';
                                                const num = Number(v);
                                                const invalid = v !== '' && (isNaN(num) || num < 0 || num > Number(c.max_score));
                                                return (
                                                    <td key={c.id} style={{ ...tdStyle, textAlign: 'center' }}>
                                                        <input
                                                            type="number"
                                                            className="input-field"
                                                            style={{ width: 70, textAlign: 'center', padding: '4px 8px', fontSize: 13, borderColor: invalid ? 'var(--color-danger, #EF4444)' : undefined }}
                                                            placeholder="—"
                                                            min={0}
                                                            max={Number(c.max_score)}
                                                            value={v}
                                                            onChange={e => handleComponentScoreChange(s.id, c.id, e.target.value)}
                                                        />
                                                    </td>
                                                );
                                            })}
                                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--color-accent)' }}>
                                                {(() => {
                                                    const composite = compositeForStudent(s.id);
                                                    return composite.enteredCount > 0
                                                        ? `${composite.finalPercentage.toFixed(1)}%${composite.isComplete ? '' : '*'}`
                                                        : '—';
                                                })()}
                                            </td>
                                        </>
                                    ) : (
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                className="input-field"
                                                style={{ width: 80, textAlign: 'center', padding: '4px 8px', fontSize: 13 }}
                                                placeholder="—"
                                                min={0}
                                                value={scores[s.id] || ''}
                                                onChange={e => handleScoreChange(s.id, e.target.value)}
                                            />
                                        </td>
                                    )}
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <select
                                            className="input-field"
                                            style={{ width: 100, padding: '4px 8px', fontSize: 13 }}
                                            value={manualGrades[s.id] || (multiPaper
                                                ? (() => {
                                                    const composite = compositeForStudent(s.id);
                                                    return composite.enteredCount > 0 ? autoResolveGrade(String(composite.finalPercentage), 100) : '';
                                                })()
                                                : autoResolveGrade(scores[s.id] || '', examMaxScore))}
                                            onChange={e => handleGradeChange(s.id, e.target.value)}
                                        >
                                            <option value="">—</option>
                                            {gradingScales.map(g => (
                                                <option key={g.symbol} value={g.symbol}>
                                                    {g.symbol}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Feedback */}
            {message && (
                <div
                    className={`mt-4 p-3 rounded-md text-sm ${message.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                >
                    {message.text}
                </div>
            )}

            <div className="flex justify-end" style={{ marginTop: 'var(--space-4)' }}>
                <button
                    className="btn-primary disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={saving}
                >
                    {saving ? 'Saving…' : 'Submit Marks'}
                </button>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    whiteSpace: 'nowrap',
};
