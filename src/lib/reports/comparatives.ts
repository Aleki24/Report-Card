/**
 * The comparative figures a report card needs beyond this round's marks.
 *
 * A mark on its own tells a parent very little: 72% is excellent in one
 * subject and middling in another, and it means something different again if
 * the learner scored 60% last time. Three cheap comparisons turn the card into
 * an account of progress:
 *
 *   • the class mean per subject — how the learner sits against the room,
 *   • the previous round's marks — the deviation printed beside each subject,
 *   • the subject teacher — who to talk to about it.
 *
 * Every function here is best-effort: a school with one exam, no teacher
 * assignments or a single learner still gets a report card, just without the
 * comparison. Callers treat a null/empty result as "nothing to show".
 */
import {
    aggregateStudentPerformance,
    calculateClassRanks,
    type ExamMarkWithDetails,
} from '@/lib/analytics';
import type { GradingScale } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/* The service-role client the report routes already hold. Rows come back
   untyped from PostgREST, so each query names the shape it expects. */
type Supabase = SupabaseClient;

interface AssignmentRow {
    subject_id: string | null;
    grade_stream_id: string | null;
    subject_teacher_id: string | null;
}
interface TeacherRow { id: string; user_id: string | null }
interface UserRow { id: string; first_name: string | null; last_name: string | null }
interface ExamRow {
    id: string;
    max_score: number | string | null;
    subjects: { id: string; name: string | null; category: string | null } | null;
}
interface PreviousMarkRow {
    student_id: string;
    raw_score: number | string | null;
    grade_symbol: string | null;
    exam_id: string;
}

/* ── Class averages ───────────────────────────────────────── */

/**
 * Mean mark per subject, from the same per-subject aggregation the routes
 * already build for ranking. subjectId → mean percentage (one decimal).
 */
export function subjectClassAverages(
    subjectAggs: Record<string, { studentId: string; pct: number }[]>
): Map<string, number> {
    const averages = new Map<string, number>();
    for (const [subjectId, entries] of Object.entries(subjectAggs)) {
        if (entries.length === 0) continue;
        const mean = entries.reduce((sum, e) => sum + e.pct, 0) / entries.length;
        averages.set(subjectId, Math.round(mean * 10) / 10);
    }
    return averages;
}

/** Mean of every ranked learner's overall percentage, to one decimal. */
export function overallClassMean(aggregates: { percentage: number }[]): number | undefined {
    if (aggregates.length === 0) return undefined;
    const mean = aggregates.reduce((sum, a) => sum + a.percentage, 0) / aggregates.length;
    return Math.round(mean * 10) / 10;
}

/* ── Subject teachers ─────────────────────────────────────── */

/**
 * subjectId → the teacher's name, for the grade the report belongs to.
 *
 * An assignment with no stream teaches every stream of the grade, so a
 * stream-specific assignment always wins over the grade-wide one. Resolved in
 * three small lookups rather than one nested select, which keeps it working
 * regardless of how PostgREST names the relationships.
 */
export async function fetchSubjectTeachers(
    supabase: Supabase,
    { gradeId, gradeStreamId, yearId }: { gradeId?: string | null; gradeStreamId?: string | null; yearId?: string | null }
): Promise<Map<string, string>> {
    const bySubject = new Map<string, string>();
    if (!gradeId) return bySubject;

    try {
        let query = supabase
            .from('subject_teacher_assignments')
            .select('subject_id, grade_stream_id, subject_teacher_id')
            .eq('grade_id', gradeId);
        if (yearId) query = query.eq('academic_year_id', yearId);
        const assignments = ((await query).data || []) as AssignmentRow[];
        if (assignments.length === 0) return bySubject;

        // Grade-wide assignments (no stream) apply to this stream too.
        const relevant = assignments.filter(
            a => !a.grade_stream_id || !gradeStreamId || a.grade_stream_id === gradeStreamId
        );
        if (relevant.length === 0) return bySubject;

        const teacherIds = [...new Set(relevant.map(a => a.subject_teacher_id).filter((id): id is string => !!id))];
        if (teacherIds.length === 0) return bySubject;

        const { data: teacherData } = await supabase
            .from('subject_teachers')
            .select('id, user_id')
            .in('id', teacherIds);
        const userIdByTeacher = new Map<string, string>(
            ((teacherData || []) as TeacherRow[])
                .filter(t => !!t.user_id)
                .map(t => [t.id, t.user_id as string])
        );

        const userIds = [...new Set(userIdByTeacher.values())];
        if (userIds.length === 0) return bySubject;

        const { data: userData } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', userIds);
        const nameByUser = new Map<string, string>(
            ((userData || []) as UserRow[]).map(u => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim()])
        );

        for (const a of relevant) {
            const name = nameByUser.get(userIdByTeacher.get(a.subject_teacher_id || '') || '');
            if (!name || !a.subject_id) continue;
            // Stream-specific wins; otherwise first one seen holds.
            if (a.grade_stream_id || !bySubject.has(a.subject_id)) {
                bySubject.set(a.subject_id, name);
            }
        }
    } catch {
        // A missing assignment table or a permissions problem must never stop
        // a report card being produced — the card simply omits teacher names.
    }
    return bySubject;
}

/* ── Previous round ───────────────────────────────────────── */

export interface PreviousRoundStats {
    /** Printable name of the round being compared against, e.g. "Mid Term". */
    label: string;
    /** `${studentId}|${subjectId}` → that learner's percentage, rounded. */
    subjectPercentage: Map<string, number>;
    /** studentId → their overall figures for that round. */
    overall: Map<string, { percentage: number; totalPoints: number; rank: number }>;
}

