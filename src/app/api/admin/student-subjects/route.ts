import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';
import { canManageStream, getCaller } from '@/lib/auth-server';
import { internalError } from '@/lib/api-errors';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { isSubjectOfferedAtGrade } from '@/lib/curriculum-bands';
import type { SubjectRosterEntry } from '@/lib/subject-roster-types';

/** Postgres URLs cap how many ids fit in one `.in()` filter; stay well under. */
const ID_CHUNK = 200;
const MAX_CHANGES = 3000;

const chunks = <T,>(items: readonly T[], size = ID_CHUNK): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

interface StudentRow {
    id: string;
    admission_number: string | null;
    current_grade_stream_id: string | null;
    subject_combination_id: string | null;
    users: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
    grade_streams: GradeStreamEmbed | GradeStreamEmbed[] | null;
}
interface GradeStreamEmbed {
    id: string;
    full_name: string;
    grades: { code: string | null; name_display: string | null } | { code: string | null; name_display: string | null }[] | null;
}

/**
 * GET — who can take a subject, and who does: the school's enrolled learners
 * in the grades the subject is taught in, each with an `enrolled` flag.
 *
 * Filtering on the curriculum alone listed every CBC learner from Grade 1 up
 * for a Grade 10 elective (CBC is one academic level from Pre-Primary to
 * Grade 12), so "tick all" enrolled primary pupils in Physics.
 */
export async function GET(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller?.schoolId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].includes(caller.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const schoolId = caller.schoolId;

        const subjectId = request.nextUrl.searchParams.get('subject_id');
        if (!subjectId) return NextResponse.json({ error: 'subject_id is required' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { data: subject } = await supabase
            .from(SCHOOL_SUBJECT_VIEW)
            .select('id, name, code, subject_type, academic_level_id')
            .eq('id', subjectId)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (!subject) return NextResponse.json({ error: 'That subject is not offered by your school.' }, { status: 404 });

        const [studentsRes, enrolledRes] = await Promise.all([
            fetchAllRows<StudentRow>(() => supabase
                .from('students')
                .select('id, admission_number, current_grade_stream_id, subject_combination_id, users!inner ( first_name, last_name ), grade_streams ( id, full_name, grades ( code, name_display ) )')
                .eq('school_id', schoolId)
                .eq('status', 'ACTIVE')
                .eq('academic_level_id', subject.academic_level_id)
                .order('id')),
            fetchAllRows<{ student_id: string }>(() => supabase
                .from('student_subjects')
                .select('student_id')
                .eq('school_id', schoolId)
                .eq('subject_id', subjectId)
                .order('student_id')),
        ]);
        const failed = studentsRes.error ?? enrolledRes.error;
        if (failed) return internalError('student-subjects GET', failed);

        const enrolled = new Set(enrolledRes.rows.map(r => r.student_id));
        const data: SubjectRosterEntry[] = studentsRes.rows
            .map(s => ({ s, stream: embedOne(s.grade_streams) }))
            // Only learners in a grade the subject is taught in.
            .filter(({ stream }) => isSubjectOfferedAtGrade(subject, embedOne(stream?.grades ?? null)))
            .map(({ s, stream }) => {
                const user = embedOne(s.users);
                return {
                    id: s.id,
                    admission_number: s.admission_number,
                    name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Student',
                    stream_id: stream?.id ?? null,
                    stream_name: stream?.full_name ?? null,
                    in_combination: !!s.subject_combination_id,
                    enrolled: enrolled.has(s.id),
                };
            })
            .sort((a, b) => (a.stream_name ?? '').localeCompare(b.stream_name ?? '') || a.name.localeCompare(b.name));

        return NextResponse.json({ subject, data });
    } catch (err: unknown) {
        return internalError('student-subjects GET', err);
    }
}

const changeSchema = z.object({
    subject_id: z.string().min(1, 'subject_id is required'),
    add: z.array(z.string().uuid()).max(MAX_CHANGES).default([]),
    remove: z.array(z.string().uuid()).max(MAX_CHANGES).default([]),
}).refine(b => b.add.length + b.remove.length > 0, 'Nothing to change');

/**
 * POST — add/remove students from a subject's roster.
 * Body: { subject_id, add: string[], remove: string[] }
 *
 * A class teacher may only change learners in their own class. For CBC
 * learners on a subject combination, manual tweaks to combination subjects
 * are overwritten the next time the combination is re-synced.
 */
export async function POST(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller?.schoolId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER') {
            return NextResponse.json({ error: 'Only admins and class teachers can manage subject enrollment.' }, { status: 403 });
        }
        const schoolId = caller.schoolId;

        const parsed = changeSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
        }
        const { subject_id: subjectId, add, remove } = parsed.data;

        const supabase = createSupabaseAdmin();
        const { data: subject } = await supabase
            .from(SCHOOL_SUBJECT_VIEW)
            .select('id, subject_type')
            .eq('id', subjectId)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (!subject) return NextResponse.json({ error: 'That subject is not offered by your school.' }, { status: 404 });

        // Every touched student must be in the caller's school (and, for a
        // class teacher, their class).
        const touched = [...new Set([...add, ...remove])];
        const found = new Map<string, string | null>();
        for (const ids of chunks(touched)) {
            const { data, error } = await supabase
                .from('students')
                .select('id, current_grade_stream_id')
                .eq('school_id', schoolId)
                .in('id', ids);
            if (error) return internalError('student-subjects POST lookup', error);
            for (const s of data ?? []) found.set(s.id, s.current_grade_stream_id);
        }
        const missing = touched.filter(id => !found.has(id));
        if (missing.length > 0) {
            return NextResponse.json({ error: `${missing.length} student(s) were not found in your school.` }, { status: 400 });
        }
        if (touched.some(id => !canManageStream(caller, found.get(id)))) {
            return NextResponse.json({ error: 'You can only change subjects for learners in your own class.' }, { status: 403 });
        }

        const role = subject.subject_type === 'CORE' ? 'CORE' : 'ELECTIVE';
        for (const ids of chunks(add)) {
            const { error } = await supabase.from('student_subjects').upsert(
                ids.map(studentId => ({ student_id: studentId, subject_id: subjectId, role, school_id: schoolId })),
                { onConflict: 'student_id,subject_id' },
            );
            if (error) return internalError('student-subjects POST add', error);
        }
        for (const ids of chunks(remove)) {
            const { error } = await supabase.from('student_subjects').delete().eq('subject_id', subjectId).in('student_id', ids);
            if (error) return internalError('student-subjects POST remove', error);
        }

        return NextResponse.json({ success: true, added: add.length, removed: remove.length });
    } catch (err: unknown) {
        return internalError('student-subjects POST', err);
    }
}
