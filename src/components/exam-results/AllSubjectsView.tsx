"use client";

import React, { useState, useEffect } from 'react';

interface Props {
    gradeStreamId: string;
}

interface StudentRow {
    studentId: string;
    studentName: string;
    admissionNumber: string;
    subjects: Record<string, { score: number; grade: string; name: string }>;
    total: number;
    average: number;
    rank: number;
}

export function AllSubjectsView({ gradeStreamId }: Props) {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<StudentRow[]>([]);
    const [subjectCodes, setSubjectCodes] = useState<string[]>([]);

    useEffect(() => {
        if (!gradeStreamId) return;
        const fetchAll = async () => {
            setLoading(true);

            try {
                // Fetch all marks for students in this stream, with exam + subject info
                const res = await fetch(`/api/school/exam-marks/stream?stream_id=${gradeStreamId}`);
                if (!res.ok) throw new Error('Failed to fetch marks');
                const { data: marks } = await res.json();

                if (!marks || marks.length === 0) {
                    setRows([]);
                    setSubjectCodes([]);
                    setLoading(false);
                    return;
                }

                const validMarks = marks.filter((m: any) => m.students && m.exams && m.exams.subjects);

                // Aggregate: for each student × subject, keep the latest (or best) score
                // Using a map: studentId → { name, admNo, subjects: { subjectCode → { score, grade, name } } }
                const studentMap: Record<string, {
                    name: string;
                    admNo: string;
                    subjects: Record<string, { score: number; grade: string; name: string }>;
                }> = {};
                const allSubjects = new Set<string>();

                validMarks.forEach((m: any) => {
                    const exam = m.exams;
                    const stu = m.students;
                    const subjCode = exam.subjects?.code || exam.subjects?.name || 'Unknown';
                    const subjName = exam.subjects?.name || subjCode;
                    const firstName = stu?.users?.first_name || '';
                    const lastName = stu?.users?.last_name || '';
                    const pct = Number(m.percentage);
                    const grade = m.grade_symbol || '-';

                    allSubjects.add(subjCode);

                    if (!studentMap[m.student_id]) {
                        studentMap[m.student_id] = {
                            name: `${firstName} ${lastName}`.trim() || 'Unknown',
                            admNo: stu?.admission_number || '',
                            subjects: {},
                        };
                    }

                    // If student already has a score for this subject, keep the latest (higher percentage wins)
                    const existing = studentMap[m.student_id].subjects[subjCode];
                    if (!existing || pct > existing.score) {
                        studentMap[m.student_id].subjects[subjCode] = { score: pct, grade, name: subjName };
                    }
                });

                const subjects = Array.from(allSubjects).sort();
                setSubjectCodes(subjects);

                // Build rows with total, average, and rank
                const rawRows = Object.entries(studentMap).map(([studentId, ObjectData]) => {
                    const data = ObjectData as any;
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
            } catch (err) {
                console.error(err);
                setRows([]);
                setSubjectCodes([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
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
                    Showing best score per subject for each student. {rows.length} students · {subjectCodes.length} subjects
                </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface-raised)' }}>
                            <th style={thStyle}>Rank</th>
                            <th style={thStyle}>Student</th>
                            <th style={thStyle}>Adm No</th>
                            {subjectCodes.map(s => (
                                <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 80 }} title={rows[0]?.subjects[s]?.name || s}>{s}</th>
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
                                <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{row.admissionNumber || '—'}</td>
                                {subjectCodes.map(s => {
                                    const val = row.subjects[s];
                                    return (
                                        <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                                            {val ? (
                                                <span title={`${val.name} - Grade: ${val.grade}`}>
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
