import { NextRequest, NextResponse } from 'next/server';
import { authorizeClassReport } from '@/lib/reports/report-access';
import { termBelongsToSchool } from '@/lib/tenant-scope';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { getSchoolPassMark } from '@/lib/pass-mark';

export const runtime = 'nodejs';

interface SubjectPerformanceRow {
    subject_id: string;
    subject_name: string;
    mark_count: number | string;
    mean_percentage: number | string | null;
    pass_count: number | string;
}

/** One term's figures for the class, over every exam sat that term. */
export interface TermSummary {
    mean: number | null;
    pass_rate: number | null;
    mark_count: number;
}

export interface SubjectComparison {
    subject_id: string;
    subject_name: string;
    base: number | null;
    compare: number | null;
    /** compare − base, when both terms have marks. */
    change: number | null;
}

export interface TermComparisonResponse {
    pass_mark: number;
    base: TermSummary;
    compare: TermSummary;
    subjects: SubjectComparison[];
}

function summarise(rows: readonly SubjectPerformanceRow[]): TermSummary {
    const markCount = rows.reduce((sum, r) => sum + Number(r.mark_count), 0);
    if (markCount === 0) return { mean: null, pass_rate: null, mark_count: 0 };
    const weighted = rows.reduce((sum, r) => sum + Number(r.mean_percentage ?? 0) * Number(r.mark_count), 0);
    const passes = rows.reduce((sum, r) => sum + Number(r.pass_count), 0);
    return { mean: Math.round(weighted / markCount), pass_rate: Math.round((passes / markCount) * 100), mark_count: markCount };
}

/**
 * How one class did in two terms, overall and subject by subject.
 *
 * The Compare Terms dialog used to fetch every mark the class ever had and
 * average them in the browser. That read was unpaged, so a class past 1,000
 * marks was compared on whichever rows came first, and it offered every
 * school's "Term 1" without saying which year. The rollup runs where the data
 * is, and the class is today's learners in that stream, as on the dashboard.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const streamId = searchParams.get('grade_stream_id');
        const baseTermId = searchParams.get('base_term_id');
        const compareTermId = searchParams.get('compare_term_id');
        if (!streamId || !baseTermId || !compareTermId) {
            return NextResponse.json({ error: 'Choose a class and two terms.' }, { status: 400 });
        }
        if (baseTermId === compareTermId) {
            return NextResponse.json({ error: 'Choose two different terms.' }, { status: 400 });
        }

        const access = await authorizeClassReport(streamId, 'Only administrators and the class teacher can compare this class.');
        if (!access.ok) return access.response;
        const { schoolId } = access.session;

        const [baseOk, compareOk] = await Promise.all([termBelongsToSchool(baseTermId, schoolId), termBelongsToSchool(compareTermId, schoolId)]);
        if (!baseOk || !compareOk) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

        const supabase = createSupabaseAdmin();
        const passMark = await getSchoolPassMark(supabase, schoolId);
        const performance = (termId: string) => supabase.rpc('class_subject_performance', {
            p_school_id: schoolId,
            p_grade_stream_id: streamId,
            p_term_id: termId,
            p_exam_type: null,
            p_pass_mark: passMark,
        });
        const [baseRes, compareRes] = await Promise.all([performance(baseTermId), performance(compareTermId)]);
        if (baseRes.error) return internalError('term-comparison base', baseRes.error);
        if (compareRes.error) return internalError('term-comparison compare', compareRes.error);

        const baseRows = (baseRes.data ?? []) as SubjectPerformanceRow[];
        const compareRows = (compareRes.data ?? []) as SubjectPerformanceRow[];

        const bySubject = new Map<string, SubjectComparison>();
        const entry = (row: SubjectPerformanceRow) => {
            const existing = bySubject.get(row.subject_id);
            if (existing) return existing;
            const created: SubjectComparison = { subject_id: row.subject_id, subject_name: row.subject_name, base: null, compare: null, change: null };
            bySubject.set(row.subject_id, created);
            return created;
        };
        for (const row of baseRows) entry(row).base = row.mean_percentage == null ? null : Number(row.mean_percentage);
        for (const row of compareRows) entry(row).compare = row.mean_percentage == null ? null : Number(row.mean_percentage);

        const subjects = [...bySubject.values()]
            .map(s => ({ ...s, change: s.base != null && s.compare != null ? s.compare - s.base : null }))
            // Biggest movers first; subjects sat in only one term last.
            .sort((a, b) => (a.change == null ? 1 : 0) - (b.change == null ? 1 : 0)
                || Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0)
                || a.subject_name.localeCompare(b.subject_name));

        const body: TermComparisonResponse = { pass_mark: passMark, base: summarise(baseRows), compare: summarise(compareRows), subjects };
        return NextResponse.json(body);
    } catch (err: unknown) {
        return internalError('term-comparison', err);
    }
}
