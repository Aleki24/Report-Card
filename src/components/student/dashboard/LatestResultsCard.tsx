import React from 'react';
import { GraduationCap } from 'lucide-react';
import type { StudentResultItem } from '@/types';
import { getExamTypeName } from '@/lib/exam-types';
import { Panel, QuietEmpty, scoreTone } from './shared';

/**
 * The learner's most recent released marks, one row per subject — the thing
 * a learner opens the app to see.
 */
export default function LatestResultsCard({ results, className }: { results: StudentResultItem[]; className?: string }) {
    // Name the exam only when every row is from the same one; otherwise the
    // rows are simply the most recent marks across exams.
    const exam = results[0]?.exams;
    const sameExam = !!exam && results.every(r => r.exams.exam_type === exam.exam_type && r.exams.terms?.id === exam.terms?.id);
    const subtitle = exam && sameExam
        ? [getExamTypeName(exam.exam_type), exam.terms?.name].filter(Boolean).join(' · ')
        : results.length > 0 ? 'Your most recent released marks' : undefined;

    return (
        <Panel title="Latest results" subtitle={subtitle} action={{ label: 'All results', href: '/student/results' }} className={className}>
            {results.length === 0 ? (
                <QuietEmpty icon={<GraduationCap size={18} />}>Your results will appear here once your teachers release them.</QuietEmpty>
            ) : (
                <ul className="flex flex-col gap-3">
                    {results.map(r => {
                        const pct = Math.round(Number(r.percentage) || 0);
                        const tone = scoreTone(pct);
                        return (
                            <li key={r.id} className="flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-foreground">{r.exams.subjects?.name ?? r.exams.name}</span>
                                        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{pct}%</span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: tone }} />
                                    </div>
                                </div>
                                {r.grade_symbol && (
                                    <span
                                        className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-bold"
                                        style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
                                    >
                                        {r.grade_symbol}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
