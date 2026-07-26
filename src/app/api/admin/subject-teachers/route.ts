import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Who teaches each subject in a class.
 *
 * The name printed against a subject on report cards and the class marksheet
 * comes from `subject_teacher_assignments`. Until now those rows could only be
 * created while inviting a teacher, so a subject whose teacher was never
 * assigned — or who has since changed — printed no name, with nowhere for an
 * admin to correct it. This exposes the mapping directly: read the subjects
 * for a class with their current teacher, and set or clear one.
 *
 * Assignments are per subject + grade (+ stream when the class is streamed),
 * matching how fetchSubjectTeachers resolves names for the reports.
 */

async function requireAdmin() {
    const { userId } = await auth();
    if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const supabase = createSupabaseAdmin();
    const { data: profile } = await supabase
        .from('users')
        .select('role, school_id, is_active')
        .eq('id', userId)
        .maybeSingle();

    if (!profile || profile.is_active === false) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (profile.role !== 'ADMIN' || !profile.school_id) {
        return { error: NextResponse.json({ error: 'Only admins can manage subject teachers.' }, { status: 403 }) };
    }
    return { supabase, schoolId: profile.school_id as string };
}

/** The school's current academic year, which assignments are scoped to. */
async function currentYearId(supabase: ReturnType<typeof createSupabaseAdmin>, schoolId: string) {
    const { data } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data?.id as string | undefined;
}

export async function GET(request: NextRequest) {
    try {
        const ctx = await requireAdmin();
        if ('error' in ctx) return ctx.error;
        const { supabase, schoolId } = ctx;

        const { searchParams } = new URL(request.url);
        const gradeId = searchParams.get('grade_id');
        const gradeStreamId = searchParams.get('grade_stream_id');
        if (!gradeId) return NextResponse.json({ error: 'grade_id is required' }, { status: 400 });

        const yearId = await currentYearId(supabase, schoolId);

        // Subjects offered at this grade's academic level.
        const { data: grade } = await supabase
            .from('grades')
            .select('academic_level_id')
            .eq('id', gradeId)
            .maybeSingle();

        const { data: subjects } = await supabase
            .from('subjects')
            .select('id, name, code, display_order')
            .eq('academic_level_id', grade?.academic_level_id || '')
            .order('display_order');

        // Everyone who could hold a subject.
        const { data: staff } = await supabase
            .from('users')
            .select('id, first_name, last_name, role')
            .eq('school_id', schoolId)
            .in('role', ['CLASS_TEACHER', 'SUBJECT_TEACHER', 'ADMIN'])
            .eq('is_active', true);

        let query = supabase
            .from('subject_teacher_assignments')
            .select('id, subject_id, grade_stream_id, subject_teacher_id')
            .eq('grade_id', gradeId);
        if (yearId) query = query.eq('academic_year_id', yearId);
        const assignments = (await query).data || [];

        const teacherIds = [...new Set(assignments.map(a => a.subject_teacher_id).filter(Boolean))] as string[];
        const { data: teacherRows } = teacherIds.length
            ? await supabase.from('subject_teachers').select('id, user_id').in('id', teacherIds)
            : { data: [] as { id: string; user_id: string }[] };
        const userIdByTeacher = new Map((teacherRows || []).map(t => [t.id, t.user_id]));

        // Stream-specific assignment wins over a grade-wide one, mirroring how
        // the reports resolve the name they print.
        const bySubject = new Map<string, string>();
        for (const a of assignments) {
            if (!a.subject_id) continue;
            if (a.grade_stream_id && gradeStreamId && a.grade_stream_id !== gradeStreamId) continue;
            if (a.grade_stream_id || !bySubject.has(a.subject_id)) {
                const uid = userIdByTeacher.get(a.subject_teacher_id || '');
                if (uid) bySubject.set(a.subject_id, uid);
            }
        }

        return NextResponse.json({
            subjects: (subjects || []).map(s => ({
                id: s.id,
                name: s.name,
                code: s.code,
                teacher_user_id: bySubject.get(s.id) || null,
            })),
            staff: (staff || []).map(u => ({
                id: u.id,
                name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.id,
            })).sort((a, b) => a.name.localeCompare(b.name)),
        });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const ctx = await requireAdmin();
        if ('error' in ctx) return ctx.error;
        const { supabase, schoolId } = ctx;

        const { subject_id, grade_id, grade_stream_id, teacher_user_id } = await request.json();
        if (!subject_id || !grade_id) {
            return NextResponse.json({ error: 'subject_id and grade_id are required' }, { status: 400 });
        }

        const yearId = await currentYearId(supabase, schoolId);
        if (!yearId) {
            return NextResponse.json({ error: 'Set up an academic year in Settings first.' }, { status: 400 });
        }

        // Replace whatever currently covers this subject for this class, so a
        // subject never ends up with two teachers racing to be printed.
        let del = supabase
            .from('subject_teacher_assignments')
            .delete()
            .eq('subject_id', subject_id)
            .eq('grade_id', grade_id)
            .eq('academic_year_id', yearId);
        del = grade_stream_id ? del.eq('grade_stream_id', grade_stream_id) : del.is('grade_stream_id', null);
        await del;

        // Clearing the teacher is a valid outcome — the subject prints no name.
        if (!teacher_user_id) return NextResponse.json({ success: true, cleared: true });

        const { data: target } = await supabase
            .from('users')
            .select('id, school_id')
            .eq('id', teacher_user_id)
            .maybeSingle();
        if (!target || target.school_id !== schoolId) {
            return NextResponse.json({ error: 'That teacher is not in your school.' }, { status: 404 });
        }

        // A teacher only gets a subject_teachers row when they first hold a
        // subject, so create it on demand rather than requiring the invite flow.
        let { data: teacher } = await supabase
            .from('subject_teachers')
            .select('id')
            .eq('user_id', teacher_user_id)
            .maybeSingle();
        if (!teacher) {
            const { data: created, error } = await supabase
                .from('subject_teachers')
                .insert({ user_id: teacher_user_id })
                .select('id')
                .single();
            if (error || !created) {
                return NextResponse.json({ error: 'Could not create the teacher record.' }, { status: 500 });
            }
            teacher = created;
        }

        const { error: insertError } = await supabase.from('subject_teacher_assignments').insert({
            subject_teacher_id: teacher.id,
            subject_id,
            grade_id,
            grade_stream_id: grade_stream_id || null,
            academic_year_id: yearId,
        });
        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}
