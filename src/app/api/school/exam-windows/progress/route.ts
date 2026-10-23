import { NextRequest, NextResponse } from 'next/server';
import { getAccess } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows, isUuid } from '@/lib/postgrest';
import { findActiveTermId } from '@/lib/term-calendar';
import { readExamWindows } from '@/lib/exam-windows-server';
import { classAssignments, assignmentKey } from '@/lib/timetable/assignments';
import type { MarkingBoardCell, MarkingBoardGrade, MarkingBoardResponse, MarkingBoardSubject } from '@/lib/marking-board';

/**
 * GET ?term_id= (default: the active term) — the marking board: for each
 * class's open exam, marks entered against learners expected per subject and
 * stream, with who teaches it. For those who open exams (marking.open).
 *
 * Expected learners follow the mark sheet: the whole stream for a CORE
 * subject, otherwise those enrolled in it plus anyone already marked.
 */

type Db = ReturnType<typeof createSupabaseAdmin>;

/** Ids per `.in()` filter, so the request URL stays short. */
const ID_CHUNK = 100;

interface ExamRow {
    id: string;
    grade_id: string;
    grade_stream_id: string | null;
    subject_id: string;
    exam_type: string;
    subjects: { name: string; subject_type: string | null } | { name: string; subject_type: string | null }[] | null;
    grades: { name_display: string } | { name_display: string }[] | null;
}

function chunks<T>(items: readonly T[]): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += ID_CHUNK) out.push(items.slice(i, i + ID_CHUNK));
    return out;
}

async function readPaged<T>(what: string, build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }): Promise<T[]> {
    const { rows, error } = await fetchAllRows<T>(build);
    if (error) throw new Error(`Could not load ${what}`);
    return rows;
}

async function teacherNames(supabase: Db, schoolId: string, ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await supabase.from('users').select('id, first_name, last_name').eq('school_id', schoolId).in('id', [...ids]);
    if (error) throw new Error('Could not load teachers');
    return new Map((data ?? []).map(u => [u.id as string, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'A teacher']));
}

