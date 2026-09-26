"use client";

import PageHeader from '@/components/dashboard/PageHeader';
import React, { Suspense, useCallback, useEffect, useId, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarRange, LineChart } from 'lucide-react';
import ClassAnalytics from '@/components/analytics/ClassAnalytics';
import SchoolOverview from '@/components/analytics/SchoolOverview';
import { SelectField, type SelectOption } from '@/components/ui/FormField';
import { defaultTermFor, defaultYear, termsOfYear, useAnalyticsPeriods } from '@/components/analytics/useAnalyticsPeriods';

/**
 * Analytics, at two levels, because only one of them was ever coherent.
 *
 * This page used to pool every mark in the school — every grade, both
 * curricula, every term and every year — into one set of figures. It then
 * ranked Grade 1 learners against Form 4 candidates, averaged a Lower Primary
 * "Mathematics" with a Senior School one, and listed "Religious Education"
 * four times because the school offers it in four curriculum bands. It also
 * computed all of it from 1,000 of 1,819 marks, because the route had no row
 * limit and PostgREST caps silently.
 *
 * The split is the fix. The school level compares classes, which is the one
 * comparison that survives being read across curricula. Everything else —
 * subjects, merit list, trends — lives inside a class, where there is one
 * grade, one curriculum and one set of scales, so the comparisons mean
 * something.
 *
 * The period (year and term) is chosen here, above both levels, and is always
 * on screen: it used to live inside the class view's results, so a term with
 * no marks yet showed an empty state with no way back to the previous term.
 *
 * Class, year and term live in the URL. Opening a class is a navigation, so
 * the browser's Back button returns to the class list rather than leaving
 * Analytics, and a class's page can be bookmarked or shared.
 */

interface GradeStreamOption {
    id: string;
    full_name: string;
}

const ALL_CLASSES = 'all';
const WHOLE_YEAR = '';
/** `?term=year`: the overview's whole-year view. */
const WHOLE_YEAR_PARAM = 'year';

export default function AnalyticsPage() {
    return (
        <Suspense fallback={<div className="mx-auto h-64 w-full max-w-7xl animate-pulse rounded-2xl bg-muted/40" aria-hidden="true" />}>
            <AnalyticsPageInner />
        </Suspense>
    );
}

