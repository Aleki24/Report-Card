"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { EditMarkModal, type EditMarkData } from './EditMarkModal';
import type { ExamSubjectComponentScheme } from '@/types';
import { isMultiPaper } from '@/lib/multi-paper';

export interface MarkRow {
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
    marks: MarkRow[];
    maxScore: number;
    examId: string;
    gradeStreamId?: string;
    /** Multi-paper scheme for this exam (null/undefined = single paper) */
    scheme?: ExamSubjectComponentScheme | null;
    onRefresh: () => void;
    /** Patch a single row in place after an edit, avoiding a full grid refetch. */
    onMarkPatched?: (patched: MarkRow) => void;
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

export function ExamResultsTable({ marks, maxScore, examId, gradeStreamId, scheme, onRefresh, onMarkPatched }: Props) {
    const multiPaper = isMultiPaper(scheme);
    const schemeComponents = multiPaper ? (scheme?.components || []) : [];
    // Default view: highest-performing student first (descending total marks).
    const [sortKey, setSortKey] = useState<SortKey>('percentage');
    const [sortAsc, setSortAsc] = useState(false);
    const [editingMark, setEditingMark] = useState<EditMarkData | null>(null);
    const [studentPoints, setStudentPoints] = useState<Record<string, number>>({});
    const [studentOverallGrades, setStudentOverallGrades] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchTotalPoints = async () => {
            if (!gradeStreamId) return;
            
            try {
                const [marksRes, structureRes] = await Promise.all([
                    // Pass the current exam so the stream marks are scoped to its
                    // term — otherwise total points accumulate across every term.
                    fetch(`/api/school/exam-marks/stream?stream_id=${gradeStreamId}${examId ? `&exam_id=${examId}` : ''}`),
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
    }, [gradeStreamId, examId]);

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

    // Rank always reflects standing by score (highest = 1), independent of
    // whichever column the table is currently sorted by. Ties share a rank
    // (standard competition ranking: 1, 2, 2, 4).
    const ranks = useMemo(() => {
        const byScore = [...marks].sort((a, b) => b.percentage - a.percentage);
        const rankMap: Record<string, number> = {};
        let rank = 0;
        let prevScore: number | null = null;
        byScore.forEach((m, idx) => {
            if (prevScore === null || m.percentage !== prevScore) {
                rank = idx + 1;
                prevScore = m.percentage;
            }
            rankMap[m.id] = rank;
        });
        return rankMap;
    }, [marks]);

    const openEdit = (mark: MarkRow) => {
        setEditingMark({
            id: mark.id,
            student_id: mark.student_id,
            student_name: mark.student_name,
            admission_number: mark.admission_number,
            raw_score: mark.raw_score,
            percentage: mark.percentage,
            grade_symbol: mark.grade_symbol,
            rubric: mark.rubric,
            remarks: mark.remarks,
            components: mark.components,
        });
    };

    // Compact per-paper breakdown shown under the final score
    const breakdownLabel = (mark: MarkRow): string => {
        if (!multiPaper || !mark.components) return '';
        return schemeComponents
            .map(c => `${c.component_code}: ${mark.components?.[c.id] ?? '—'}/${Number(c.max_score)}`)
            .join(' · ');
    };

    const [exportError, setExportError] = useState('');
    const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

    const exportResults = async (format: 'csv' | 'pdf') => {
        setExportError('');
        setExporting(format);
        try {
            const res = await fetch(`/api/school/exam-marks/export?exam_id=${examId}&format=${format}`);
            if (!res.ok) {
                let message = 'Failed to export results.';
                try { message = (await res.json()).error || message; } catch { /* non-JSON */ }
                setExportError(message);
                return;
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match?.[1] || `exam_results_${examId}.${format}`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            setExportError('Network error. Please try again.');
        } finally {
            setExporting(null);
        }
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
            <div className="flex justify-between items-center flex-wrap gap-2" style={{ marginBottom: 'var(--space-4)' }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {marks.length} student{marks.length !== 1 ? 's' : ''} · Click ✏️ to edit a result
                </p>
                <div className="flex items-center gap-2">
                    <button
                        className="btn-secondary disabled:opacity-50"
                        style={{ fontSize: 13, padding: 'var(--space-2) var(--space-4)' }}
                        onClick={() => exportResults('csv')}
                        disabled={exporting !== null}
                    >
                        {exporting === 'csv' ? '⏳ Exporting…' : '📥 Export CSV'}
                    </button>
                    <button
                        className="btn-secondary disabled:opacity-50"
                        style={{ fontSize: 13, padding: 'var(--space-2) var(--space-4)' }}
                        onClick={() => exportResults('pdf')}
                        disabled={exporting !== null}
                    >
                        {exporting === 'pdf' ? '⏳ Exporting…' : '📄 Export PDF'}
                    </button>
                </div>
            </div>
            {exportError && (
                <div className="mb-4 p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{exportError}</div>
            )}

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Position</th>
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
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: 'var(--color-accent)' }}>{ranks[mark.id] ?? i + 1}</td>
                                    <td style={tdStyle}>{mark.student_name}</td>
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{mark.admission_number}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>
                                        {Math.round(mark.percentage)}%
                                        {multiPaper && mark.components && (
                                            <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                {breakdownLabel(mark)}
                                            </span>
                                        )}
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
                                            className="cursor-pointer hover:bg-muted transition-colors"
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
                    scheme={scheme}
                    onClose={() => setEditingMark(null)}
                    onSaved={(patched) => {
                        setEditingMark(null);
                        // Patch the single row in place when possible; fall back to
                        // a full refetch only if the parent didn't wire the handler.
                        if (patched && onMarkPatched) onMarkPatched(patched);
                        else onRefresh();
                    }}
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
