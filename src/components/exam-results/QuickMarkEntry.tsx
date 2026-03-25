"use client";

import React, { useState, useEffect } from 'react';

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
    const [manualGrades, setManualGrades] = useState<Record<string, string>>({});
    const [gradingScales, setGradingScales] = useState<{ symbol: string; label: string; systemName: string; min_percentage: number; max_percentage: number }[]>([]);
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

    // Fetch grading scales on mount
    useEffect(() => {
        const fetchScales = async () => {
            try {
                const res = await fetch('/api/school/data?type=grading_scales');
                const dataObj = await res.json();
                if (dataObj.data) {
                    const scales: typeof gradingScales = [];
                    dataObj.data.forEach((sys: any) => {
                        sys.grading_scales?.forEach((sc: any) => {
                            scales.push({
                                symbol: sc.symbol,
                                label: sc.label || '',
                                systemName: sys.name,
                                min_percentage: sc.min_percentage,
                                max_percentage: sc.max_percentage,
                            });
                        });
                    });
                    setGradingScales(scales);
                }
            } catch (err) {
                console.error('Failed to load grading scales:', err);
            }
        };
        fetchScales();
    }, []);

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
            </p>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={thStyle}>#</th>
                                <th style={thStyle}>Student</th>
                                <th style={thStyle}>Admission No</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Score</th>
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
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <select
                                            className="input-field"
                                            style={{ width: 100, padding: '4px 8px', fontSize: 13 }}
                                            value={manualGrades[s.id] || autoResolveGrade(scores[s.id] || '', 100)}
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
