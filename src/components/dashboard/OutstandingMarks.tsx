import React from 'react';
import { shortCurriculumLabel } from '@/lib/curriculum-labels';

export interface UnmarkedClass {
    label: string;
    levelCode: string | null;
    count: number;
}

interface OutstandingMarksProps {
    total: number;
    /** Expected largest-first; the API sorts it. */
    byClass: UnmarkedClass[];
    /** Rows before the "and N more" line. */
    limit?: number;
}

/**
 * Exams that have been sat but never marked, broken down by class.
 *
 * This is the largest single gap in the data on this instance — most exams ever
 * created have no marks against them — and nothing in the app surfaced it.
 *
 * The breakdown stops at the class. An exam carries `created_by_teacher_id`,
 * which would name the person to chase, but it is null on every outstanding
 * exam here, so a "by teacher" view would be one row reading "(no teacher set):
 * 581". The class is as far as attribution can honestly go, and it is enough to
 * act on: it says which register to go and ask about.
 */
export default function OutstandingMarks({ total, byClass, limit = 5 }: OutstandingMarksProps) {
    if (total === 0) {
        return (
            <div className="py-6 text-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">All caught up.</span>
                <br />
                Every exam that has been sat has marks against it.
            </div>
        );
    }

    const shown = byClass.slice(0, limit);
    const accounted = shown.reduce((sum, c) => sum + c.count, 0);
    const rest = total - accounted;
    // Bars are relative to the worst class, not to the total: the point is which
    // class is furthest behind, and against a 581 total every bar would vanish.
    const widest = shown[0]?.count ?? 0;

    return (
        <div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-3xl font-bold leading-none tracking-tight text-foreground sm:text-4xl">
                    {total.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">exams sat with no marks entered</span>
            </div>

            <div className="-mx-1 mt-4 space-y-0.5">
                {shown.map(c => {
                    const chip = shortCurriculumLabel(c.levelCode);
                    return (
                        <div
                            key={`${c.label}-${c.levelCode ?? ''}`}
                            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
                        >
                            <span className="w-20 shrink-0 truncate text-xs font-medium text-foreground sm:w-24">
                                {c.label}
                            </span>
                            {/* Fixed-width slot: without it a wider "8-4-4" chip
                                pushes its bar right and the bars stop lining up. */}
                            <span className="hidden w-12 shrink-0 text-center xs:block">
                                {chip && (
                                    <span className="inline-block rounded bg-muted/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none text-muted-foreground">
                                        {chip}
                                    </span>
                                )}
                            </span>
                            <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                                <span
                                    className="block h-full rounded-full"
                                    style={{
                                        width: widest > 0 ? `${Math.min((c.count / widest) * 100, 100)}%` : '0%',
                                        background: 'var(--viz-warn)',
                                    }}
                                />
                            </span>
                            <span className="w-9 shrink-0 text-right text-[13px] font-bold tabular-nums text-foreground">
                                {c.count}
                            </span>
                        </div>
                    );
                })}
            </div>

            {rest > 0 && (
                <p className="px-2 pt-2 text-[11px] text-muted-foreground">
                    and {rest.toLocaleString()} more across other classes
                </p>
            )}
        </div>
    );
}
