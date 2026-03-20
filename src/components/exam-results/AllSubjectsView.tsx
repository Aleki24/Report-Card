"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

interface Props {
    gradeStreamId: string;
}

interface StudentRow {
    studentId: string;
    studentName: string;
    admissionNumber: string;
    subjects: Record<string, { score: number; grade: string }>;
    total: number;
    average: number;
    rank: number;
}

export function AllSubjectsView({ gradeStreamId }: Props) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<StudentRow[]>([]);
    const [subjectNames, setSubjectNames] = useState<string[]>([]);

    useEffect(() => {
        if (!gradeStreamId) return;
        const fetchAll = async () => {
            setLoading(true);

            // Get the grade_id for this stream so we can find all exams for this grade/stream
            const { data: streamData } = await supabase
                .from('grade_streams')
                .select('grade_id')
                .eq('id', gradeStreamId)
                .single();

            if (!streamData) { setLoading(false); return; }

            // Fetch all marks for students in this stream, with exam + subject info
            const { data: marks } = await supabase
                .from('exam_marks')
                .select(`
                    id, raw_score, percentage, grade_symbol, student_id,
                    exams ( id, name, subject_id, subjects(name) ),
                    students!inner ( admission_number, current_grade_stream_id, users(first_name, last_name) )
                `)
                .eq('students.current_grade_stream_id', gradeStreamId);

            if (!marks || marks.length === 0) {
                setRows([]);
                setSubjectNames([]);
                setLoading(false);
                return;
            }

            const validMarks = marks.filter(m => m.students && m.exams && (m.exams as any).subjects);

            // Aggregate: for each student × subject, keep the latest (or best) score
            // Using a map: studentId → { name, admNo, subjects: { subjectName → { score, grade } } }
            const studentMap: Record<string, {
                name: string;
                admNo: string;
                subjects: Record<string, { score: number; grade: string }>;
            }> = {};
            const allSubjects = new Set<string>();

            validMarks.forEach(m => {
                const exam = m.exams as any;
                const stu = m.students as any;
                const subjName = exam.subjects?.name || 'Unknown';
                const firstName = stu?.users?.first_name || '';
                const lastName = stu?.users?.last_name || '';
                const pct = Number(m.percentage);
                const grade = m.grade_symbol || '-';

                allSubjects.add(subjName);

                if (!studentMap[m.student_id]) {
                    studentMap[m.student_id] = {
                        name: `${firstName} ${lastName}`.trim() || 'Unknown',
                        admNo: stu?.admission_number || '',
                        subjects: {},
                    };
                }

                // If student already has a score for this subject, keep the latest (higher percentage wins)
                const existing = studentMap[m.student_id].subjects[subjName];
                if (!existing || pct > existing.score) {
                    studentMap[m.student_id].subjects[subjName] = { score: pct, grade };
                }
            });

            const subjects = Array.from(allSubjects).sort();
            setSubjectNames(subjects);

            // Build rows with total, average, and rank
            const rawRows = Object.entries(studentMap).map(([studentId, data]) => {
                const subjectScores = subjects.map(s => data.subjects[s]?.score || 0);
                const enteredCount = subjects.filter(s => data.subjects[s]).length;
                const total = subjectScores.reduce((s, v) => s + v, 0);
                const average = enteredCount > 0 ? total / enteredCount : 0;

                return {
                    studentId,
                    studentName: data.name,
                    admissionNumber: data.admNo,
                    subjects: data.subjects,
                    total: Number(total.toFixed(1)),
                    average: Number(average.toFixed(1)),
                    rank: 0,
                };
            });

            // Sort by average descending and assign ranks
            rawRows.sort((a, b) => b.average - a.average);
            let rank = 0;
            let lastAvg = -1;
            rawRows.forEach((row, i) => {
                if (row.average !== lastAvg) {
                    rank = i + 1;
                    lastAvg = row.average;
                }
                row.rank = rank;
            });

            setRows(rawRows);
            setLoading(false);
        };

        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gradeStreamId]);

    if (loading) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading all subjects…</p>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    No marks found for this class. Enter marks in individual exams first.
                </p>
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                    📋 All Subjects — Aggregated Results
                </h3>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Showing best score per subject for each student. {rows.length} students · {subjectNames.length} subjects
                </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface-raised)' }}>
                            <th style={thStyle}>Rank</th>
                            <th style={thStyle}>Student</th>
                            <th style={thStyle}>Adm No</th>
                            {subjectNames.map(s => (
                                <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 80 }}>{s}</th>
                            ))}
                            <th style={{ ...thStyle, textAlign: 'center' }}>Total</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr
                                key={row.studentId}
                                style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-raised)',
                                }}
                            >
                                <td style={{ ...tdStyle, fontWeight: 700, color: row.rank <= 3 ? '#F59E0B' : 'var(--color-text)' }}>
                                    {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}
                                </td>
                                <td style={{ ...tdStyle, fontWeight: 500 }}>{row.studentName}</td>
                                <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{row.admissionNumber}</td>
                                {subjectNames.map(s => {
                                    const val = row.subjects[s];
                                    return (
                                        <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                                            {val ? (
                                                <span title={`Grade: ${val.grade}`}>
                                                    <span style={{ fontWeight: 600 }}>{val.score.toFixed(0)}</span>
                                                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 2 }}>{val.grade}</span>
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                            )}
                                        </td>
                                    );
                                })}
                                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{row.total.toFixed(0)}</td>
                                <td style={{
                                    ...tdStyle,
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    color: row.average >= 70 ? '#10B981' : row.average >= 50 ? '#F59E0B' : '#EF4444',
                                }}>
                                    {row.average.toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    whiteSpace: 'nowrap',
};
