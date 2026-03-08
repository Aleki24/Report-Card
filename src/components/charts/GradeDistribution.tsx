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
        <div className="w-full h-[300px] p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Grade Distribution</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                        dataKey="grade"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B', fontWeight: 600 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B' }}
                        allowDecimals={false} // Since these are student counts, integer only
                        dx={-10}
                    />
                    <Tooltip
                        cursor={{ fill: '#F1F5F9' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {formattedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.grade] || '#94A3B8'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
