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
        <div className="w-full h-[300px] p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Performance Trend</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                        dataKey="examName"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B' }}
                        dy={10}
                    />
                    <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B' }}
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
    );
}
