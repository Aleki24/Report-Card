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
    Cell,
    LabelList
} from 'recharts';

interface GradeData {
    grade: string;
    count: number;
}

interface Props {
    data: GradeData[];
}

const COLORS: Record<string, string> = {
    'A+': '#059669',
    'A':  '#10B981',
    'A-': '#34D399',
    'B+': '#2563EB',
    'B':  '#3B82F6',
    'B-': '#60A5FA',
    'C+': '#D97706',
    'C':  '#FBBF24',
    'C-': '#FCD34D',
    'D+': '#EA580C',
    'D':  '#F59E0B',
    'D-': '#FB923C',
    'E':  '#DC2626',
    'F':  '#EF4444',
};

const DEFAULT_COLOR = '#94A3B8';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const count = payload[0].value;
    const grade = label;
    const color = COLORS[grade] || DEFAULT_COLOR;
    return (
        <div style={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: '14px 18px',
            minWidth: 160,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                    width: 12, height: 12, borderRadius: 4,
                    background: color, display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Grade {grade}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{count}</span>
                <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>student{count !== 1 ? 's' : ''}</span>
            </div>
        </div>
    );
};

export function GradeDistributionChart({ data }: Props) {
    const total = data.reduce((sum, d) => sum + d.count, 0);

    return (
        <div className="card w-full" style={{
            height: 440,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 8px',
            }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Grade Distribution
                </h3>
                {total > 0 && (
                    <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#64748B',
                        background: 'rgba(100,116,139,0.1)',
                        borderRadius: 8,
                        padding: '4px 10px',
                    }}>
                        {total} student{total !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
            <div style={{ flex: 1, minHeight: 0, width: '100%', padding: '0 8px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
                        <defs>
                            {data.map((entry) => {
                                const c = COLORS[entry.grade] || DEFAULT_COLOR;
                                return (
                                    <linearGradient key={entry.grade} id={`bar-grad-${entry.grade}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                                        <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                                    </linearGradient>
                                );
                            })}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" strokeOpacity={0.5} />
                        <XAxis
                            dataKey="grade"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }}
                            dy={8}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
                            allowDecimals={false}
                            dx={-6}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                        <Bar
                            dataKey="count"
                            radius={[6, 6, 0, 0]}
                            animationBegin={0}
                            animationDuration={800}
                            animationEasing="ease-out"
                        >
                            {data.map((entry) => (
                                <Cell key={entry.grade} fill={`url(#bar-grad-${entry.grade})`} />
                            ))}
                            <LabelList
                                dataKey="count"
                                position="top"
                                style={{
                                    fill: '#94A3B8',
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                                offset={4}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
