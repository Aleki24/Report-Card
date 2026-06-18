"use client";

import React from 'react';

interface SubjectStat {
    name: string;
    mean: number;
    passRate: number;
    highest: number;
    lowest: number;
    studentCount: number;
}

interface Props {
    strongSubjects: SubjectStat[];
    atRiskSubjects: SubjectStat[];
    allSubjects: SubjectStat[];
    classAverage: number;
    improvement?: number;
}

function InsightCard({
    icon,
    title,
    children,
    accent,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    accent: string;
}) {
    return (
        <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: accent }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {title}
                </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--foreground)' }}>
                {children}
            </div>
        </div>
    );
}

export function InsightsPanel({ strongSubjects, atRiskSubjects, allSubjects, classAverage, improvement }: Props) {
    const subjectAvgs = allSubjects.map(s => s.mean);
    const avgOfAvgs = subjectAvgs.length > 0
        ? Math.round(subjectAvgs.reduce((a, b) => a + b, 0) / subjectAvgs.length)
        : 0;
    const variance = subjectAvgs.length > 1
        ? Math.round(subjectAvgs.reduce((sum, v) => sum + Math.pow(v - avgOfAvgs, 2), 0) / subjectAvgs.length)
        : 0;
    const stdDev = Math.round(Math.sqrt(variance));
    const isConsistent = stdDev <= 10;
    const hasGap = allSubjects.length >= 2 && (allSubjects[0].mean - allSubjects[allSubjects.length - 1].mean) >= 30;

    const interventions: string[] = [];
    if (atRiskSubjects.length > 0) {
        interventions.push(`Targeted support needed for ${atRiskSubjects.map(s => s.name).join(', ')}`);
    }
    if (hasGap) {
        interventions.push(`Large achievement gap between top and bottom subjects`);
    }
    if (classAverage < 50) {
        interventions.push('Overall performance below passing — review curriculum and teaching methods');
    } else if (classAverage < 65) {
        interventions.push('Additional revision sessions may help improve overall scores');
    } else if (classAverage >= 80) {
        interventions.push('Consider enrichment programs and advanced materials for high achievers');
    }
    if (allSubjects.length > 0 && allSubjects.every(s => s.passRate >= 85)) {
        interventions.push('All subjects performing well — maintain current strategies');
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InsightCard
                icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                }
                title="Strengths"
                accent="var(--color-success)"
            >
                {strongSubjects.length > 0 ? (
                    <span>
                        <strong style={{ color: 'var(--color-success)' }}>{strongSubjects.length} subject{strongSubjects.length > 1 ? 's' : ''}</strong> performing strongly
                        — {strongSubjects.map(s => `${s.name} (${s.mean}%)`).join(', ')}.
                        Pass rate at {Math.round(strongSubjects.reduce((a, s) => a + s.passRate, 0) / strongSubjects.length)}%.
                    </span>
                ) : (
                    <span style={{ color: 'var(--muted-foreground)' }}>No subjects currently in the strong range (&ge;85% pass rate).</span>
                )}
            </InsightCard>

            <InsightCard
                icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                }
                title="Risks"
                accent="var(--color-danger)"
            >
                {atRiskSubjects.length > 0 ? (
                    <span>
                        <strong style={{ color: 'var(--color-danger)' }}>{atRiskSubjects.length} subject{atRiskSubjects.length > 1 ? 's' : ''}</strong> need attention
                        — {atRiskSubjects.map(s => `${s.name} (${s.mean}%)`).join(', ')}.
                        Below 70% pass rate threshold.
                    </span>
                ) : (
                    <span style={{ color: 'var(--muted-foreground)' }}>All subjects meet the pass rate threshold. Keep up the good work!</span>
                )}
            </InsightCard>

            <InsightCard
                icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
                    </svg>
                }
                title="Consistency"
                accent="var(--primary)"
            >
                {allSubjects.length > 1 ? (
                    <span>
                        Score variability is <strong style={{ color: isConsistent ? 'var(--color-success)' : 'var(--color-warning)' }}>
                            {isConsistent ? 'low' : 'moderate'}
                        </strong> (SD: &plusmn;{stdDev}%).
                        {isConsistent
                            ? ' Student performance is evenly balanced across subjects.'
                            : ` Gap between highest (${allSubjects[0].name}: ${allSubjects[0].mean}%) and lowest (${allSubjects[allSubjects.length - 1].name}: ${allSubjects[allSubjects.length - 1].mean}%) is ${allSubjects[0].mean - allSubjects[allSubjects.length - 1].mean} points.`
                        }
                    </span>
                ) : (
                    <span style={{ color: 'var(--muted-foreground)' }}>Not enough data to assess consistency.</span>
                )}
            </InsightCard>

            <InsightCard
                icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                }
                title="Intervention Tips"
                accent="var(--color-warning)"
            >
                {interventions.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {interventions.map((tip, i) => (
                            <li key={i} style={{ color: 'var(--foreground)' }}>{tip}</li>
                        ))}
                    </ul>
                ) : (
                    <span style={{ color: 'var(--muted-foreground)' }}>No specific interventions needed at this time.</span>
                )}
            </InsightCard>
        </div>
    );
}
