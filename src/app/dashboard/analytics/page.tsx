"use client";

import React, { useState } from 'react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { GradeDistributionChart } from '@/components/charts/GradeDistribution';

const mockTrend = [
    { examName: 'Mid-Term 1', percentage: 68 },
    { examName: 'End-Term 1', percentage: 72 },
    { examName: 'Mid-Term 2', percentage: 75 },
    { examName: 'End-Term 2', percentage: 71 },
    { examName: 'Annual', percentage: 78 },
];

const mockGrades = [
    { grade: 'A+', count: 12 }, { grade: 'A', count: 28 },
    { grade: 'B', count: 45 }, { grade: 'C', count: 31 },
    { grade: 'D', count: 18 }, { grade: 'F', count: 8 },
];

const subjectStats = [
    { name: 'Mathematics', mean: 68.4, median: 70, highest: 98, lowest: 22, passRate: 82 },
    { name: 'English', mean: 74.2, median: 76, highest: 96, lowest: 34, passRate: 90 },
    { name: 'Physics', mean: 62.8, median: 64, highest: 95, lowest: 18, passRate: 74 },
    { name: 'Chemistry', mean: 66.1, median: 68, highest: 92, lowest: 25, passRate: 78 },
    { name: 'Biology', mean: 71.5, median: 73, highest: 97, lowest: 30, passRate: 86 },
    { name: 'History', mean: 76.3, median: 78, highest: 99, lowest: 42, passRate: 92 },
];

export default function AnalyticsPage() {
    const [selectedClass, setSelectedClass] = useState('all');

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-[var(--space-8)]">
                <div>
                    <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>Analytics</h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        Subject performance, grade distribution, and trend analysis
                    </p>
                </div>
                <select className="input-field w-full md:w-[200px]" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="all">All Classes</option>
                    <option value="10a">Grade 10A</option>
                    <option value="10b">Grade 10B</option>
                    <option value="9a">Grade 9A</option>
                </select>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-6)] mb-[var(--space-8)]">
                <PerformanceTrendChart data={mockTrend} classAverage={72.4} />
                <GradeDistributionChart data={mockGrades} />
            </div>

            {/* Subject Performance Table */}
            <div className="card">
                <h3 style={{ fontSize: 16, marginBottom: 'var(--space-4)' }}>Subject Performance Summary</h3>
                <div className="overflow-x-auto">
                    <table className="data-table w-full min-w-[600px]">
                        <thead>
                            <tr>
                                <th>Subject</th><th>Mean</th><th>Median</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjectStats.map((s, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                                    <td>{s.mean}%</td>
                                    <td>{s.median}%</td>
                                    <td style={{ color: 'var(--color-success)' }}>{s.highest}%</td>
                                    <td style={{ color: 'var(--color-danger)' }}>{s.lowest}%</td>
                                    <td>{s.passRate}%</td>
                                    <td>
                                        <span className={`badge ${s.passRate >= 85 ? 'badge-success' : s.passRate >= 70 ? 'badge-warning' : 'badge-danger'}`}>
                                            {s.passRate >= 85 ? 'Strong' : s.passRate >= 70 ? 'Average' : 'At Risk'}
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
