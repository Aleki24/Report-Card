"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, BookOpen, Minus, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import KpiTile from '@/components/dashboard/KpiTile';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import HomeworkPanel from '@/components/student/dashboard/HomeworkPanel';
import { Panel, QuietEmpty } from '@/components/student/dashboard/shared';
import { useSchoolPassMark } from '@/hooks/useSchoolPassMark';
import type { StudentAssignment } from '@/lib/assignments';
import type { StudentTermTrend } from '@/types';

interface Subject {
    id: string;
    name: string;
    code: string | null;
    subject_type: 'CORE' | 'ESSENTIAL' | 'OPTIONAL' | null;
}

interface Loaded {
    subject: Subject | null;
    trends: StudentTermTrend[];
    assignments: StudentAssignment[];
}

const TYPE_LABEL: Record<NonNullable<Subject['subject_type']>, string> = {
    CORE: 'Core',
    ESSENTIAL: 'Essential',
    OPTIONAL: 'Optional',
};

async function getData<T>(url: string): Promise<T | null> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { data?: T }).data ?? null;
}

async function loadSubject(subjectId: string): Promise<Loaded> {
    const [subjects, trends, dashboard] = await Promise.all([
        getData<Subject[]>('/api/school/student/subjects'),
        getData<StudentTermTrend[]>('/api/school/student/performance'),
        getData<{ assignments?: StudentAssignment[] }>('/api/school/student/dashboard'),
    ]);
    return {
        subject: subjects?.find(s => s.id === subjectId) ?? null,
        trends: trends ?? [],
        assignments: (dashboard?.assignments ?? []).filter(a => a.subjectId === subjectId),
    };
}

/**
 * One subject for the learner: how they've done each term and the homework
 * set for it.
 *
 * Homework and marks used to be matched to the subject by name, and its
 * "learning materials" list only ever saw the five newest materials across
 * every subject (and nothing in the app creates them), so it was always
 * empty. Everything is keyed by the subject's id now.
 */
export default function StudentSubjectPage() {
    const { subjectId } = useParams<{ subjectId: string }>();
    const passMark = useSchoolPassMark();
    const [data, setData] = useState<Loaded | null>(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(() => {
        loadSubject(subjectId).then(
            loaded => { setData(loaded); setFailed(false); },
            () => setFailed(true),
        );
    }, [subjectId]);

    useEffect(load, [load]);

    const series = useMemo(() => (data?.trends ?? []).flatMap(t => {
        const mark = t.subjects.find(s => s.id === subjectId);
        return mark ? [{ examName: `${t.termName} ${t.yearName}`.trim(), average: mark.average }] : [];
    }), [data, subjectId]);

    if (failed) {
        return (
            <div className="mx-auto w-full max-w-[1100px] py-16 text-center">
                <p className="text-sm text-muted-foreground">We couldn&apos;t load this subject.</p>
                <button type="button" onClick={load} className="btn-secondary mt-4">Try again</button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="mx-auto w-full max-w-[1100px]">
                <div className="skeleton-bone mb-6 h-12 w-2/5 rounded-xl" />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton-bone h-[96px] rounded-2xl" />)}
                </div>
                <div className="skeleton-bone mt-5 h-[280px] rounded-2xl" />
            </div>
        );
    }

    const { subject } = data;
    if (!subject) {
        return (
            <div className="mx-auto w-full max-w-[1100px] py-20 text-center">
                <h1 className="font-display text-2xl font-bold text-foreground">Subject not found</h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">This subject isn&apos;t one of yours, or it has been removed from your class.</p>
                <Link href="/student/subjects" className="btn-secondary mt-6 no-underline">Back to my subjects</Link>
            </div>
        );
    }

    const latest = series.at(-1);
    const previous = series.at(-2);
    const change = latest && previous ? Math.round((latest.average - previous.average) * 10) / 10 : null;
    const best = series.length > 0 ? Math.max(...series.map(s => s.average)) : null;
    const badge = TYPE_LABEL[subject.subject_type ?? 'OPTIONAL'];
    const ChangeIcon = change == null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 pb-10">
            <PageHeader
                className="mb-0"
                title={subject.name}
                eyebrow="My subjects"
                icon={BookOpen}
                hue="emerald"
                breadcrumbs={[{ label: 'My subjects', href: '/student/subjects' }, { label: subject.name }]}
                description={[subject.code, `${badge} subject`].filter(Boolean).join(' · ')}
            />

            <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <KpiTile
                    href="/student/results"
                    title={latest ? `${latest.examName} average` : 'Latest average'}
                    value={latest ? `${latest.average}%` : '—'}
                    icon={<TrendingUp size={17} />}
                    tone={latest ? (latest.average >= passMark ? 'green' : 'amber') : undefined}
                />
                <KpiTile
                    href="/student/results"
                    title={previous ? `Change since ${previous.examName}` : 'Change since last term'}
                    value={change == null ? '—' : `${change > 0 ? '+' : ''}${change} pts`}
                    icon={<ChangeIcon size={17} />}
                    tone={change == null || change === 0 ? undefined : change > 0 ? 'green' : 'red'}
                />
                <div className="col-span-2 lg:col-span-1"><KpiTile href="/student/results" title="Best term" value={best == null ? '—' : `${best}%`} icon={<ArrowUpRight size={17} />} hue="violet" /></div>
            </section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                <Panel title="Term by term" subtitle={`Your ${subject.name} average each term · pass mark ${passMark}%`} className="lg:col-span-3">
                    {series.length > 1 ? (
                        <PerformanceTrendChart data={series} passMark={passMark} height={260} />
                    ) : (
                        <QuietEmpty icon={<TrendingUp size={18} />}>
                            {series.length === 1
                                ? `Your trend appears once you have ${subject.name} results for a second term.`
                                : `No released ${subject.name} results yet.`}
                        </QuietEmpty>
                    )}
                </Panel>
                <div className="lg:col-span-2">
                    <HomeworkPanel
                        title={`${subject.name} homework`}
                        emptyText={`No ${subject.name} homework right now.`}
                        assignments={data.assignments}
                        onChanged={load}
                    />
                </div>
            </div>
        </div>
    );
}
