import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
    aggregateStudentPerformance,
    calculateClassRanks,
    getGradeFromScales,
    getRubricFromScales,
} from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import { resolveGradingContext } from '@/lib/reports/grading-context';
import { selectExamRound } from '@/lib/reports/exam-round';

export const runtime = 'nodejs';

/**
 * supabase-js types an embedded relation as an array in some selects and an
 * object in others, so every embed is unwrapped through here.
 */
function one<T>(relation: unknown): T | undefined {
    if (!relation) return undefined;
    return (Array.isArray(relation) ? relation[0] : relation) as T | undefined;
}

interface SubjectRel { id?: string; name?: string; code?: string; category?: string; display_order?: number }
interface ExamRel { id?: string; max_score?: number; exam_type?: string; created_at?: string; subjects?: unknown }

/** A mark flattened out of the nested supabase response. */
interface FlatMark {
    studentId: string;
    examId: string;
    rawScore: number;
    percentage: number;
    maxScore: number;
    gradeSymbol?: string;
    examType?: string;
    createdAt?: string;
    subject: SubjectRel;
}

function flatten(row: unknown, fallbackStudentId: string): FlatMark | null {
    const m = row as { student_id?: string; raw_score?: number; percentage?: number; grade_symbol?: string; exams?: unknown };
    const exam = one<ExamRel>(m.exams);
    if (!exam) return null;
    return {
        studentId: m.student_id || fallbackStudentId,
        examId: exam.id || '',
        rawScore: Number(m.raw_score ?? 0),
        percentage: Number(m.percentage ?? 0),
        maxScore: Number(exam.max_score ?? 0),
        gradeSymbol: m.grade_symbol || undefined,
        examType: exam.exam_type,
        createdAt: exam.created_at,
        subject: one<SubjectRel>(exam.subjects) || {},
    };
}

/** Shape selectExamRound() reads: it looks for `exams.exam_type` / `created_at`. */
const asRoundInput = (m: FlatMark) => ({ ...m, exams: { exam_type: m.examType, created_at: m.createdAt } });

function toAnalyticsMark(m: FlatMark): ExamMarkWithDetails {
    return {
        id: '',
        student_id: m.studentId,
        exam_id: m.examId,
        subject_id: m.subject.id || '',
        raw_score: m.rawScore,
        percentage: m.percentage,
        max_score: m.maxScore,
        grade_symbol: m.gradeSymbol,
    };
}

