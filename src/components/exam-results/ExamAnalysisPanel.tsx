"use client";

import React from 'react';
import { GradeDistributionChart } from '@/components/charts/GradeDistribution';
import type { MarkRow } from './ExamResultsTable';

interface Props {
    marks: MarkRow[];
}

function computeStats(marks: MarkRow[]) {
    if (marks.length === 0) {
        return { mean: 0, median: 0, highest: 0, lowest: 0, passRate: 0, count: 0, gradeDistribution: [] as { grade: string; count: number }[], ranked: [] as { name: string; admNo: string; pct: number; grade: string; rank: number }[] };
    }

    const percentages = marks.map(m => m.percentage).sort((a, b) => a - b);
    const n = percentages.length;

    const mean = percentages.reduce((s, v) => s + v, 0) / n;
    const median = n % 2 === 0
        ? (percentages[n / 2 - 1] + percentages[n / 2]) / 2
        : percentages[Math.floor(n / 2)];
    const highest = percentages[n - 1];
    const lowest = percentages[0];
    const passRate = (percentages.filter(p => p >= 50).length / n) * 100;

    // Grade distribution
    const gradeCounts: Record<string, number> = {};
    for (const m of marks) {
        const g = m.grade_symbol || 'F';
        gradeCounts[g] = (gradeCounts[g] || 0) + 1;
    }
    const gradeDistribution = Object.entries(gradeCounts).map(([grade, count]) => ({ grade, count }));

    // Rankings
    const sorted = [...marks].sort((a, b) => b.percentage - a.percentage);
    let rank = 0;
    let lastPct = -1;
    const ranked = sorted.map((m, i) => {
        if (m.percentage !== lastPct) {
            rank = i + 1;
            lastPct = m.percentage;
        }
        return { name: m.student_name, admNo: m.admission_number, pct: m.percentage, grade: m.grade_symbol, rank };
    });

    return { mean, median, highest, lowest, passRate, count: n, gradeDistribution, ranked };
}

export function ExamAnalysisPanel({ marks }: Props) {
    const stats = computeStats(marks);

    if (marks.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    No marks to analyze. Enter marks first in the Student Results tab.
                </p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)' }}>
                <StatCard label="Mean" value={`${stats.mean.toFixed(1)}%`} color="#3B82F6" />
                <StatCard label="Median" value={`${stats.median.toFixed(1)}%`} color="#8B5CF6" />
                <StatCard label="Highest" value={`${stats.highest.toFixed(1)}%`} color="#10B981" />
                <StatCard label="Lowest" value={`${stats.lowest.toFixed(1)}%`} color="#EF4444" />
                <StatCard label="Pass Rate" value={`${stats.passRate.toFixed(0)}%`} color="#F59E0B" />
                <StatCard label="Students" value={String(stats.count)} color="#6366F1" />
            </div>

            {/* Grade Distribution Chart */}
            <GradeDistributionChart data={stats.gradeDistribution} />

            {/* Ranked Students */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>Student Rankings</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <th style={thStyle}>Rank</th>
                                <th style={thStyle}>Student</th>
                                <th style={thStyle}>Adm No</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Percentage</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.ranked.map((s, i) => (
                                <tr
                                    key={s.admNo + i}
                                    style={{
                                        borderBottom: '1px solid var(--color-border)',
                                        background: i % 2 === 0 ? 'transparent' : 'var(--color-surface-raised)',
                                    }}
                                >
                                    <td style={{ ...tdStyle, fontWeight: 700, color: s.rank <= 3 ? '#F59E0B' : 'var(--color-text)' }}>
                                        {s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : `#${s.rank}`}
                                    </td>
                                    <td style={tdStyle}>{s.name}</td>
                                    <td style={{ ...tdStyle, color: 'var(--color-text-muted)' }}>{s.admNo}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{s.pct.toFixed(1)}%</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>{s.grade}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'var(--font-display)' }}>
                {value}
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
