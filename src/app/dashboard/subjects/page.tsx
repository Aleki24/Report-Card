"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Layers, RotateCcw, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { PageTabs, useUrlTab, type PageTab } from '@/components/ui/PageTabs';
import { OfferedSubjectsTab } from '@/components/subjects/OfferedSubjectsTab';
import CombinationsManager from '@/components/subjects/CombinationsManager';
import PlacementManager from '@/components/subjects/PlacementManager';
import { SubjectTeachersTab } from '@/components/subjects/SubjectTeachersTab';
import type { SubjectsData } from '@/components/subjects/subjectTypes';
import { apiErrorMessage } from '@/lib/api-error-message';

type SubjectsTab = 'subjects' | 'combinations' | 'placement' | 'teachers';

type Load = { state: 'loading' } | { state: 'ready'; data: SubjectsData } | { state: 'error'; message: string };

/** The Ministry's minimum learners for a combination to run as its own class. */
const DEFAULT_MIN_GROUP = 15;

export default function SubjectsPage() {
    return (
        <Suspense fallback={<ContentSkeleton message="Loading subjects..." />}>
            <SubjectsPageInner />
        </Suspense>
    );
}

function SubjectsPageInner() {
    const { role } = useAuth();
    const isAdmin = role === 'ADMIN';
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const [minGroupSize, setMinGroupSize] = useState(DEFAULT_MIN_GROUP);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/academic-structure', { cache: 'no-store' });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load subjects.'));
            const j = json as Partial<SubjectsData>;
            setLoad({
                state: 'ready',
                data: {
                    subjects: j.subjects ?? [],
                    grading_systems: j.grading_systems ?? [],
                    academic_levels: j.academic_levels ?? [],
                    grades: j.grades ?? [],
                    grade_streams: j.grade_streams ?? [],
                    subject_combinations: j.subject_combinations ?? [],
                },
            });
        } catch (err) {
            // A failed refresh keeps the page as it was.
            const message = err instanceof Error ? err.message : 'Could not load subjects.';
            setLoad(prev => (prev.state === 'ready' ? prev : { state: 'error', message }));
        }
    }, []);

    useEffect(() => {
        void fetchData();
        // A school may set its own minimum group size for combinations.
        fetch('/api/school/data?type=school_profile')
            .then(res => (res.ok ? res.json() : null))
            .then((json: { data?: { min_combination_group_size?: unknown } } | null) => {
                const size = json?.data?.min_combination_group_size;
                if (typeof size === 'number' && size > 0) setMinGroupSize(size);
            })
            .catch(() => { /* keep the default */ });
    }, [fetchData]);

    const data = load.state === 'ready' ? load.data : null;

    const tabs = useMemo((): PageTab<SubjectsTab>[] => [
        { id: 'subjects', label: 'Subjects', icon: BookOpen, hue: 'emerald', badge: data?.subjects.length },
        { id: 'combinations', label: 'Subject combinations', shortLabel: 'Combos', icon: Layers, hue: 'violet', badge: data?.subject_combinations.length },
        // Placement writes every learner's subjects, so it is admin-only.
        ...(isAdmin ? [{ id: 'placement' as const, label: 'Learner placement', shortLabel: 'Placement', icon: Sparkles, hue: 'amber' as const }] : []),
        { id: 'teachers', label: 'Subject teachers', shortLabel: 'Teachers', icon: Users, hue: 'sky' },
    ], [data, isAdmin]);
    const [active, select] = useUrlTab(tabs);

    return (
        <div className="mx-auto w-full max-w-7xl pb-10">
            <PageHeader
                title="Subjects"
                eyebrow="School"
                icon={BookOpen}
                hue="emerald"
                description="Choose the subjects your school offers, set up senior school combinations and assign subject teachers."
            />

            <PageTabs tabs={tabs} active={active} onSelect={select} label="Subjects" idPrefix="subjects" />

            <div role="tabpanel" id="subjects-panel" aria-labelledby={`subjects-tab-${active}`}>
                {load.state === 'loading' && <ContentSkeleton message="Loading subjects..." />}

                {load.state === 'error' && (
                    <div className="rounded-2xl border border-dashed border-border bg-card">
                        <EmptyState
                            hue="rose"
                            icon={<AlertTriangle className="size-6" />}
                            title="Couldn't load subjects"
                            description={load.message}
                            action={<button type="button" className="btn-primary" onClick={() => { setLoad({ state: 'loading' }); void fetchData(); }}><RotateCcw className="size-4" aria-hidden />Try again</button>}
                        />
                    </div>
                )}

                {data && active === 'subjects' && (
                    <OfferedSubjectsTab
                        isAdmin={isAdmin}
                        subjects={data.subjects}
                        gradingSystems={data.grading_systems}
                        academicLevels={data.academic_levels}
                        grades={data.grades}
                        onChanged={fetchData}
                    />
                )}
                {data && active === 'combinations' && (
                    <CombinationsManager
                        combinations={data.subject_combinations}
                        subjects={data.subjects}
                        cbcLevelId={data.academic_levels.find(l => l.code === 'CBC')?.id}
                        minGroupSize={minGroupSize}
                        isAdmin={isAdmin}
                        onChanged={fetchData}
                    />
                )}
                {data && active === 'placement' && (
                    <PlacementManager grades={data.grades} streams={data.grade_streams} academicLevels={data.academic_levels} />
                )}
                {data && active === 'teachers' && <SubjectTeachersTab grades={data.grades} streams={data.grade_streams} />}
            </div>
        </div>
    );
}