/**
 * Public results verification — the page a report card's QR code opens.
 *
 * Deliberately unauthenticated: the reader is a parent holding a printed card,
 * who has no account. The student id in the URL is an unguessable UUID, and
 * only APPROVED results are ever returned, so nothing appears here that the
 * school has not already signed off and handed out on paper.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const studentId = (await params).studentId;
        const { searchParams } = new URL(request.url);
        const rawTerm = searchParams.get('term') || searchParams.get('termId');
        const rawExamType = searchParams.get('examType');
        const termId = rawTerm && rawTerm.trim() ? rawTerm : null;
        const examType = rawExamType && rawExamType.trim() ? rawExamType : null;

        // Same response for "no such student" and "nothing approved to show" —
        // a public endpoint should not confirm which ids exist.
        const notFound = NextResponse.json(
            { error: 'No published results found for this code.' },
            { status: 404 }
        );

        const supabase = createSupabaseAdmin();

        const { data: student } = await supabase
            .from('students')
            .select(`
                id, admission_number, academic_level_id, current_grade_stream_id,
                users(first_name, last_name, school_id),
                grade_streams(full_name, grade_id)
            `)
            .eq('id', studentId)
            .maybeSingle();

        if (!student) return notFound;

        const user = one<{ first_name?: string; last_name?: string; school_id?: string }>(student.users);
        const stream = one<{ full_name?: string; grade_id?: string }>(student.grade_streams);
        const schoolId = user?.school_id;
        const gradeId = stream?.grade_id;

        let schoolName = 'School';
        let schoolLogoUrl: string | null = null;
        if (schoolId) {
            const { data: school } = await supabase
                .from('schools')
                .select('name, logo_url')
                .eq('id', schoolId)
                .maybeSingle();
            if (school) {
                schoolName = school.name;
                schoolLogoUrl = school.logo_url || null;
            }
        }

        // Only approved exams are public. Without a term the most recently
        // approved sitting is shown, which is what a freshly printed card is.
        let examQuery = supabase
            .from('exams')
            .select('id, term_id, exam_type, approved_at, terms(name), academic_years(name)')
            .eq('status', 'APPROVED')
            .order('approved_at', { ascending: false });
        if (schoolId) examQuery = examQuery.eq('school_id', schoolId);
        if (gradeId) examQuery = examQuery.eq('grade_id', gradeId);
        if (termId) examQuery = examQuery.eq('term_id', termId);
        if (examType) examQuery = examQuery.eq('exam_type', examType);

        const { data: approvedExams } = await examQuery;
        if (!approvedExams || approvedExams.length === 0) return notFound;

        // Pin to one term so a card never blends terms together.
        const resolvedTermId = termId || approvedExams[0].term_id;
        const scopedExams = approvedExams.filter(e => e.term_id === resolvedTermId);
        const approvedExamIds = scopedExams.map(e => e.id);
        if (approvedExamIds.length === 0) return notFound;

        const { data: rawMarks } = await supabase
            .from('exam_marks')
            .select(`
                raw_score, percentage, grade_symbol,
                exams!inner ( id, max_score, exam_type, created_at,
                    subjects ( id, name, code, category, display_order )
                )
            `)
            .eq('student_id', studentId)
            .in('exam_id', approvedExamIds);

        const flat = (rawMarks || [])
            .map(r => flatten(r, studentId))
            .filter((m): m is FlatMark => m !== null);
        if (flat.length === 0) return notFound;

        const grading = await resolveGradingContext(
            supabase,
            { academic_level_id: student.academic_level_id, grade_streams: stream },
            schoolId
        );

        // Narrow to a single sitting, then one mark per subject — the same
        // collapse the report card does, so the two always agree.
        const roundMarks = examType ? flat : selectExamRound(flat.map(asRoundInput)).marks;
        const ordered = [...roundMarks].sort(
            (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
        const bySubject = new Map<string, FlatMark>();
        for (const m of ordered) {
            if (m.subject.id) bySubject.set(m.subject.id, m); // later (more recent) exam wins
        }
        const safeMarks = Array.from(bySubject.values());
        if (safeMarks.length === 0) return notFound;

        const subjectNames: Record<string, string> = {};
        const subjectCategories: Record<string, string> = {};
        for (const m of safeMarks) {
            if (m.subject.id && m.subject.name) subjectNames[m.subject.id] = m.subject.name;
            if (m.subject.id && m.subject.category) subjectCategories[m.subject.id] = m.subject.category;
        }

        const perf = aggregateStudentPerformance(
            safeMarks.map(toAnalyticsMark), grading.gradingScales, grading.gradingSystemType,
            subjectNames, subjectCategories,
            grading.overallGradingScales, grading.overallGradingKind
        );

        const subjects = [...safeMarks]
            .sort((a, b) =>
                (a.subject.display_order ?? 999) - (b.subject.display_order ?? 999)
                || (a.subject.name || '').localeCompare(b.subject.name || '')
            )
            .map(m => ({
                subject: m.subject.name || 'Subject',
                code: m.subject.code || null,
                score: m.rawScore,
                outOf: m.maxScore,
                percentage: Math.round(m.percentage * 10) / 10,
                grade: m.gradeSymbol || getGradeFromScales(m.percentage, grading.gradingScales),
                rubric: getRubricFromScales(m.percentage, grading.gradingScales) || null,
            }));

        // Class position, computed over the same approved exams.
        let classRank = 0;
        let totalStudents = 0;
        if (student.current_grade_stream_id) {
            const { data: classmates } = await supabase
                .from('students')
                .select('id')
                .eq('current_grade_stream_id', student.current_grade_stream_id);

            if (classmates && classmates.length > 0) {
                const { data: allMarks } = await supabase
                    .from('exam_marks')
                    .select('student_id, raw_score, grade_symbol, exams!inner(id, max_score, subjects(id, name, category))')
                    .in('student_id', classmates.map(c => c.id))
                    .in('exam_id', approvedExamIds);

                const byStudent: Record<string, ExamMarkWithDetails[]> = {};
                const rankNames: Record<string, string> = {};
                const rankCategories: Record<string, string> = {};
                for (const row of allMarks || []) {
                    const m = flatten(row, '');
                    if (!m || !m.studentId) continue;
                    (byStudent[m.studentId] ||= []).push(toAnalyticsMark(m));
                    if (m.subject.id && m.subject.name) rankNames[m.subject.id] = m.subject.name;
                    if (m.subject.id && m.subject.category) rankCategories[m.subject.id] = m.subject.category;
                }

                const aggregates = Object.entries(byStudent).map(([sid, marks]) => {
                    const p = aggregateStudentPerformance(marks, grading.gradingScales, grading.gradingSystemType, rankNames, rankCategories);
                    return { studentId: sid, percentage: p.percentage, totalPoints: p.totalPoints };
                });
                const ranks = calculateClassRanks(aggregates, grading.gradingSystemType === 'KCSE' ? 'points' : 'percentage');
                classRank = ranks.get(studentId) || 0;
                totalStudents = aggregates.length;
            }
        }

        const headExam = scopedExams[0];
        const termName = one<{ name?: string }>(headExam?.terms)?.name || null;
        const yearName = one<{ name?: string }>(headExam?.academic_years)?.name || null;

        return NextResponse.json({
            school: { name: schoolName, logoUrl: schoolLogoUrl },
            student: {
                name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
                admissionNumber: student.admission_number || null,
                className: stream?.full_name || null,
            },
            term: termName,
            academicYear: yearName,
            examType: examType || headExam?.exam_type || null,
            approvedAt: headExam?.approved_at || null,
            subjects,
            summary: {
                mean: Math.round(perf.percentage * 10) / 10,
                grade: perf.overallGrade || perf.grade || null,
                totalPoints: grading.gradingSystemType === 'KCSE' ? perf.totalPoints : null,
                subjectCount: subjects.length,
                classRank: classRank || null,
                totalStudents: totalStudents || null,
            },
        }, {
            // Results do not change once approved, but keep it short so an
            // unpublish is reflected quickly.
            headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
        });
    } catch (err) {
        console.error('Verification lookup failed:', err);
        return NextResponse.json({ error: 'Could not load these results.' }, { status: 500 });
    }
}
