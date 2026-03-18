"use client";

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface GradeData {
    grade: string;
    count: number;
}

interface Props {
    data: GradeData[];
}

const COLORS: Record<string, string> = {
    'A+': '#10B981', // Emerald 500
    'A': '#34D399',  // Emerald 400
    'B': '#3B82F6',  // Blue 500
    'C': '#FBBF24',  // Amber 400
    'D': '#F59E0B',  // Amber 500
    'F': '#EF4444',  // Red 500
};

export function GradeDistributionChart({ data }: Props) {
    // Ensure the chart always lists A+ to F in order even if counts are 0
    const orderedGrades = ['A+', 'A', 'B', 'C', 'D', 'F'];
    const formattedData = orderedGrades.map(g => {
        const existing = data.find(item => item.grade === g);
        return {
            grade: g,
            count: existing ? existing.count : 0
        };
    });

    return (
        <div className="card w-full" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 16, marginBottom: 'var(--space-6)', fontWeight: 600 }}>Grade Distribution</h3>
            <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={formattedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                            dataKey="grade"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-text-muted)', fontWeight: 600 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-text-muted)' }}
                            allowDecimals={false}
                            dx={-10}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--color-border-subtle)' }}
                            contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {formattedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[entry.grade] || 'var(--color-text-muted)'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
