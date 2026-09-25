import { NextRequest, NextResponse } from 'next/server';
import { authorizeClassReport } from '@/lib/reports/report-access';
import { termBelongsToSchool } from '@/lib/tenant-scope';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { getExamType } from '@/lib/exam-types';
import { isUuid } from '@/lib/postgrest';
import { selectExamRound, type ReportRound, type ReportRoundsResponse } from '@/lib/reports/exam-round';

/** PostgREST returns at most this many rows per request. */
const PAGE = 1000;

interface ExamRow {
    id: string;
    exam_type: string | null;
    exam_date: string | null;
    created_at: string | null;
    subject_id: string | null;
}

/**
 * The rounds (Opener, Midterm, End Term, …) a class can be reported on for a
 * term, with how much of each is entered and which one "most recent" picks.
 *
 * The report page used to offer a plain "Most recent per subject" default and
 * leave the choice to the report routes, which read every mark in the term in
 * one request. That request stops at 1,000 rows, so a full class with a few
 * rounds entered decided "most recent" from an arbitrary slice. Here the
 * marks are paged, and the page shows and sends the round explicitly.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const streamId = searchParams.get('grade_stream_id') ?? '';
        const termId = searchParams.get('term_id') ?? '';
        if (!isUuid(streamId) || !isUuid(termId)) {
            return NextResponse.json({ error: 'grade_stream_id and term_id are required' }, { status: 400 });
        }

        const access = await authorizeClassReport(streamId, 'Only administrators and the designated class teacher can generate class reports.');
        if (!access.ok) return access.response;
        if (!(await termBelongsToSchool(termId, access.session.schoolId))) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        const supabase = createSupabaseAdmin();
        const [{ data: stream, error: streamError }, { data: students, error: studentsError }] = await Promise.all([
            supabase.from('grade_streams').select('grade_id').eq('id', streamId).maybeSingle(),
            supabase.from('students').select('id').eq('current_grade_stream_id', streamId),
        ]);
        if (streamError) return internalError('report rounds stream', streamError);
        if (studentsError) return internalError('report rounds students', studentsError);

        // The class's own exams plus grade-wide ones, as the report routes use.
        let examsQuery = supabase
            .from('exams')
            .select('id, exam_type, exam_date, created_at, subject_id')
            .eq('term_id', termId);
        examsQuery = stream?.grade_id
            ? examsQuery.eq('grade_id', stream.grade_id).or(`grade_stream_id.is.null,grade_stream_id.eq.${streamId}`)
            : examsQuery.eq('grade_stream_id', streamId);
        const { data: examData, error: examsError } = await examsQuery;
        if (examsError) return internalError('report rounds exams', examsError);

        const exams = ((examData ?? []) as ExamRow[]).filter(e => e.exam_type);
        const studentIds = (students ?? []).map(s => s.id as string);
        const empty: ReportRoundsResponse = { rounds: [], suggested: null };
        if (exams.length === 0) return NextResponse.json(empty);

        // Every mark for these exams and learners, a page at a time.
        const marks: { exam_id: string }[] = [];
        if (studentIds.length > 0) {
            for (let from = 0; ; from += PAGE) {
                const { data, error } = await supabase
                    .from('exam_marks')
                    .select('exam_id')
                    .in('exam_id', exams.map(e => e.id))
                    .in('student_id', studentIds)
                    .order('id')
                    .range(from, from + PAGE - 1);
                if (error) return internalError('report rounds marks', error);
                marks.push(...((data ?? []) as { exam_id: string }[]));
                if (!data || data.length < PAGE) break;
            }
        }

        const examById = new Map(exams.map(e => [e.id, e]));
        const byRound = new Map<string, { subjects: Set<string>; marked: Set<string>; marks: number; date: string | null }>();
        for (const e of exams) {
            const type = e.exam_type as string;
            const round = byRound.get(type) ?? { subjects: new Set<string>(), marked: new Set<string>(), marks: 0, date: null };
            round.subjects.add(e.subject_id ?? e.id);
            const when = e.exam_date ?? e.created_at?.slice(0, 10) ?? null;
            if (when && (!round.date || when > round.date)) round.date = when;
            byRound.set(type, round);
        }
        for (const m of marks) {
            const exam = examById.get(m.exam_id);
            const round = exam?.exam_type ? byRound.get(exam.exam_type) : undefined;
            if (!exam || !round) continue;
            round.marks++;
            round.marked.add(exam.subject_id ?? exam.id);
        }

        // Same rule the report routes apply to an unspecified round.
        const { round: suggested } = selectExamRound(marks.map(m => {
            const exam = examById.get(m.exam_id)!;
            return { exams: { id: exam.id, exam_type: exam.exam_type, exam_date: exam.exam_date, created_at: exam.created_at, subjects: { id: exam.subject_id } } };
        }));

        const rounds: ReportRound[] = [...byRound.entries()]
            .map(([type, r]) => ({
                exam_type: type,
                label: getExamType(type)?.shortName ?? type,
                subjects_total: r.subjects.size,
                subjects_with_marks: r.marked.size,
                marks: r.marks,
                date: r.date,
            }))
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.label.localeCompare(b.label));

        const body: ReportRoundsResponse = { rounds, suggested: marks.length > 0 ? suggested : null };
        return NextResponse.json(body);
    } catch (err) {
        return internalError('report rounds', err);
    }
}
