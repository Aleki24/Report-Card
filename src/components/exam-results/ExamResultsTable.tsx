"use client";

import React, { useState, useEffect } from 'react';
import { EditMarkModal, type EditMarkData } from './EditMarkModal';

export interface MarkRow {
    id: string;
    student_id: string;
    student_name: string;
    admission_number: string;
    raw_score: number;
    percentage: number;
    grade_symbol: string;
    remarks: string | null;
}

interface Props {
    marks: MarkRow[];
    maxScore: number;
    examId: string;
    gradeStreamId?: string;
    onRefresh: () => void;
}

const GRADE_COLORS: Record<string, string> = {
    'A+': '#10B981', 'A': '#34D399', 'A-': '#34D399', 'B+': '#3B82F6', 'B': '#60A5FA', 'B-': '#60A5FA',
    'C+': '#FBBF24', 'C': '#F59E0B', 'C-': '#F59E0B', 'D+': '#F97316', 'D': '#FB923C', 'D-': '#FB923C',
    'E': '#EF4444', 'F': '#EF4444',
};

const OVERALL_POINTS_GRADES = [
    { symbol: 'A', min: 81, max: 84 },
    { symbol: 'A-', min: 74, max: 80 },
    { symbol: 'B+', min: 67, max: 73 },
    { symbol: 'B', min: 60, max: 66 },
    { symbol: 'B-', min: 53, max: 59 },
    { symbol: 'C+', min: 46, max: 52 },
    { symbol: 'C', min: 39, max: 45 },
    { symbol: 'C-', min: 32, max: 38 },
    { symbol: 'D+', min: 25, max: 31 },
    { symbol: 'D', min: 18, max: 24 },
    { symbol: 'D-', min: 11, max: 17 },
    { symbol: 'E', min: 7, max: 10 },
];

type SortKey = 'student_name' | 'percentage' | 'grade_symbol';

