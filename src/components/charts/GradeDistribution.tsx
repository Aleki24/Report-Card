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

// Colour map for common grades — falls back gracefully
const COLORS: Record<string, string> = {
    'A+': '#059669', // Emerald 600
    'A':  '#10B981', // Emerald 500
    'A-': '#34D399', // Emerald 400
    'B+': '#2563EB', // Blue 600
    'B':  '#3B82F6', // Blue 500
    'B-': '#60A5FA', // Blue 400
    'C+': '#D97706', // Amber 600
    'C':  '#FBBF24', // Amber 400
    'C-': '#FCD34D', // Amber 300
    'D+': '#EA580C', // Orange 600
    'D':  '#F59E0B', // Amber 500
    'D-': '#FB923C', // Orange 400
    'E':  '#DC2626', // Red 600
    'F':  '#EF4444', // Red 500
};

const DEFAULT_COLOR = '#94A3B8'; // Slate 400 fallback

export function GradeDistributionChart({ data }: Props) {
    // Use whatever grades are passed in — no hardcoded override.
    // They are already sorted by the parent component.
    return (
        <div className="card w-full" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 16, marginBottom: 'var(--space-6)', fontWeight: 600 }}>Grade Distribution</h3>
            <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[entry.grade] || DEFAULT_COLOR} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