/** MID_TERM → "Mid Term"; already-pretty names pass through unchanged. */
function roundLabel(examType: string | null | undefined, fallback: string): string {
    if (!examType) return fallback;
    return examType
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

/**
 * The round of exams immediately preceding the one on the report card, with
 * every learner's marks in it.
 *
 * "Preceding" is by exam creation time within the grade, so it crosses terms
 * naturally: an Opener card compares against last term's End Term, a Mid Term
 * card against this term's Opener. Returns null when there is no earlier round,
 * or when the only earlier exams belong to the round already being printed.
 */
export async function fetchPreviousRound(
    supabase: Supabase,
    {
        studentIds,
        gradeId,
        before,
        current,
        gradingScales,
        gradingSystemType,
    }: {
        studentIds: string[];
        gradeId?: string | null;
        /** ISO timestamp — only exams created strictly before this count. */
        before?: string | null;
        /** The round on the card, so it can't be compared against itself. */
        current: { termId?: string | null; examType?: string | null };
        gradingScales: GradingScale[];
        gradingSystemType: 'KCSE' | 'CBC';
    }
): Promise<PreviousRoundStats | null> {
    if (!gradeId || !before || studentIds.length === 0) return null;

    try {
        const { data: previous } = await supabase
            .from('exams')
            .select('id, name, exam_type, term_id, created_at')
            .eq('grade_id', gradeId)
            .lt('created_at', before)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!previous) return null;
        // Same sitting as the one being printed — nothing to compare.
        if (previous.term_id === current.termId && previous.exam_type === current.examType) return null;

        const { data: roundExams } = await supabase
            .from('exams')
            .select('id, max_score, subjects(id, name, category)')
            .eq('grade_id', gradeId)
            .eq('term_id', previous.term_id)
            .eq('exam_type', previous.exam_type);

        if (!roundExams || roundExams.length === 0) return null;

        const examMeta = new Map<string, { subjectId: string; maxScore: number }>();
        const subjectNames: Record<string, string> = {};
        const subjectCategories: Record<string, string> = {};
        for (const exam of (roundExams || []) as unknown as ExamRow[]) {
            const subject = exam.subjects;
            if (!subject?.id) continue;
            examMeta.set(exam.id, { subjectId: subject.id, maxScore: Number(exam.max_score) || 100 });
            if (subject.name) subjectNames[subject.id] = subject.name;
            if (subject.category) subjectCategories[subject.id] = subject.category;
        }
        if (examMeta.size === 0) return null;

        const { data: marks } = await supabase
            .from('exam_marks')
            .select('student_id, raw_score, grade_symbol, exam_id')
            .in('exam_id', [...examMeta.keys()])
            .in('student_id', studentIds);

        if (!marks || marks.length === 0) return null;

        const subjectPercentage = new Map<string, number>();
        const byStudent = new Map<string, ExamMarkWithDetails[]>();

        for (const mark of marks as unknown as PreviousMarkRow[]) {
            const meta = examMeta.get(mark.exam_id);
            if (!meta) continue;
            const rawScore = Number(mark.raw_score);
            if (!Number.isFinite(rawScore)) continue;
            const pct = meta.maxScore > 0 ? (rawScore / meta.maxScore) * 100 : 0;
            subjectPercentage.set(`${mark.student_id}|${meta.subjectId}`, Math.round(pct));

            const list = byStudent.get(mark.student_id) || [];
            list.push({
                id: '',
                student_id: mark.student_id,
                exam_id: mark.exam_id,
                subject_id: meta.subjectId,
                raw_score: rawScore,
                percentage: pct,
                max_score: meta.maxScore,
                grade_symbol: mark.grade_symbol ?? undefined,
            });
            byStudent.set(mark.student_id, list);
        }

        // Same aggregation the current round uses, so "last time" and "this
        // time" are measured the same way and the deviation means something.
        const aggregates = [...byStudent.entries()].map(([studentId, studentMarks]) => {
            const perf = aggregateStudentPerformance(
                studentMarks, gradingScales, gradingSystemType, subjectNames, subjectCategories
            );
            return { studentId, percentage: perf.percentage, totalPoints: perf.totalPoints };
        });

        const ranks = calculateClassRanks(
            aggregates, gradingSystemType === 'KCSE' ? 'points' : 'percentage'
        );

        const overall = new Map<string, { percentage: number; totalPoints: number; rank: number }>();
        for (const aggregate of aggregates) {
            overall.set(aggregate.studentId, {
                percentage: aggregate.percentage,
                totalPoints: aggregate.totalPoints,
                rank: ranks.get(aggregate.studentId) || 0,
            });
        }

        return {
            label: roundLabel(previous.exam_type, previous.name || 'Previous exam'),
            subjectPercentage,
            overall,
        };
    } catch {
        // Comparative data is a bonus on the card, never a reason to fail it.
        return null;
    }
}

/** Earliest exam creation time in a set of marks — the cut-off for "previous". */
export function earliestExamCreatedAt(marks: unknown[]): string | undefined {
    let earliest: string | undefined;
    for (const mark of marks) {
        const exam = (mark as { exams?: { created_at?: string } } | null)?.exams;
        const createdAt = exam?.created_at;
        if (!createdAt) continue;
        if (!earliest || new Date(createdAt).getTime() < new Date(earliest).getTime()) {
            earliest = createdAt;
        }
    }
    return earliest;
}