export function ExamResultsTable({ marks, maxScore, examId, gradeStreamId, onRefresh }: Props) {
    const [sortKey, setSortKey] = useState<SortKey>('student_name');
    const [sortAsc, setSortAsc] = useState(true);
    const [editingMark, setEditingMark] = useState<EditMarkData | null>(null);
    const [studentPoints, setStudentPoints] = useState<Record<string, number>>({});
    const [studentOverallGrades, setStudentOverallGrades] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchTotalPoints = async () => {
            if (!gradeStreamId) return;
            
            try {
                const [marksRes, structureRes] = await Promise.all([
                    fetch(`/api/school/exam-marks/stream?stream_id=${gradeStreamId}`),
                    fetch('/api/admin/academic-structure')
                ]);

                const marksData = await marksRes.json();
                const structureData = await structureRes.json();

                const allMarks = marksData.data || [];
                const gradingSystems = structureData.grading_systems || [];
                const gradingScales = structureData.grading_scales || [];

                const scalesMap: Record<string, { points: number; systemId: string }> = {};
                gradingScales.forEach((sc: any) => {
                    scalesMap[sc.symbol] = { 
                        points: sc.points ?? 0, 
                        systemId: sc.grading_system_id 
                    };
                });

                const studentTotalPoints: Record<string, number> = {};
                const overallGrades: Record<string, string> = {};
                
                allMarks.forEach((m: any) => {
                    const studentId = m.student_id;
                    if (!studentTotalPoints[studentId]) {
                        studentTotalPoints[studentId] = 0;
                    }
                    
                    const gradeSymbol = m.grade_symbol;
                    if (gradeSymbol && scalesMap[gradeSymbol]) {
                        studentTotalPoints[studentId] += scalesMap[gradeSymbol].points || 0;
                    }
                });

                Object.entries(studentTotalPoints).forEach(([studentId, totalPoints]) => {
                    const overall = OVERALL_POINTS_GRADES.find(g => totalPoints >= g.min && totalPoints <= g.max);
                    overallGrades[studentId] = overall?.symbol || '—';
                });

                setStudentPoints(studentTotalPoints);
                setStudentOverallGrades(overallGrades);
            } catch (err) {
                console.error('Failed to fetch total points:', err);
            }
        };

        fetchTotalPoints();
    }, [gradeStreamId]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(key === 'student_name');
        }
    };

    const sorted = [...marks].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'student_name') cmp = a.student_name.localeCompare(b.student_name);
        else if (sortKey === 'percentage') cmp = a.percentage - b.percentage;
        else if (sortKey === 'grade_symbol') cmp = a.grade_symbol.localeCompare(b.grade_symbol);
        return sortAsc ? cmp : -cmp;
    });

    const openEdit = (mark: MarkRow) => {
        setEditingMark({
            id: mark.id,
            student_id: mark.student_id,
            student_name: mark.student_name,
            admission_number: mark.admission_number,
            raw_score: mark.raw_score,
            percentage: mark.percentage,
            grade_symbol: mark.grade_symbol,
            remarks: mark.remarks,
        });
    };

    const exportCSV = () => {
        const header = 'Student Name,Admission No,Score (%),Grade,Remarks';
        const rows = sorted.map(m =>
            `"${m.student_name}","${m.admission_number}",${m.percentage.toFixed(1)}%,${m.grade_symbol},"${(m.remarks || '').replace(/"/g, '""')}"`
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `exam_results_${examId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const gradeColor = (grade: string) => {
        const base = grade.replace(/[+-]/g, '');
        return GRADE_COLORS[grade] || GRADE_COLORS[base] || 'var(--color-text-muted)';
    };

    const SortIcon = ({ active, asc }: { active: boolean; asc: boolean }) => (
        <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 12 }}>
            {active ? (asc ? '▲' : '▼') : '⇅'}
        </span>
    );

    if (marks.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    No marks found for this exam. Use the &quot;Quick Entry&quot; tab above to add marks.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Toolbar */}
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-4)' }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {marks.length} student{marks.length !== 1 ? 's' : ''} · Click ✏️ to edit a result
                </p>
                <button
                    className="btn-secondary"
                    style={{ fontSize: 13, padding: 'var(--space-2) var(--space-4)' }}
                    onClick={exportCSV}
                >
                    📥 Export CSV
                </button>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={thStyle}>#</th>
                                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('student_name')}>
                                    Student <SortIcon active={sortKey === 'student_name'} asc={sortAsc} />
                                </th>
                                <th style={thStyle}>Adm No</th>
                                <th style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('percentage')}>
                                    Score <SortIcon active={sortKey === 'percentage'} asc={sortAsc} />
                                </th>
                                <th style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('grade_symbol')}>
                                    Grade <SortIcon active={sortKey === 'grade_symbol'} asc={sortAsc} />
                                </th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Total Pts</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Overall</th>
                                <th style={thStyle}>Remarks</th>
                                <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Edit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((mark, i) => (
                                <tr
                                    key={mark.id}
                                    style={{
                                        borderBottom: '1px solid var(--color-border)',
                                        background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-raised)',
                                    }}
                                >
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{i + 1}</td>
                                    <td style={tdStyle}>{mark.student_name}</td>
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{mark.admission_number}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                                        {mark.percentage.toFixed(1)}%
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '2px 10px',
                                            borderRadius: 'var(--radius-full)',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            background: `${gradeColor(mark.grade_symbol)}20`,
                                            color: gradeColor(mark.grade_symbol),
                                            border: `1px solid ${gradeColor(mark.grade_symbol)}40`,
                                        }}>
                                            {mark.grade_symbol}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: 'var(--color-accent)' }}>
                                        {studentPoints[mark.student_id] ?? '—'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '2px 10px',
                                            borderRadius: 'var(--radius-full)',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            background: `${gradeColor(studentOverallGrades[mark.student_id] || '')}20`,
                                            color: gradeColor(studentOverallGrades[mark.student_id] || ''),
                                            border: `1px solid ${gradeColor(studentOverallGrades[mark.student_id] || '')}40`,
                                        }}>
                                            {studentOverallGrades[mark.student_id] ?? '—'}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {mark.remarks || '—'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button
                                            onClick={() => openEdit(mark)}
                                            className="cursor-pointer hover:bg-[var(--color-surface-raised)] transition-colors"
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: 14,
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--color-accent)',
                                            }}
                                            title={`Edit ${mark.student_name}'s result`}
                                        >
                                            ✏️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {editingMark && (
                <EditMarkModal
                    mark={editingMark}
                    maxScore={maxScore}
                    examId={examId}
                    onClose={() => setEditingMark(null)}
                    onSaved={() => { setEditingMark(null); onRefresh(); }}
                    onDeleted={() => { setEditingMark(null); onRefresh(); }}
                />
            )}
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
