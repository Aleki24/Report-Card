"use client";

import React from 'react';
import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';

interface TrendPoint {
    examName: string;
    average: number;
}

interface Props {
    data: TrendPoint[];
    improvement?: number;
    classAverage?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    return (
        <div style={{
            background: 'var(--popover)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            padding: '10px 14px',
        }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)' }}>
                {val}%
            </p>
        </div>
    );
};

export function PerformanceTrendChart({ data, improvement, classAverage }: Props) {
    const hasData = data.length > 0;

    return (
        <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px 4px',
            }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                        Overall Performance Trend
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                        Class average score across exams
                    </p>
                </div>
                {improvement != null && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 13,
                        fontWeight: 700,
                        color: improvement >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        background: improvement >= 0 ? 'color-mix(in oklch, var(--color-success) 10%, transparent)' : 'color-mix(in oklch, var(--color-danger) 10%, transparent)',
                        borderRadius: 8,
                        padding: '5px 10px',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {improvement >= 0
                                ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>
                                : <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>
                            }
                        </svg>
                        {improvement >= 0 ? '+' : ''}{improvement}%
                    </div>
                )}
            </div>
            <div style={{ width: '100%', padding: '0 8px' }} className="chart-inner">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 12, right: 16, left: -4, bottom: 4 }}>
                        <defs>
                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis
                            dataKey="examName"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
                            dy={8}
                        />
                        <YAxis
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
                            tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border-subtle)', strokeDasharray: '3 3' }} />
                        <ReferenceLine y={50} stroke="var(--color-danger)" strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.4} />
                        <Area
                            type="monotone"
                            dataKey="average"
                            stroke="none"
                            fill="url(#trendGrad)"
                        />
                        <Line
                            type="monotone"
                            dataKey="average"
                            stroke="var(--primary)"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: 'var(--card)', stroke: 'var(--primary)', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
