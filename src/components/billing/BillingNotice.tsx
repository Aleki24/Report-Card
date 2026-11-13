"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Lock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { formatIsoDate } from '@/lib/dates';
import { formatKes } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { useSchoolBilling } from './useSchoolBilling';

const SUBSCRIPTION_HREF = '/dashboard/settings?tab=subscription';

/**
 * On every page: for whoever manages the school, a reminder while the term's
 * Skulbase invoice is unpaid; for everyone, a notice once the school is
 * read-only.
 */
export function BillingNotice() {
    const { role, preview, can } = useAuth();
    const staff = !!role && role !== 'STUDENT' && role !== 'PENDING' && !preview;
    const { load } = useSchoolBilling(staff);
    if (!staff || load.state !== 'ready') return null;
    const { state } = load.data;
    const manager = can('school.manage');

    if (state.kind === 'locked') {
        return (
            <Notice tone="bad" icon={Lock} href={manager ? SUBSCRIPTION_HREF : null}
                title="Read-only: the Skulbase subscription is unpaid"
                detail={manager ? `${formatKes(state.invoice.amount)} for ${state.invoice.label}` : 'Ask your administrator to pay it.'} />
        );
    }
    if (manager && (state.kind === 'due' || state.kind === 'overdue')) {
        return (
            <Notice tone={state.kind === 'overdue' ? 'bad' : 'warn'} icon={CalendarClock} href={SUBSCRIPTION_HREF}
                title={`${formatKes(state.invoice.amount)} due for ${state.invoice.label}`}
                detail={`Read-only from ${formatIsoDate(state.lockOn, { day: 'numeric', month: 'short' })} if unpaid`} />
        );
    }
    return null;
}

function Notice({ tone, icon: Icon, title, detail, href }: { tone: 'warn' | 'bad'; icon: typeof Lock; title: string; detail: string; href: string | null }) {
    const body = (
        <>
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone === 'bad' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400')} aria-hidden>
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
                <strong className="font-semibold">{title}</strong>
                <span className="block truncate text-muted-foreground">{detail}</span>
            </span>
            {href && <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">Pay<ArrowRight className="size-4" aria-hidden /></span>}
        </>
    );
    const box = cn('mb-6 flex items-center gap-3 rounded-2xl border p-3 shadow-sm sm:p-4', tone === 'bad' ? 'border-rose-500/30 bg-rose-500/[0.07]' : 'border-amber-500/30 bg-amber-500/[0.08]');
    return href ? <Link href={href} className={cn(box, 'transition-colors hover:border-primary/50')}>{body}</Link> : <div role="status" className={box}>{body}</div>;
}
