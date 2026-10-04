'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildSetupSteps, type SetupStatus } from '@/lib/dashboard';

/**
 * Setup progress for a new school.
 *
 * This replaces a toast notifier that fired on every dashboard mount. Its
 * "once" guard was a ref, so it reset each time the component remounted:
 * navigating away and back re-fired it, and a school that had finished setting
 * up was congratulated on every single visit — "Setup Complete! Your school
 * configuration is fully complete" — forever.
 *
 * Setup state is persistent, not an event, so it belongs on the page rather
 * than in a popup. When every step is done this renders nothing at all, which
 * is the celebration: the card simply stops being there.
 */

interface SetupChecklistProps {
    hasLogo: boolean;
    totalTeachers: number;
    totalStudents: number;
    totalUsers: number;
    /** Classes, subjects and teacher assignments; null until the school exists. */
    setup: SetupStatus | null;
    /** Dismissal is remembered per school, so switching schools starts fresh. */
    schoolId?: string | null;
}


const DISMISS_KEY = 'skulbase:setup-checklist-dismissed';

export function SetupChecklist({
    hasLogo,
    totalTeachers,
    totalStudents,
    totalUsers,
    setup,
    schoolId,
}: SetupChecklistProps) {
    const [dismissed, setDismissed] = useState(true); // assume hidden until storage is read
    const storageKey = `${DISMISS_KEY}:${schoolId ?? 'current'}`;

    // Read on the client only: localStorage is unavailable during SSR, and can
    // throw in a private window or with site data blocked.
    useEffect(() => {
        try {
            setDismissed(window.localStorage.getItem(storageKey) === '1');
        } catch {
            setDismissed(false);
        }
    }, [storageKey]);

    // In the order a school actually has to do them: each step is something
    // the next one depends on.
    const steps = buildSetupSteps({ hasLogo, totalTeachers, totalStudents, totalUsers, setup });

    const remaining = steps.filter(s => !s.done);
    if (dismissed || remaining.length === 0) return null;

    const doneCount = steps.length - remaining.length;

    const dismiss = () => {
        setDismissed(true);
        try {
            window.localStorage.setItem(storageKey, '1');
        } catch {
            /* dismissal just will not persist */
        }
    };

    return (
        <section
            aria-label="School setup"
            className="card mb-3 p-4 sm:p-5"
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="font-[family-name:var(--font-display)] text-sm font-bold text-foreground">
                        Finish setting up
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {doneCount} of {steps.length} done — the rest takes a few minutes.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss setup checklist"
                    className="-m-1 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                    <X size={16} />
                </button>
            </div>

            <ul className="space-y-1.5">
                {steps.map(step => (
                    <li
                        key={step.id}
                        className="flex flex-col gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3"
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                                step.done
                                    ? 'border-transparent bg-primary/15 text-primary'
                                    : 'border-border text-transparent',
                            )}
                        >
                            <Check size={13} strokeWidth={3} />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span
                                className={cn(
                                    'block text-sm font-medium',
                                    step.done
                                        ? 'text-muted-foreground line-through'
                                        : 'text-foreground',
                                )}
                            >
                                {step.label}
                            </span>
                            {!step.done && (
                                <span className="block text-xs text-muted-foreground">
                                    {step.hint}
                                </span>
                            )}
                        </span>

                        {!step.done && (
                            <Link
                                href={step.href}
                                className="btn-secondary shrink-0 self-start text-xs sm:self-auto"
                            >
                                {step.cta}
                            </Link>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
