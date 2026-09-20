import React from 'react';
import Link from 'next/link';
import { shortCurriculumLabel } from '@/lib/curriculum-labels';

export interface ClassPerformance {
    id: string;
    name: string;
    levelCode: string | null;
    students: number;
    markCount: number;
    mean: number | null;
    passRate: number | null;
}

interface ClassPerformanceListProps {
    /** Expected weakest-first; the API sorts it. */
    classes: ClassPerformance[];
    passMark: number;
    /** Rows before the "more in Analytics" line. */
    limit?: number;
}

/**
 * Pass rate per class, weakest first.
 *
 * Nothing on the dashboard compared classes with each other, so a class in
 * trouble looked exactly like one doing well. On this instance Form 4 sits at
 * 21% and Grade 4 at 82%, and an admin had no way to see that without opening
 * Analytics and filtering by hand.
 *
 * Pass rate rather than the mean, for the same reason the academic card leads
 * with it — and because a share of learners reaching a percentage threshold is
 * the one figure that survives being read across curricula, where a letter
 * grade does not. The curriculum is still labelled on each row: comparing a CBC
 * Grade 4 with an 8-4-4 Form 4 is a judgement for the reader to make knowingly,
 * not one to hide behind a single ranked list.
 */
export default function ClassPerformanceList({
    classes,
    passMark,
    limit = 6,
}: ClassPerformanceListProps) {
    const withMarks = classes.filter(c => c.markCount > 0);

    if (withMarks.length === 0) {
        return (
            <div className="py-6 text-center text-sm italic text-muted-foreground">
                No marks recorded yet
            </div>
        );
    }

    const shown = withMarks.slice(0, limit);
    const hidden = withMarks.length - shown.length;

    return (
        <div className="-mx-1 space-y-0.5">
            {shown.map(c => {
                const rate = c.passRate ?? 0;
                // Red only where it is earned: under 40% of a class reaching the
                // pass mark is a real problem, not an ordinary term.
                const tone =
                    rate >= 70 ? 'var(--viz-good)' : rate >= 40 ? 'var(--viz-warn)' : 'var(--viz-bad)';
                const chip = shortCurriculumLabel(c.levelCode);

                return (
                    <Link
                        key={c.id}
                        href="/dashboard/analytics"
                        className="group flex items-center gap-2.5 rounded-xl px-2 py-2 no-underline transition-colors hover:bg-muted/60"
                        aria-label={`${c.name}: ${rate}% of marks at or above ${passMark}%`}
                    >
                        <span className="w-20 shrink-0 truncate text-xs font-medium text-foreground sm:w-24">
                            {c.name}
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
                                style={{ width: `${Math.min(rate, 100)}%`, background: tone }}
                            />
                        </span>
                        <span
                            className="w-9 shrink-0 text-right text-[13px] font-bold tabular-nums"
                            style={{ color: tone }}
                        >
                            {rate}%
                        </span>
                    </Link>
                );
            })}

            <p className="px-2 pt-2 text-[11px] leading-snug text-muted-foreground">
                Share of marks at or above {passMark}%.
                {hidden > 0 && ` ${hidden} more ${hidden === 1 ? 'class' : 'classes'} in Analytics.`}
            </p>
        </div>
    );
}
