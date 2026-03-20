"use client";

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer
} from 'recharts';

// Each row has examName + one numeric key per subject
interface Props {
    data: Record<string, any>[];
    subjects?: string[];
    classAverage?: number;
}

// A palette of distinct colours for up to 12 subjects
const SUBJECT_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
    '#06B6D4', '#E11D48',
];

export function PerformanceTrendChart({ data, subjects = [], classAverage }: Props) {
    return (
        <div className="card w-full" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 16, marginBottom: 'var(--space-6)', fontWeight: 600 }}>Performance Trend</h3>
            <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                            dataKey="examName"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-text-muted)' }}
                            dy={10}
                        />
                        <YAxis
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-text-muted)' }}
                            dx={-10}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {/* Reference Line for Passing Grade */}
                        <ReferenceLine y={50} label="Passing (50%)" stroke="#EF4444" strokeDasharray="3 3" />

                        {/* Optional Reference Line for Class Average */}
                        {classAverage && (
                            <ReferenceLine y={classAverage} label={`Class Avg (${classAverage}%)`} stroke="#F59E0B" strokeDasharray="3 3" />
                        )}

                        {/* One line per subject */}
                        {subjects.map((subj, idx) => (
                            <Line
                                key={subj}
                                type="monotone"
                                dataKey={subj}
                                stroke={SUBJECT_COLORS[idx % SUBJECT_COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 3, strokeWidth: 2 }}
                                activeDot={{ r: 5 }}
                                name={subj}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
