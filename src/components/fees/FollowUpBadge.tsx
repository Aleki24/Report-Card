import React from 'react';
import { formatIsoDate } from '@/lib/dates';
import { formatKsh } from '@/lib/fee-account';
import { PROMISE_COPY, type PromiseProgress } from '@/lib/fee-followups';
import { TONES } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

const shortDay = (day: string) => formatIsoDate(day, { day: 'numeric', month: 'short' });

/** A promise to pay in a few words: "Promised KSh 5,000 by 14 Nov", kept or broken, and what came in towards it. */
export function PromiseBadge({ promise, className }: { promise: PromiseProgress; className?: string }) {
    const copy = PROMISE_COPY[promise.state];
    const part = promise.state !== 'KEPT' && promise.paidByDue > 0 ? ` · ${formatKsh(promise.paidByDue)} in` : '';
    return (
        <span className={cn('inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONES[copy.hue].tile, className)}>
            <span className="truncate">{copy.label}: {formatKsh(promise.amount)} by {shortDay(promise.dueDate)}{part}</span>
        </span>
    );
}
