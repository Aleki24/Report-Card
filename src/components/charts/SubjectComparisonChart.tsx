"use client";

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList
} from 'recharts';

interface SubjectBar {
    name: string;
    mean: number;
    passRate: number;
}

interface Props {
    data: SubjectBar[];
}

function getStatusColor(mean: number): string {
    if (mean >= 70) return 'var(--viz-good)';
    if (mean >= 50) return 'var(--viz-warn)';
    return 'var(--viz-bad)';
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0].payload;
    return (
        <div style={{
            background: 'var(--popover)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            padding: '10px 14px',
            minWidth: 140,
        }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>{label}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>Mean: <strong style={{ color: 'var(--foreground)' }}>{entry.mean}%</strong></span>
                <span style={{ color: 'var(--muted-foreground)' }}>Pass Rate: <strong style={{ color: 'var(--foreground)' }}>{entry.passRate}%</strong></span>
            </div>
        </div>
    );
};

export function SubjectComparisonChart({ data }: Props) {
    if (data.length === 0) {
        return (
            <div style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '40px 22px',
                textAlign: 'center',
                color: 'var(--muted-foreground)',
                fontSize: 13,
            }}>
                No subject data available
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            <div style={{ padding: '18px 22px 4px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    Subject Performance
                </h3>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                    Ranked by mean score
                </p>
            </div>
            <div style={{ width: '100%', padding: '4px 8px 8px' }} className="chart-inner">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 4, right: 50, left: 0, bottom: 4 }}
                        barSize={28}
                        barCategoryGap={8}
                    >
                        <XAxis
                            type="number"
                            domain={[0, 100]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
                            tickFormatter={(v: number) => `${v}%`}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--foreground)', fontSize: 12, fontWeight: 600 }}
                            width={100}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'color-mix(in oklch, var(--foreground) 3%, transparent)' }} />
                        <Bar
                            dataKey="mean"
                            radius={[0, 6, 6, 0]}
                            animationDuration={600}
                            animationEasing="ease-out"
                        >
                            {data.map((entry) => (
                                <Cell key={entry.name} fill={getStatusColor(entry.mean)} fillOpacity={0.85} />
                            ))}
                            <LabelList
                                dataKey="mean"
                                position="right"
                                formatter={(v: any) => `${v}%`}
                                style={{
                                    fill: 'var(--muted-foreground)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                }}
                                offset={6}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
