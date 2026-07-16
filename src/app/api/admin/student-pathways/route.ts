import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { bulkPathwayAssignSchema } from '@/lib/schemas';
import { syncStudentsSubjectsBulk } from '@/lib/pathway/sync-student-subjects';
import { ZodError } from 'zod';

async function getSession() {
    const { userId } = await auth();
    if (!userId) return null;

    const supabaseAdmin = createSupabaseAdmin();
    const { data } = await supabaseAdmin
        .from('users')
        .select('school_id, role')
        .eq('id', userId)
        .maybeSingle();
    if (!data?.school_id) return null;

    return { userId, schoolId: data.school_id as string, role: data.role as string };
}

/**
 * POST — bulk (re)assign existing students to a pathway / track /
 * subject combination without re-entering any of their data.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only admins can bulk-assign pathways.' }, { status: 403 });
        }

        const body = await request.json();
        const data = bulkPathwayAssignSchema.parse(body);
        const supabase = createSupabaseAdmin();

        // Every student must belong to the caller's school
        const { data: schoolStudents, error: studentsError } = await supabase
            .from('students')
            .select('id, users!inner(school_id)')
            .in('id', data.student_ids)
            .eq('users.school_id', session.schoolId);
        if (studentsError) {
            return NextResponse.json({ error: studentsError.message }, { status: 400 });
        }
        const foundIds = new Set((schoolStudents ?? []).map(s => s.id));
        const missing = data.student_ids.filter(id => !foundIds.has(id));
        if (missing.length > 0) {
            return NextResponse.json(
                { error: `${missing.length} student(s) were not found in your school.`, missing_ids: missing },
                { status: 400 }
            );
        }

        // Resolve the combination (if any) and derive pathway/track from
        // it when they are not explicitly provided
        let pathway = data.pathway ?? null;
        let track = data.track ?? null;
        const combinationId = data.subject_combination_id ?? null;

        if (combinationId) {
            const { data: combination } = await supabase
                .from('subject_combinations')
                .select('id, pathway, track, is_active')
                .eq('id', combinationId)
                .eq('school_id', session.schoolId)
                .maybeSingle();
            if (!combination) {
                return NextResponse.json({ error: 'Subject combination not found in your school.' }, { status: 404 });
            }
            if (!combination.is_active) {
                return NextResponse.json({ error: 'This subject combination is inactive.' }, { status: 400 });
            }
            if (!pathway) pathway = combination.pathway;
            if (!track) track = combination.track;
        }

        const { error: updateError } = await supabase
            .from('students')
            .update({
                pathway,
                track,
                subject_combination_id: combinationId,
            })
            .in('id', data.student_ids);
        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 400 });
        }

        const warnings: string[] = [];
        try {
            await syncStudentsSubjectsBulk(supabase, {
                studentIds: data.student_ids,
                schoolId: session.schoolId,
                combinationId,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'sync failed';
            warnings.push(`Subject enrollment sync failed: ${msg}. Re-run the assignment to retry.`);
        }

        return NextResponse.json({
            success: true,
            updated: data.student_ids.length,
            warnings,
        });
    } catch (err: unknown) {
        if (err instanceof ZodError) {
            const messages = err.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
            return NextResponse.json({ error: 'Validation failed', details: messages }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * GET — assignment overview with pathway/track/combination/subject
 * filters, used by the People page filters and the bulk-assign modal.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(session.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const gradeStreamId = searchParams.get('grade_stream_id');
        const pathway = searchParams.get('pathway');
        const combinationId = searchParams.get('combination_id');
        const subjectId = searchParams.get('subject_id');

        const supabase = createSupabaseAdmin();

        // Subject filter goes through the student_subjects junction first
        let enrolledIds: string[] | null = null;
        if (subjectId) {
            const { data: enrollments, error } = await supabase
                .from('student_subjects')
                .select('student_id')
                .eq('subject_id', subjectId)
                .eq('school_id', session.schoolId);
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            enrolledIds = [...new Set((enrollments ?? []).map(e => e.student_id))];
            if (enrolledIds.length === 0) return NextResponse.json({ data: [] });
        }

        let query = supabase
            .from('students')
            .select(`
                id, admission_number, status, current_grade_stream_id,
                pathway, track, subject_combination_id,
                users!inner (first_name, last_name, school_id),
                grade_streams (id, full_name),
                subject_combinations (id, code, name)
            `)
            .eq('users.school_id', session.schoolId);

        if (enrolledIds) query = query.in('id', enrolledIds);
        if (gradeStreamId) query = query.eq('current_grade_stream_id', gradeStreamId);
        if (pathway) query = query.eq('pathway', pathway);
        if (combinationId) query = query.eq('subject_combination_id', combinationId);

        const { data, error } = await query.order('admission_number');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        return NextResponse.json({ data: data ?? [] });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
