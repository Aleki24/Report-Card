import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth } from '@clerk/nextjs/server';
import { getSchoolPassMark } from '@/lib/pass-mark';
import { getActiveUserProfile } from '@/lib/auth-server';
import { isUuid } from '@/lib/postgrest';

/**
 * The school, compared class by class.
 *
 * This is deliberately the only thing the school-level view offers. The page
 * used to put a merit list and a subject table here too, which meant ranking a
 * Grade 1 learner against a Form 4 candidate and averaging a Lower Primary
 * "Mathematics" with a Senior School one — questions with no answer, presented
 * as though they had one.
 *
 * What survives aggregation across curricula is the share of learners reaching
 * a percentage threshold, and only when each row says which curriculum it
 * belongs to. A CBC Grade 4 next to an 8-4-4 Form 4 is a comparison the reader
 * may choose to make; it is not one to make for them inside a single mean.
 */

export interface OverviewClass {
    id: string;
    name: string;
    level_code: string | null;
    students: number;
    mark_count: number;
    mean: number | null;
    pass_rate: number | null;
    unmarked: number;
}

export interface OverviewScope {
    academic_year_id: string | null;
    academic_year: string | null;
    /** Null means the whole academic year. */
    term_id: string | null;
    term_name: string | null;
}

/** PostgREST's "no such function" — the term rollups' migration has not been applied yet. */
const FUNCTION_MISSING = 'PGRST202';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const profile = await getActiveUserProfile(userId);

        const schoolId = profile?.school_id;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });
        if (profile?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const passMark = await getSchoolPassMark(supabase, schoolId);
        const { searchParams } = new URL(request.url);
        const yearParam = searchParams.get('academic_year_id');
        const termParam = searchParams.get('term_id');
        if ((yearParam && !isUuid(yearParam)) || (termParam && !isUuid(termParam))) {
            return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
        }

        // A chosen term decides its own year. Every id must be this school's,
        // or an admin could read another school's figures by guessing one.
        let term: { id: string; name: string; academic_year_id: string } | null = null;
        if (termParam) {
            const { data } = await supabase
                .from('terms')
                .select('id, name, academic_year_id')
                .eq('id', termParam)
                .eq('school_id', schoolId)
                .maybeSingle();
            if (!data) return NextResponse.json({ error: 'Term not found' }, { status: 404 });
            term = data;
        }

        let yearQuery = supabase.from('academic_years').select('id, name').eq('school_id', schoolId);
        const yearId = term?.academic_year_id ?? yearParam;
        yearQuery = yearId ? yearQuery.eq('id', yearId) : yearQuery.order('start_date', { ascending: false }).limit(1);
        const { data: year } = await yearQuery.maybeSingle();
        if (yearId && !year) return NextResponse.json({ error: 'Academic year not found' }, { status: 404 });

        // Both rollups already exist and are already used by the dashboard;
        // Analytics simply never called them and hand-rolled the same thing in
        // the browser from a truncated array of marks.
        const [perfRes, unmarkedRes] = await Promise.all(term
            ? [
                supabase.rpc('school_class_performance_for_term', { p_school_id: schoolId, p_term_id: term.id, p_pass_mark: passMark }),
                supabase.rpc('school_unmarked_exams_for_term', { p_school_id: schoolId, p_term_id: term.id }),
            ]
            : [
                supabase.rpc('school_class_performance', { p_school_id: schoolId, p_academic_year_id: year?.id ?? null, p_pass_mark: passMark }),
                supabase.rpc('school_unmarked_exams', { p_school_id: schoolId, p_academic_year_id: year?.id ?? null }),
            ]);

        if (term && perfRes.error?.code === FUNCTION_MISSING) {
            return NextResponse.json({
                error: 'Term figures need a database update (migration 20260925100000_class_rollups_by_term). Whole-year figures still work.',
                code: 'TERM_FILTER_UNAVAILABLE',
            }, { status: 501 });
        }

        if (perfRes.error) {
            console.error('Analytics overview error:', perfRes.error);
            return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 });
        }

        // Unmarked exams are grouped by class label rather than id, so match on
        // the label the rollup emits.
        const unmarkedByLabel = new Map<string, number>();
        for (const row of (unmarkedRes.data ?? []) as Record<string, unknown>[]) {
            const label = (row.label as string) || '';
            unmarkedByLabel.set(label, (unmarkedByLabel.get(label) ?? 0) + Number(row.unmarked_count ?? 0));
        }

        const classes: OverviewClass[] = ((perfRes.data ?? []) as Record<string, unknown>[])
            .map(row => {
                const markCount = Number(row.mark_count ?? 0);
                const name = (row.full_name as string) || 'Unnamed';
                return {
                    id: row.grade_stream_id as string,
                    name,
                    level_code: (row.level_code as string) ?? null,
                    students: Number(row.student_count ?? 0),
                    mark_count: markCount,
                    mean: markCount > 0 ? Number(row.mean_percentage ?? 0) : null,
                    pass_rate: markCount > 0
                        ? Math.round((Number(row.pass_count ?? 0) / markCount) * 100)
                        : null,
                    unmarked: unmarkedByLabel.get(name) ?? 0,
                };
            })
            // Weakest first. A class in trouble is the reason to open this page;
            // it should not be somewhere in the middle of an alphabetical list.
            .sort((a, b) => (a.pass_rate ?? 101) - (b.pass_rate ?? 101));

        const withMarks = classes.filter(c => c.mark_count > 0);
        const totalMarks = withMarks.reduce((sum, c) => sum + c.mark_count, 0);

        const scope: OverviewScope = {
            academic_year_id: year?.id ?? null,
            academic_year: year?.name ?? null,
            term_id: term?.id ?? null,
            term_name: term?.name ?? null,
        };

        return NextResponse.json({
            scope,
            academic_year: year?.name ?? null,
            classes,
            summary: {
                pass_mark: passMark,
                classes_with_marks: withMarks.length,
                classes_total: classes.length,
                learners: classes.reduce((sum, c) => sum + c.students, 0),
                mark_count: totalMarks,
                exams_awaiting_marks: [...unmarkedByLabel.values()].reduce((a, b) => a + b, 0),
            },
        });
    } catch (err) {
        console.error('Analytics overview route error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