export async function GET(request: NextRequest) {
    const access = await getAccess();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!access.can('marking.open')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const requested = new URL(request.url).searchParams.get('term_id');
    if (requested && !isUuid(requested)) return NextResponse.json({ error: 'Invalid term id' }, { status: 400 });

    try {
        const supabase = createSupabaseAdmin();
        const { schoolId } = access;
        const { data: terms, error: termsError } = await supabase
            .from('terms')
            .select('id, name, start_date, end_date, is_current')
            .eq('school_id', schoolId);
        if (termsError) throw new Error('Could not load terms');
        const termId = requested ?? findActiveTermId(terms ?? []);
        if (!termId || !(terms ?? []).some(t => t.id === termId)) {
            return NextResponse.json({ termId: null, grades: [] } satisfies MarkingBoardResponse);
        }

        const windows = await readExamWindows(supabase, schoolId, termId);
        if (windows.length === 0) return NextResponse.json({ termId, grades: [] } satisfies MarkingBoardResponse);
        const openType = new Map(windows.map(w => [w.grade_id, w.exam_type]));
        const gradeIds = [...openType.keys()];

        // Side by side: each is a round trip to the database.
        const [examRows, streamsResult, assigned] = await Promise.all([
            readPaged<ExamRow>('exams', () => supabase
                .from('exams')
                .select('id, grade_id, grade_stream_id, subject_id, exam_type, subjects:subject_id ( name, subject_type ), grades:grade_id ( name_display )')
                .eq('school_id', schoolId)
                .eq('term_id', termId)
                .in('grade_id', gradeIds)
                .order('id')),
            supabase.from('grade_streams').select('id, grade_id, full_name').eq('school_id', schoolId).in('grade_id', gradeIds),
            classAssignments(supabase, schoolId),
        ]);
        if (streamsResult.error) throw new Error('Could not load classes');

        const exams = examRows.filter(e => openType.get(e.grade_id) === e.exam_type);
        const streams = (streamsResult.data ?? []).map(s => ({ id: s.id as string, gradeId: s.grade_id as string, name: s.full_name as string }));
        if (exams.length === 0 || streams.length === 0) return NextResponse.json({ termId, grades: [] } satisfies MarkingBoardResponse);

        const optional = [...new Set(exams.filter(e => embedOne(e.subjects)?.subject_type !== 'CORE').map(e => e.subject_id))];
        const streamIds = streams.map(s => s.id);
        const [students, enrolments, markChunks] = await Promise.all([
            readPaged<{ id: string; current_grade_stream_id: string }>('learners', () => supabase
                .from('students')
                .select('id, current_grade_stream_id')
                .in('current_grade_stream_id', streamIds)
                .order('id')),
            optional.length === 0 ? Promise.resolve([]) : readPaged<{ student_id: string; subject_id: string }>('subject enrolments', () => supabase
                .from('student_subjects')
                .select('student_id, subject_id, students!inner(current_grade_stream_id)')
                .in('subject_id', optional)
                .in('students.current_grade_stream_id', streamIds)
                .order('id')),
            Promise.all(chunks(exams.map(e => e.id)).map(ids => readPaged<{ exam_id: string; student_id: string }>('marks', () => supabase
                .from('exam_marks')
                .select('exam_id, student_id')
                .in('exam_id', ids)
                .order('id')))),
        ]);

        const streamOf = new Map(students.map(s => [s.id, s.current_grade_stream_id]));
        const classSize = new Map<string, number>();
        for (const s of students) classSize.set(s.current_grade_stream_id, (classSize.get(s.current_grade_stream_id) ?? 0) + 1);
        const enrolled = new Map<string, Set<string>>(); // subject → learners
        for (const e of enrolments) enrolled.set(e.subject_id, (enrolled.get(e.subject_id) ?? new Set()).add(e.student_id));
        const marked = new Map<string, Set<string>>(); // exam → learners
        for (const m of markChunks.flat()) marked.set(m.exam_id, (marked.get(m.exam_id) ?? new Set()).add(m.student_id));

        const teacherIds = new Set<string>();
        for (const a of assigned.values()) for (const t of a.teachers) teacherIds.add(t);
        const names = await teacherNames(supabase, schoolId, [...teacherIds]);

        const grades = new Map<string, MarkingBoardGrade>();
        const subjectsOf = new Map<string, Map<string, MarkingBoardSubject>>();
        for (const stream of streams) {
            // A stream's own paper wins over the grade-wide one.
            const papers = new Map<string, ExamRow>();
            for (const e of exams) {
                if (e.grade_id !== stream.gradeId) continue;
                if (e.grade_stream_id === stream.id) papers.set(e.subject_id, e);
                else if (!e.grade_stream_id && !papers.has(e.subject_id)) papers.set(e.subject_id, e);
            }
            if (papers.size === 0) continue;

            const first = exams.find(e => e.grade_id === stream.gradeId);
            const grade = grades.get(stream.gradeId) ?? {
                gradeId: stream.gradeId,
                gradeName: embedOne(first?.grades)?.name_display ?? 'Class',
                examType: openType.get(stream.gradeId) ?? '',
                streams: [],
                subjects: [],
                entered: 0,
                expected: 0,
            };
            grade.streams.push({ id: stream.id, name: stream.name });
            const subjects = subjectsOf.get(stream.gradeId) ?? new Map<string, MarkingBoardSubject>();

            for (const [subjectId, exam] of papers) {
                const inStream = (id: string) => streamOf.get(id) === stream.id;
                const markedHere = [...(marked.get(exam.id) ?? [])].filter(inStream);
                const isCore = embedOne(exam.subjects)?.subject_type === 'CORE';
                const expected = isCore
                    ? classSize.get(stream.id) ?? 0
                    : new Set([...[...(enrolled.get(subjectId) ?? [])].filter(inStream), ...markedHere]).size;
                const cell: MarkingBoardCell = {
                    examId: exam.id,
                    entered: markedHere.length,
                    expected,
                    teachers: [...(assigned.get(assignmentKey(stream.id, subjectId))?.teachers ?? [])].map(t => names.get(t) ?? 'A teacher'),
                };
                const subject = subjects.get(subjectId) ?? { id: subjectId, name: embedOne(exam.subjects)?.name ?? 'Subject', cells: {} };
                subject.cells[stream.id] = cell;
                subjects.set(subjectId, subject);
                grade.entered += cell.entered;
                grade.expected += cell.expected;
            }
            subjectsOf.set(stream.gradeId, subjects);
            grades.set(stream.gradeId, grade);
        }

        const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });
        const body: MarkingBoardResponse = {
            termId,
            grades: [...grades.values()]
                .map(g => ({
                    ...g,
                    streams: g.streams.sort(byName),
                    // Subjects nobody sits in any stream (an elective this level doesn't take) are left out.
                    subjects: [...(subjectsOf.get(g.gradeId)?.values() ?? [])]
                        .filter(s => Object.values(s.cells).some(c => c.expected > 0))
                        .sort(byName),
                }))
                .sort((a, b) => a.gradeName.localeCompare(b.gradeName, undefined, { numeric: true })),
        };
        return NextResponse.json(body);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load marking progress' }, { status: 500 });
    }
}
