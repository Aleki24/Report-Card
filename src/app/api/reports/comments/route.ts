import { NextRequest, NextResponse } from 'next/server';
import { classLearnersInTerm } from '@/lib/reports/class-history';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { z } from 'zod';
import { forbidden, getCaller, type Caller } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';

export const runtime = 'nodejs';

/**
 * Report comments belong to the admin (principal's comment) and the class's
 * own teacher (class teacher's comment). This route used to check nothing but
 * the school, so any signed-in account — a student included — could read the
 * whole class's comments and rewrite their own report card.
 */
type StudentNameRow = { users: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null };

/** PostgREST types a to-one embed as an array; read it either way. */
function studentUser(row: StudentNameRow) {
    return Array.isArray(row.users) ? row.users[0] : row.users;
}

function canCommentOnStream(caller: Caller, gradeStreamId: string): boolean {
    return caller.role === 'ADMIN' || (caller.role === 'CLASS_TEACHER' && caller.classStreamIds.includes(gradeStreamId));
}

export async function GET(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return forbidden('Unauthorized', 401);

        const supabase = createSupabaseAdmin();
        const schoolId = caller.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const gradeStreamId = searchParams.get('grade_stream_id');
        const termId = searchParams.get('term_id');
        const academicYearId = searchParams.get('academic_year_id');

        if (!gradeStreamId || !termId || !academicYearId) {
            return NextResponse.json({ error: 'grade_stream_id, term_id, and academic_year_id are required' }, { status: 400 });
        }
        if (!canCommentOnStream(caller, gradeStreamId)) {
            return forbidden('Only administrators and the class teacher can view report comments.');
        }

        // The class's learners for the term (scoped to the school): who was in
        // it then, once its year has been promoted.
        const { rows: students } = await classLearnersInTerm<{ id: string; admission_number: string | null; users: { first_name: string | null; last_name: string | null } | null }>(supabase, {
            schoolId, termId, streamId: gradeStreamId, current: 'any',
            select: 'id, admission_number, users!inner(first_name, last_name, school_id)',
        });

        if (students.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const studentIds = students.map(s => s.id);

        // Fetch existing report_card comments
        const { data: reportCards } = await supabase
            .from('report_cards')
            .select('student_id, comments_class_teacher, comments_principal')
            .in('student_id', studentIds)
            .eq('term_id', termId)
            .eq('academic_year_id', academicYearId);

        const commentsMap = new Map<string, { comments_class_teacher: string; comments_principal: string }>();
        if (reportCards) {
            for (const rc of reportCards) {
                commentsMap.set(rc.student_id, {
                    comments_class_teacher: rc.comments_class_teacher || '',
                    comments_principal: rc.comments_principal || '',
                });
            }
        }

        const result = students.map(s => ({
            student_id: s.id,
            admission_number: s.admission_number,
            student_name: `${studentUser(s)?.first_name || ''} ${studentUser(s)?.last_name || ''}`.trim(),
            comments_class_teacher: commentsMap.get(s.id)?.comments_class_teacher || '',
            comments_principal: commentsMap.get(s.id)?.comments_principal || '',
        }));

        // Sort by name
        result.sort((a, b) => a.student_name.localeCompare(b.student_name));

        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch comments' }, { status: 500 });
    }
}

const MAX_COMMENT = 1000;
const commentText = z.string().trim().max(MAX_COMMENT, `Keep each comment under ${MAX_COMMENT} characters.`).nullish().transform(v => v || null);

const saveCommentsSchema = z.object({
    term_id: z.string().min(1),
    academic_year_id: z.string().min(1),
    grade_stream_id: z.string().min(1),
    comments: z.array(z.object({
        student_id: z.string().min(1),
        comments_class_teacher: commentText,
        comments_principal: commentText,
    })).min(1, 'Nothing to save.').max(500),
});

/**
 * Saves the comments for any number of the class's learners in one request.
 * "Save all" used to send one request per learner, edited or not, and report
 * a partial failure only as a count.
 */
export async function POST(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return forbidden('Unauthorized', 401);

        const schoolId = caller.schoolId;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const parsed = saveCommentsSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid comments.' }, { status: 400 });
        }
        const { term_id, academic_year_id, grade_stream_id, comments } = parsed.data;

        if (!canCommentOnStream(caller, grade_stream_id)) {
            return forbidden('Only administrators and the class teacher can edit report comments.');
        }

        const supabase = createSupabaseAdmin();
        const studentIds = [...new Set(comments.map(c => c.student_id))];

        // The term and year come from the body, so they must be this school's;
        // every learner must have been in this class that term (this school's
        // class, so this school's learners).
        const termRes = await supabase
            .from('terms')
            .select('id')
            .eq('id', term_id)
            .eq('academic_year_id', academic_year_id)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (termRes.error) return internalError('report comments term', termRes.error);
        if (!termRes.data) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }
        const { rows: classLearners } = await classLearnersInTerm<{ id: string }>(supabase, { schoolId, termId: term_id, streamId: grade_stream_id, select: 'id', current: 'any' });
        const inClass = new Set(classLearners.map(l => l.id));
        if (studentIds.some(id => !inClass.has(id))) {
            return NextResponse.json({ error: 'Some of these learners are no longer in this class. Reload and try again.' }, { status: 403 });
        }

        // The principal's comment is the admin's to write; a class teacher's
        // save leaves whatever the admin wrote untouched.
        const isAdmin = caller.role === 'ADMIN';
        const rows = comments.map(c => ({
            student_id: c.student_id,
            term_id,
            academic_year_id,
            grade_stream_id,
            comments_class_teacher: c.comments_class_teacher,
            ...(isAdmin ? { comments_principal: c.comments_principal } : {}),
        }));

        const { error } = await supabase
            .from('report_cards')
            .upsert(rows, { onConflict: 'student_id,term_id,academic_year_id' });
        if (error) return internalError('report comments upsert', error);

        return NextResponse.json({ success: true, saved: rows.length });
    } catch (err: unknown) {
        return internalError('report comments', err);
    }
}
