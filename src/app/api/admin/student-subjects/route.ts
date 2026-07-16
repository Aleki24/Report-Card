import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

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
 * GET — per-subject enrollment roster: the school's students (optionally
 * one stream) with an `enrolled` flag for the given subject. Used by the
 * "who takes this subject" manager for 8-4-4 electives (e.g. CRE vs IRE)
 * and for inspecting CBC elective enrollment.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(session.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const subjectId = searchParams.get('subject_id');
        const gradeStreamId = searchParams.get('grade_stream_id');
        if (!subjectId) return NextResponse.json({ error: 'subject_id is required' }, { status: 400 });

        const supabase = createSupabaseAdmin();

        const { data: subject } = await supabase
            .from('subjects')
            .select('id, name, code, subject_type, academic_level_id')
            .eq('id', subjectId)
            .eq('school_id', session.schoolId)
            .maybeSingle();
        if (!subject) return NextResponse.json({ error: 'Subject not found in your school.' }, { status: 404 });

        let studentsQuery = supabase
            .from('students')
            .select('id, admission_number, status, current_grade_stream_id, academic_level_id, subject_combination_id, users!inner (first_name, last_name, school_id), grade_streams (id, full_name)')
            .eq('users.school_id', session.schoolId)
            // Only students on the same curriculum as the subject can take it
            .eq('academic_level_id', subject.academic_level_id);
        if (gradeStreamId) studentsQuery = studentsQuery.eq('current_grade_stream_id', gradeStreamId);
        const { data: students, error } = await studentsQuery.order('admission_number');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        const studentIds = (students ?? []).map(s => s.id);
        let enrolledIds = new Set<string>();
        if (studentIds.length > 0) {
            const { data: enrollments } = await supabase
                .from('student_subjects')
                .select('student_id')
                .eq('subject_id', subjectId)
                .in('student_id', studentIds);
            enrolledIds = new Set((enrollments ?? []).map(e => e.student_id));
        }

        return NextResponse.json({
            subject,
            data: (students ?? []).map(s => ({ ...s, enrolled: enrolledIds.has(s.id) })),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/**
 * POST — add/remove students from a subject's enrollment roster.
 * Body: { subject_id, add: string[], remove: string[] }
 *
 * Note: for CBC students assigned to a subject combination, manual
 * tweaks to combination subjects are overwritten the next time their
 * combination is (re)synced — this endpoint is primarily for 8-4-4
 * electives and one-off adjustments.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['ADMIN', 'CLASS_TEACHER'].includes(session.role)) {
            return NextResponse.json({ error: 'Only admins and class teachers can manage subject enrollment.' }, { status: 403 });
        }

        const body = await request.json();
        const subjectId = body.subject_id as string;
        const add: string[] = Array.isArray(body.add) ? body.add : [];
        const remove: string[] = Array.isArray(body.remove) ? body.remove : [];
        if (!subjectId) return NextResponse.json({ error: 'subject_id is required' }, { status: 400 });
        if (add.length === 0 && remove.length === 0) {
            return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
        }
        if (add.length > 500 || remove.length > 500) {
            return NextResponse.json({ error: 'Too many students in one request (max 500).' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        const { data: subject } = await supabase
            .from('subjects')
            .select('id, subject_type')
            .eq('id', subjectId)
            .eq('school_id', session.schoolId)
            .maybeSingle();
        if (!subject) return NextResponse.json({ error: 'Subject not found in your school.' }, { status: 404 });

        // Every touched student must belong to the caller's school
        const touched = [...new Set([...add, ...remove])];
        const { data: schoolStudents } = await supabase
            .from('students')
            .select('id, users!inner(school_id)')
            .in('id', touched)
            .eq('users.school_id', session.schoolId);
        const foundIds = new Set((schoolStudents ?? []).map(s => s.id));
        const missing = touched.filter(id => !foundIds.has(id));
        if (missing.length > 0) {
            return NextResponse.json({ error: `${missing.length} student(s) were not found in your school.` }, { status: 400 });
        }

        if (add.length > 0) {
            const role = subject.subject_type === 'CORE' ? 'CORE' : 'ELECTIVE';
            const { error: addError } = await supabase.from('student_subjects').upsert(
                add.map(studentId => ({
                    student_id: studentId,
                    subject_id: subjectId,
                    role,
                    school_id: session.schoolId,
                })),
                { onConflict: 'student_id,subject_id' }
            );
            if (addError) return NextResponse.json({ error: addError.message }, { status: 400 });
        }

        if (remove.length > 0) {
            const { error: removeError } = await supabase
                .from('student_subjects')
                .delete()
                .eq('subject_id', subjectId)
                .in('student_id', remove);
            if (removeError) return NextResponse.json({ error: removeError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, added: add.length, removed: remove.length });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
