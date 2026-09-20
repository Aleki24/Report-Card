"use client";

import React, { useEffect, useState } from 'react';
import ClassAnalytics from '@/components/analytics/ClassAnalytics';
import SchoolOverview from '@/components/analytics/SchoolOverview';

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
 */

interface GradeStreamOption {
    id: string;
    full_name: string;
}

export default function AnalyticsPage() {
    const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
    const [selectedStreamId, setSelectedStreamId] = useState<string>('all');

    useEffect(() => {
        let cancelled = false;
        fetch('/api/school/data?type=grade_streams')
            .then(r => r.json())
            .then(json => {
                if (!cancelled && Array.isArray(json?.data)) setGradeStreams(json.data);
            })
            .catch(err => console.error('Grade streams error:', err));
        return () => { cancelled = true; };
    }, []);

    const selected = gradeStreams.find(g => g.id === selectedStreamId);

    return (
        <div className="p-4 xs:p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {selected
                            ? `${selected.full_name} — subjects, merit list and trend`
                            : 'How each class is doing. Open a class for its subjects and merit list.'}
                    </p>
                </div>

                <label className="flex items-center gap-2 md:shrink-0">
                    <span className="sr-only">Class</span>
                    <select
                        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground md:w-[220px]"
                        value={selectedStreamId}
                        onChange={e => setSelectedStreamId(e.target.value)}
                    >
                        <option value="all">All classes</option>
                        {gradeStreams.map(g => (
                            <option key={g.id} value={g.id}>{g.full_name}</option>
                        ))}
                    </select>
                </label>
            </div>

            {selectedStreamId === 'all' ? (
                <SchoolOverview onSelectClass={setSelectedStreamId} />
            ) : (
                <ClassAnalytics streamId={selectedStreamId} />
            )}
        </div>
    );
}
