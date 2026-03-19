"use client";

import React, { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

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
    onRefresh: () => void;
}

const GRADE_COLORS: Record<string, string> = {
    'A+': '#10B981', 'A': '#34D399', 'B+': '#3B82F6', 'B': '#60A5FA',
    'C+': '#FBBF24', 'C': '#F59E0B', 'D+': '#F97316', 'D': '#FB923C',
    'E': '#EF4444', 'F': '#EF4444',
};

type SortKey = 'student_name' | 'raw_score' | 'percentage' | 'grade_symbol';

export function ExamResultsTable({ marks, maxScore, examId, onRefresh }: Props) {
    const supabase = createSupabaseBrowserClient();
    const [sortKey, setSortKey] = useState<SortKey>('student_name');
    const [sortAsc, setSortAsc] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);

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
        else if (sortKey === 'raw_score') cmp = a.raw_score - b.raw_score;
        else if (sortKey === 'percentage') cmp = a.percentage - b.percentage;
        else if (sortKey === 'grade_symbol') cmp = a.grade_symbol.localeCompare(b.grade_symbol);
        return sortAsc ? cmp : -cmp;
    });

    const startEdit = (mark: MarkRow) => {
        setEditingId(mark.id);
        setEditValue(String(mark.raw_score));
    };

    const saveEdit = async (markId: string) => {
        const newScore = Number(editValue);
        if (isNaN(newScore) || newScore < 0 || newScore > maxScore) {
            setEditingId(null);
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from('exam_marks')
            .update({ raw_score: newScore })
            .eq('id', markId);

        setSaving(false);
        setEditingId(null);

        if (!error) {
            onRefresh();
        }
    };

    const exportCSV = () => {
        const header = 'Student Name,Admission No,Raw Score,Percentage,Grade';
        const rows = sorted.map(m =>
            `"${m.student_name}","${m.admission_number}",${m.raw_score},${m.percentage.toFixed(1)},${m.grade_symbol}`
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
                    {marks.length} student{marks.length !== 1 ? 's' : ''} · Click a score to edit
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
                                <th style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('raw_score')}>
                                    Score <SortIcon active={sortKey === 'raw_score'} asc={sortAsc} />
                                </th>
                                <th style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('percentage')}>
                                    % <SortIcon active={sortKey === 'percentage'} asc={sortAsc} />
                                </th>
                                <th style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('grade_symbol')}>
                                    Grade <SortIcon active={sortKey === 'grade_symbol'} asc={sortAsc} />
                                </th>
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
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        {editingId === mark.id ? (
                                            <input
                                                type="number"
                                                className="input-field"
                                                style={{ width: 72, textAlign: 'center', padding: '4px 8px', fontSize: 13 }}
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => saveEdit(mark.id)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(mark.id); if (e.key === 'Escape') setEditingId(null); }}
                                                autoFocus
                                                min={0}
                                                max={maxScore}
                                                disabled={saving}
                                            />
                                        ) : (
                                            <span
                                                style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: 'var(--radius-md)' }}
                                                onClick={() => startEdit(mark)}
                                                title="Click to edit"
                                            >
                                                {mark.raw_score} / {maxScore}
                                            </span>
                                        )}
                                    </td>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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
