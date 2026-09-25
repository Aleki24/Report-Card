import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Colour for a percentage: strong / fine / borderline / needs work. */
export function scoreTone(pct: number): string {
    if (pct >= 70) return 'var(--viz-good)';
    if (pct >= 50) return 'var(--viz-info)';
    if (pct >= 40) return 'var(--viz-warn)';
    return 'var(--viz-bad)';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today to a date (0 = today, negative = past), ignoring the time of day. */
export function daysUntil(dateStr: string, now: Date): number {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - start.getTime()) / DAY_MS);
}

export function relativeDay(days: number): string {
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
}

export function timeAgo(dateStr: string, now: Date): string {
    const mins = Math.floor((now.getTime() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** The card every dashboard panel sits in: title, optional link, body. */
export function Panel({ title, subtitle, action, children, className }: {
    title: string;
    subtitle?: string;
    action?: { label: string; href: string };
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5', className)}>
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-display text-base font-bold tracking-tight text-foreground">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                {action && (
                    <Link href={action.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        {action.label} <ArrowRight size={13} aria-hidden />
                    </Link>
                )}
            </div>
            {children}
        </section>
    );
}

/** A quiet one-line empty state — big illustrated empties made the old page feel hollow. */
export function QuietEmpty({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            <span className="shrink-0 text-muted-foreground/70">{icon}</span>
            <span>{children}</span>
        </div>
    );
}

/** Circular score meter for the hero. */
export function ScoreRing({ value, size = 104 }: { value: number; size?: number }) {
    const stroke = 9;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value));
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% average`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="transition-[stroke-dashoffset] duration-700"
            />
            <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-white font-display text-[22px] font-bold">{Math.round(value)}%</text>
            <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" className="fill-white/75 text-[9px] font-semibold uppercase tracking-wider">average</text>
        </svg>
    );
}
