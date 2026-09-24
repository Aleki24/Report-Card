import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { TEACHER_ROLES, isRoleIn } from '@/lib/roles';
import { findActiveTermId } from '@/lib/term-calendar';
import { canTeacherMarkStudent, getTeacherPermissions, isExamVisibleToTeacher } from '@/lib/teacher-utils';
import { subjectTakers } from '@/lib/subject-roster';
import type { ExamWorkflowStatus, MarkingProgressItem, MarkingProgressResponse } from '@/lib/marking-progress';

const PAGE = 1000;

type Embedded<T> = T | T[] | null;
const one = <T,>(value: Embedded<T> | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

interface ExamRow {
    id: string;
    name: string;
    exam_type: string;
    grade_id: string;
    grade_stream_id: string | null;
    subject_id: string;
    term_id: string;
    status: ExamWorkflowStatus | null;
    created_by_teacher_id: string | null;
    subjects: Embedded<{ name: string }>;
    grades: Embedded<{ name_display: string }>;
    grade_streams: Embedded<{ full_name: string }>;
}

interface StudentRow { id: string; current_grade_stream_id: string | null; }

/** Read every page of a query — PostgREST caps a response at 1,000 rows. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await page(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) return rows;
    }
}

/**
 * The signed-in teacher's exams for the current term, each with how many of
 * their learners already have a mark. Drives the "My marking" panel on the
 * teacher dashboard, so a teacher sees what is left and opens it in one tap.
 */
export async function GET() {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!isRoleIn(caller.baseRole, TEACHER_ROLES) || !caller.schoolId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { userId, schoolId } = caller;
        const supabase: SupabaseClient = createSupabaseAdmin();

        const { data: terms, error: termsError } = await supabase
            .from('terms')
            .select('id, name, start_date, end_date, is_current')
            .eq('school_id', schoolId)
            .order('start_date');
        if (termsError) throw new Error(termsError.message);

        const termId = findActiveTermId(terms ?? []);
        const term = (terms ?? []).find(t => t.id === termId);
        const empty: MarkingProgressResponse = { term: term ? { id: term.id, name: term.name } : null, items: [] };
        if (!term) return NextResponse.json(empty);

        const { data: examRows, error: examsError } = await supabase
            .from('exams')
            .select(`
                id, name, exam_type, grade_id, grade_stream_id, subject_id, term_id, status, created_by_teacher_id,
                subjects:subject_id ( name ),
                grades:grade_id ( name_display ),
                grade_streams:grade_stream_id ( full_name )
            `)
            .eq('school_id', schoolId)
            .eq('term_id', term.id);
        if (examsError) throw new Error(examsError.message);

        const perms = await getTeacherPermissions(userId);
        const exams = ((examRows ?? []) as unknown as ExamRow[]).filter(e => isExamVisibleToTeacher(e, perms, userId));
        if (exams.length === 0) return NextResponse.json(empty);

        // Learners in every stream these exams reach.
        const gradeIds = [...new Set(exams.map(e => e.grade_id))];
        const { data: streams, error: streamsError } = await supabase.from('grade_streams').select('id, grade_id').in('grade_id', gradeIds);
        if (streamsError) throw new Error(streamsError.message);
        const gradeOfStream = new Map((streams ?? []).map(s => [s.id as string, s.grade_id as string]));
        const streamIds = [...gradeOfStream.keys()];
        const students = streamIds.length === 0 ? [] : await readAll<StudentRow>((from, to) => supabase
            .from('students')
            .select('id, current_grade_stream_id')
            .in('current_grade_stream_id', streamIds)
            .order('id')
            .range(from, to));

        // Marks already entered for these exams.
        const examIds = exams.map(e => e.id);
        const marks = await readAll<{ exam_id: string; student_id: string }>((from, to) => supabase
            .from('exam_marks')
            .select('exam_id, student_id')
            .in('exam_id', examIds)
            .order('id')
            .range(from, to));
        const markedByExam = new Map<string, Set<string>>();
        for (const m of marks) {
            const set = markedByExam.get(m.exam_id) ?? new Set<string>();
            set.add(m.student_id);
            markedByExam.set(m.exam_id, set);
        }

        // The learners this teacher records each exam's subject for — the same
        // roster the mark sheet shows (stream scope, then subject takers).
        const rosterCache = new Map<string, string[]>();
        const items: MarkingProgressItem[] = [];
        for (const exam of exams) {
            const cacheKey = `${exam.subject_id}:${exam.grade_id}:${exam.grade_stream_id ?? ''}`;
            let roster = rosterCache.get(cacheKey);
            if (!roster) {
                const inClass = students.filter(s => {
                    const streamId = s.current_grade_stream_id;
                    if (!streamId) return false;
                    if (exam.grade_stream_id ? streamId !== exam.grade_stream_id : gradeOfStream.get(streamId) !== exam.grade_id) return false;
                    return exam.created_by_teacher_id === userId
                        || canTeacherMarkStudent(perms, exam.subject_id, { current_grade_stream_id: streamId, grade_id: gradeOfStream.get(streamId) ?? null });
                });
                roster = (await subjectTakers(supabase, exam.subject_id, inClass)).students.map(s => s.id);
                rosterCache.set(cacheKey, roster);
            }
            const marked = markedByExam.get(exam.id) ?? new Set<string>();
            items.push({
                examId: exam.id,
                examName: exam.name,
                examType: exam.exam_type,
                subjectId: exam.subject_id,
                subjectName: one(exam.subjects)?.name ?? 'Subject',
                className: one(exam.grade_streams)?.full_name ?? one(exam.grades)?.name_display ?? 'Class',
                termId: exam.term_id,
                status: exam.status ?? 'DRAFT',
                entered: roster.filter(id => marked.has(id)).length,
                expected: roster.length,
            });
        }

        items.sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.className.localeCompare(b.className, undefined, { numeric: true }));
        const body: MarkingProgressResponse = { term: { id: term.id, name: term.name }, items };
        return NextResponse.json(body);
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}
