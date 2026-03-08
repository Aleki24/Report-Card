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

interface TrendData {
    examName: string;
    percentage: number;
}

interface Props {
    data: TrendData[];
    classAverage?: number; // Provides a reference frame
}

export function PerformanceTrendChart({ data, classAverage }: Props) {
    return (
        <div className="card w-full" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 16, marginBottom: 'var(--space-6)', fontWeight: 600 }}>Performance Trend</h3>
            <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
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

                        <Line
                            type="monotone"
                            dataKey="percentage"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                            name="Score (%)"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
