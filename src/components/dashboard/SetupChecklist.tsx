'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SetupStatus } from '@/lib/setup-status';

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

interface Step {
    id: string;
    done: boolean;
    label: string;
    hint: string;
    href: string;
    cta: string;
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

    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

    // In the order a school actually has to do them: each step is something
    // the next one depends on.
    const steps: Step[] = [
        {
            id: 'logo',
            done: hasLogo,
            label: 'Add your school logo',
            hint: 'It prints on every report card.',
            href: '/dashboard/settings',
            cta: 'Open settings',
        },
        ...(setup ? [
            {
                id: 'term',
                done: setup.hasCurrentTerm,
                label: 'Set the current term and its dates',
                hint: 'Exams, attendance and report cards are filed under a term.',
                href: '/dashboard/settings?tab=calendar',
                cta: 'Open calendar',
            },
            {
                id: 'classes',
                done: setup.classes > 0,
                label: 'Create your classes',
                hint: 'One class per grade, or several streams — learners and teachers belong to a class.',
                href: '/dashboard/classes',
                cta: 'Add classes',
            },
            {
                id: 'subjects',
                done: setup.subjectsOffered > 0,
                label: 'Choose the subjects you offer',
                hint: 'Exams and mark sheets are set per subject.',
                href: '/dashboard/subjects',
                cta: 'Choose subjects',
            },
        ] : []),
        {
            id: 'teachers',
            done: totalTeachers > 0,
            label: 'Add teachers',
            hint: 'They enter marks and take attendance.',
            href: '/dashboard/people?tab=teachers',
            cta: 'Add teachers',
        },
        ...(setup ? [
            {
                id: 'class-teachers',
                done: setup.classes > 0 && setup.classesWithoutClassTeacher === 0,
                label: 'Give every class a class teacher',
                hint: setup.classesWithoutClassTeacher > 0
                    ? `${plural(setup.classesWithoutClassTeacher, 'class')} without one. Class teachers write report-card remarks.`
                    : 'Class teachers write report-card remarks.',
                href: '/dashboard/users',
                cta: 'Assign',
            },
            {
                id: 'subject-teachers',
                done: setup.subjectTeacherAssignments > 0,
                label: 'Assign subject teachers',
                hint: 'Per stream, or for the whole grade — each teacher then sees only their own learners.',
                href: '/dashboard/subjects?tab=teachers',
                cta: 'Assign',
            },
        ] : []),
        {
            id: 'students',
            done: totalStudents > 0,
            label: 'Enrol students',
            hint: 'Classes, marks and fees all hang off this.',
            href: '/dashboard/people',
            cta: 'Add students',
        },
        ...(setup && setup.learnersWithoutClass > 0 ? [{
            id: 'unplaced',
            done: false,
            label: `Put ${plural(setup.learnersWithoutClass, 'learner')} in a class`,
            hint: 'Learners without a class get no mark sheets or report cards.',
            href: '/dashboard/people',
            cta: 'Fix',
        }] : []),
        {
            id: 'users',
            done: totalUsers > totalTeachers + 1,
            label: 'Add support staff',
            hint: 'Bursars and administrators, if you have them.',
            href: '/dashboard/users',
            cta: 'Add users',
        },
    ];

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
