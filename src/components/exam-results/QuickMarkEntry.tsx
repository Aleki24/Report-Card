"use client";

import React, { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

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
    const supabase = createSupabaseBrowserClient();
    const [students, setStudents] = useState<StudentMissing[]>([]);
    const [scores, setScores] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch students in the class who don't have marks for this exam
    useEffect(() => {
        if (!examId || !gradeStreamId) return;

        const fetchMissing = async () => {
            setLoading(true);
            setMessage(null);

            // Get all students in the stream
            const { data: allStudents } = await supabase
                .from('students')
                .select('id, admission_number, users(first_name, last_name)')
                .eq('current_grade_stream_id', gradeStreamId);

            // Get students who already have marks
            const { data: existingMarks } = await supabase
                .from('exam_marks')
                .select('student_id')
                .eq('exam_id', examId);

            const markedIds = new Set((existingMarks || []).map(m => m.student_id));

            const missing = (allStudents || [])
                .filter(s => !markedIds.has(s.id))
                .map(s => ({
                    id: s.id,
                    name: `${(s as any).users?.first_name || ''} ${(s as any).users?.last_name || ''}`.trim(),
                    admission_number: s.admission_number || '',
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            setStudents(missing);
            setScores({});
            setLoading(false);
        };

        fetchMissing();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examId, gradeStreamId]);

    const handleScoreChange = (studentId: string, value: string) => {
        setScores(prev => ({ ...prev, [studentId]: value }));
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
            const { data: examData } = await supabase
                .from('exams')
                .select('max_score, grade_id')
                .eq('id', examId)
                .single();
            const examMaxScore = examData?.max_score || 100;

            // 2. Fetch grading scales (via the grade's academic level → grading system)
            let gradingScales: { symbol: string; min_percentage: number; max_percentage: number }[] = [];
            if (examData?.grade_id) {
                const { data: gradeData } = await supabase
                    .from('grades')
                    .select('academic_level_id')
                    .eq('id', examData.grade_id)
                    .single();

                if (gradeData?.academic_level_id) {
                    const { data: gs } = await supabase
                        .from('grading_systems')
                        .select('id')
                        .eq('academic_level_id', gradeData.academic_level_id)
                        .limit(1)
                        .single();

                    if (gs) {
                        const { data: scales } = await supabase
                            .from('grading_scales')
                            .select('symbol, min_percentage, max_percentage')
                            .eq('grading_system_id', gs.id)
                            .order('min_percentage', { ascending: false });
                        gradingScales = scales || [];
                    }
                }
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
                    exam_id: examId,
                    student_id: studentId,
                    raw_score: rawScore,
                    percentage,
                    grade_symbol: gradeSymbol,
                };
            });

            const { error } = await supabase.from('exam_marks').insert(entries);

            if (error) {
                setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
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