function AnalyticsPageInner() {
    const periods = useAnalyticsPeriods();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const streamId = searchParams.get('class') || ALL_CLASSES;
    // Absent until the user picks one; the defaults are derived from the periods.
    const yearChoice = searchParams.get('year');
    const termParam = searchParams.get('term');
    // undefined = "the default for this view", null = the whole year (overview only).
    const termChoice: string | null | undefined = termParam === WHOLE_YEAR_PARAM ? null : termParam ?? undefined;
    const ids = { cls: useId(), year: useId(), term: useId() };

    /** Sets or clears URL params; `push` makes the change a Back-able step. */
    const navigate = useCallback((changes: Record<string, string | null>, mode: 'push' | 'replace' = 'replace') => {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) params.delete(key); else params.set(key, value);
        }
        const query = params.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        if (mode === 'push') router.push(url, { scroll: true }); else router.replace(url, { scroll: false });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/school/data?type=grade_streams', { signal: controller.signal })
            .then(r => r.json())
            .then((json: { data?: GradeStreamOption[] }) => {
                if (Array.isArray(json?.data)) {
                    setGradeStreams([...json.data].sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { numeric: true })));
                }
            })
            .catch(err => { if (!controller.signal.aborted) console.error('Grade streams error:', err); });
        return () => controller.abort();
    }, []);

    const isOverview = streamId === ALL_CLASSES;
    const yearId = yearChoice ?? defaultYear(periods);
    const yearTerms = termsOfYear(periods.terms, yearId);
    // A class is always read one term at a time (its rollups are per term);
    // the overview can also show the whole year.
    const termId = isOverview
        ? (termChoice === undefined ? null : termChoice)
        : (termChoice ?? defaultTermFor(periods.terms, yearId));

    const selectedClass = gradeStreams.find(g => g.id === streamId);
    const yearName = periods.years.find(y => y.id === yearId)?.name ?? null;
    const termName = yearTerms.find(t => t.id === termId)?.name ?? null;
    const periodLabel = [termName ?? (isOverview ? 'Whole year' : null), yearName].filter(Boolean).join(' · ');

    const classOptions: SelectOption[] = [{ id: ALL_CLASSES, label: 'All classes' }, ...gradeStreams.map(g => ({ id: g.id, label: g.full_name }))];
    const yearOptions: SelectOption[] = periods.years.map(y => ({ id: y.id, label: y.name }));
    const termOptions: SelectOption[] = [
        ...(isOverview ? [{ id: WHOLE_YEAR, label: 'Whole year' }] : []),
        ...yearTerms.map(t => ({ id: t.id, label: `${t.name}${t.is_current ? ' (current)' : ''}` })),
    ];

    const changeYear = (id: string) => navigate({ year: id, term: null });
    const setTermChoice = (choice: string | null) => navigate({ term: choice === null ? WHOLE_YEAR_PARAM : choice });
    // Opening a class from the list is a step Back can undo; the filter replaces.
    const openClass = (id: string) => navigate({ class: id === ALL_CLASSES ? null : id }, 'push');
    const changeClass = (id: string) => navigate({ class: id === ALL_CLASSES ? null : id });

    return (
        <div className="mx-auto w-full max-w-7xl pb-10">
            <PageHeader
                title={selectedClass ? selectedClass.full_name : 'Analytics'}
                eyebrow="Insights"
                icon={LineChart}
                hue="sky"
                description={selectedClass
                    ? 'Subject ranking, merit list and exam series for this class.'
                    : 'How each class is doing, weakest first. Open a class for its subjects and merit list.'}
                action={periodLabel ? (
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                        <CalendarRange className="size-3.5" aria-hidden="true" />
                        {periodLabel}
                    </span>
                ) : undefined}
            />

            {/* Filters: always visible, whatever the results below say. */}
            <section aria-label="Filters" className="mb-5 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_13rem]">
                    <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                        <label htmlFor={ids.cls} className="text-xs font-medium text-muted-foreground">Class</label>
                        <SelectField id={ids.cls} value={streamId} onChange={changeClass} options={classOptions} placeholder={null} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={ids.year} className="text-xs font-medium text-muted-foreground">Academic year</label>
                        <SelectField
                            id={ids.year}
                            value={yearId ?? ''}
                            onChange={changeYear}
                            options={yearOptions}
                            placeholder={yearOptions.length ? null : periods.status === 'loading' ? 'Loading…' : 'No years set up'}
                            disabled={yearOptions.length === 0}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={ids.term} className="text-xs font-medium text-muted-foreground">Term</label>
                        <SelectField
                            id={ids.term}
                            value={termId ?? WHOLE_YEAR}
                            onChange={v => setTermChoice(v === WHOLE_YEAR ? null : v)}
                            options={termOptions}
                            placeholder={termOptions.length ? null : 'No terms'}
                            disabled={termOptions.length === 0}
                        />
                    </div>
                </div>
                {periods.status === 'error' && (
                    <p role="alert" className="mt-3 text-xs text-destructive">Could not load the school&apos;s years and terms. Showing the current period.</p>
                )}
            </section>

            {!isOverview && (
                <button
                    type="button"
                    onClick={() => changeClass(ALL_CLASSES)}
                    className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />All classes
                </button>
            )}

            {periods.status === 'loading' ? (
                <div className="h-64 animate-pulse rounded-2xl border border-border/60 bg-muted/40" aria-hidden="true" />
            ) : isOverview ? (
                <SchoolOverview
                    yearId={yearId}
                    termId={termId}
                    onSelectClass={openClass}
                    onShowWholeYear={() => setTermChoice(null)}
                />
            ) : (
                <ClassAnalytics key={`${streamId}|${termId ?? "current"}`} streamId={streamId} termId={termId} periodLabel={periodLabel} />
            )}
        </div>
    );
}
