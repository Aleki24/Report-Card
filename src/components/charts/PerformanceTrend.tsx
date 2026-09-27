"use client";

import { useId } from 'react';
import {
    Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
    type TooltipContentProps,
} from 'recharts';
import { PASS_MARK } from '@/lib/pass-mark';

export interface TrendPoint {
    /** Axis label, e.g. "Term 2 2026". */
    examName: string;
    /** Percentage, 0–100. */
    average: number;
}

interface Props {
    data: TrendPoint[];
    /** Drawn as a dashed line; the school's own pass mark. */
    passMark?: number;
    /** Plot height in pixels. */
    height?: number;
}

function TrendTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
    const value = payload?.[0]?.value;
    if (!active || value == null) return null;
    return (
        <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 shadow-lg">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="font-display text-xl font-extrabold text-foreground tabular-nums">{value}%</p>
        </div>
    );
}

/**
 * A learner's average over time, with the pass mark marked.
 *
 * It used to wrap itself in a card titled "Overall Performance Trend · Class
 * average score across exams" (wrong on a learner's page), and its plot had
 * no height, so the chart never drew at all.
 */
export function PerformanceTrendChart({ data, passMark = PASS_MARK, height = 240 }: Props) {
    const gradientId = useId();
    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="examName" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} dy={8} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} width={44} />
                    <Tooltip content={TrendTooltip} cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }} />
                    <ReferenceLine
                        y={passMark}
                        stroke="var(--color-danger)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                        label={{ value: `Pass ${passMark}%`, position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 10 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="average"
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                        fill={`url(#${gradientId})`}
                        dot={{ r: 4, fill: 'var(--card)', stroke: 'var(--primary)', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
