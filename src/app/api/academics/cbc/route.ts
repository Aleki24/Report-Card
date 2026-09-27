import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';
import { CBC_LEVELS } from '@/lib/ops/resources/academics';

const MODULE = { module: 'cbc_assessment' as const };

export interface RubricRow { studentId: string; name: string; admissionNumber: string | null; level: (typeof CBC_LEVELS)[number] | null; comment: string | null }

function params(url: URLSearchParams) {
    const stream = url.get('grade_stream_id');
    const subject = url.get('subject_id');
    const term = url.get('term_id');
    const strand = url.get('strand')?.trim();
    if (!stream || !subject || !term || !strand) throw new HttpError(400, 'Choose a class, subject, term and strand.');
    return { stream, subject, term, strand, subStrand: url.get('sub_strand')?.trim() ?? '' };
}

/** The class list for one strand (and sub-strand) with each learner's level so far. */
export const GET = route('cbc grid', { ...MODULE, permission: ['cbc.assess', 'cbc.view'] }, async ({ access, request }) => {
    const p = params(request.nextUrl.searchParams);
    await Promise.all([
        assertInSchool('grade_streams', [p.stream], access.schoolId),
        assertInSchool('terms', [p.term], access.schoolId),
    ]);
    const db = createSupabaseAdmin();
    const [{ data: students, error }, { data: marks, error: marksError }] = await Promise.all([
        db.from('students').select('id, admission_number, user:users(first_name, last_name)')
            .eq('school_id', access.schoolId).eq('current_grade_stream_id', p.stream).eq('status', 'ACTIVE').order('admission_number'),
        db.from('competency_assessments').select('student_id, level, comment')
            .eq('school_id', access.schoolId).eq('subject_id', p.subject).eq('term_id', p.term).eq('strand', p.strand).eq('sub_strand', p.subStrand),
    ]);
    if (error || marksError) throw error ?? marksError;
    const byStudent = new Map((marks ?? []).map(m => [m.student_id as string, m]));
    return (students ?? []).map((s): RubricRow => {
        const u = embedOne<{ first_name: string; last_name: string }>(s.user);
        const m = byStudent.get(s.id as string);
        return {
            studentId: s.id as string,
            name: `${u?.first_name ?? ''} ${u?.last_name ?? ''}`.trim(),
            admissionNumber: (s.admission_number as string | null) ?? null,
            level: (m?.level as RubricRow['level']) ?? null,
            comment: (m?.comment as string | null) ?? null,
        };
    });
});

const saveSchema = z.object({
    grade_stream_id: z.string().uuid(),
    subject_id: z.string().uuid(),
    term_id: z.string().uuid(),
    strand: z.string().trim().min(1).max(200),
    sub_strand: z.string().trim().max(200).default(''),
    rows: z.array(z.object({
        student_id: z.string().min(1).max(100),
        level: z.enum(CBC_LEVELS).nullable(),
        comment: z.string().trim().max(500).nullable().optional(),
    })).max(300),
});

/** Saves the grid: a level per learner (clearing one removes it). */
export const PUT = route('cbc save', { ...MODULE, permission: 'cbc.assess' }, async ({ access, request }) => {
    const body = await parseBody(request, saveSchema);
    const db = createSupabaseAdmin();
    await Promise.all([
        assertInSchool('grade_streams', [body.grade_stream_id], access.schoolId),
        assertInSchool('terms', [body.term_id], access.schoolId),
        assertInSchool('school_subject_catalogue', [body.subject_id], access.schoolId),
    ]);
    const { data: roster, error } = await db.from('students').select('id').eq('school_id', access.schoolId).eq('current_grade_stream_id', body.grade_stream_id);
    if (error) throw error;
    const inClass = new Set((roster ?? []).map(r => r.id as string));
    if (body.rows.some(r => !inClass.has(r.student_id))) throw new HttpError(400, 'Some learners are not in this class.');

    const key = { school_id: access.schoolId, subject_id: body.subject_id, term_id: body.term_id, strand: body.strand, sub_strand: body.sub_strand };
    const set = body.rows.filter(r => r.level);
    const cleared = body.rows.filter(r => !r.level).map(r => r.student_id);
    if (set.length > 0) {
        const { error: upError } = await db.from('competency_assessments').upsert(
            set.map(r => ({ ...key, student_id: r.student_id, level: r.level, comment: r.comment ?? null, assessed_by: access.userId, assessed_on: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })),
            { onConflict: 'student_id,subject_id,term_id,strand,sub_strand' },
        );
        if (upError) throw upError;
    }
    if (cleared.length > 0) {
        const { error: delError } = await db.from('competency_assessments').delete()
            .match(key).in('student_id', cleared);
        if (delError) throw delError;
    }
    return { saved: set.length, cleared: cleared.length };
});
