import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { generateStudentReportCardPDF, ReportCardData } from '@/lib/pdfGenerator';
import {
    aggregateStudentPerformance,
    calculateClassRanks,
    generateFeedback,
    getGradeFromScales,
    getPointsFromScales,
    getRubricFromScales,
    getCategoryOrder,
    getSubjectStudentCounts,
} from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import type { GradingScale } from '@/types';
import JSZip from 'jszip';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ classId: string }> }
) {
    try {
        const classId = (await params).classId;
        const { searchParams } = new URL(request.url);
        const baseUrl = new URL(request.url).origin;
        const termId = searchParams.get('termId');
        const yearId = searchParams.get('yearId');

        if (!termId) {
            return NextResponse.json({ error: 'termId is required for class reports' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        // 1. Fetch Students in the grade stream (classId = grade_stream_id)
        const { data: students, error: studentsErr } = await supabase
            .from('students')
            .select('id, admission_number, academic_level_id, current_grade_stream_id, users(first_name, last_name, school_id), grade_streams(full_name)')
            .eq('current_grade_stream_id', classId);

        if (studentsErr || !students || students.length === 0) {
            return NextResponse.json({ error: 'No students found in this class' }, { status: 404 });
        }

        // 2. Fetch school name, logo, and address
        let schoolName = 'School';
        let schoolLogoUrl: string | undefined;
        let schoolAddress: string | undefined;
        
        const targetSchoolId = (students[0].users as any)?.school_id;

        const { getServerSession } = await import('next-auth');
        const { authOptions } = await import('@/lib/auth');
        const session = await getServerSession(authOptions) as any;

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userSchoolId = session.user.schoolId;
        if (!userSchoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        if (targetSchoolId && targetSchoolId !== userSchoolId) {
            return NextResponse.json({ error: 'Cannot access data from another school' }, { status: 403 });
        }

        const role = session.user.role;
        if (role !== 'ADMIN') {
            const { getTeacherPermissions } = await import('@/lib/teacher-utils');
            const perms = await getTeacherPermissions(session.user.id);
            if (!perms.isClassTeacher || !perms.classTeacherStreams.includes(classId)) {
                return NextResponse.json({ error: 'Only administrators and the designated class teacher can generate class reports.' }, { status: 403 });
            }
        }

        if (targetSchoolId) {
            const { data: schoolData } = await supabase.from('schools').select('name, logo_url, address').eq('id', targetSchoolId).single();
            if (schoolData) {
                schoolName = schoolData.name;
                schoolLogoUrl = schoolData.logo_url || undefined;
                schoolAddress = schoolData.address || undefined;
            }
        }

        // 3. Determine academic level and grading system from first student
        let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
        let gradingScales: GradingScale[] = [];

        const firstAcademicLevelId = students[0].academic_level_id;
        if (firstAcademicLevelId) {
            const { data: academicLevel } = await supabase
                .from('academic_levels')
                .select('code')
                .eq('id', firstAcademicLevelId)
                .single();

            if (academicLevel) {
                gradingSystemType = academicLevel.code === 'CBC' ? 'CBC' : 'KCSE';
            }

            const { data: gradingSystem } = await supabase
                .from('grading_systems')
                .select('id')
                .eq('academic_level_id', firstAcademicLevelId)
                .limit(1)
                .single();

            if (gradingSystem) {
                const { data: scales } = await supabase
                    .from('grading_scales')
                    .select('*')
                    .eq('grading_system_id', gradingSystem.id)
                    .order('order_index', { ascending: true });

                if (scales) {
                    gradingScales = scales as GradingScale[];
                }
            }
        }

        // 4. Build grade boundaries from scales
        const gradeBoundaries = gradingScales.map(s => ({
            symbol: s.symbol,
            label: s.label,
            min: Number(s.min_percentage),
            max: Number(s.max_percentage),
            points: s.points,
        }));

        // 5. Fetch term/year info
        let termTitle = 'Term Report';
        let academicYearName = 'Academic Year';
        if (termId) {
            const { data: termData } = await supabase.from('terms').select('name').eq('id', termId).single();
            if (termData) termTitle = termData.name;
        }
        
        const customTitle = searchParams.get('customTitle');
        if (customTitle) {
            termTitle = customTitle;
        }
        if (yearId) {
            const { data: yearData } = await supabase.from('academic_years').select('name').eq('id', yearId).single();
            if (yearData) academicYearName = yearData.name;
        }

        // 6. Fetch all marks and also ALL exams for this term and class
        const studentIds = students.map(s => s.id);
        const gradeId = (students[0].grade_streams as any)?.grade_id;

        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, student_id, percentage, raw_score, grade_symbol, rubric, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    subjects ( id, name, code, category, display_order )
                )
            `)
            .in('student_id', studentIds)
            .eq('exams.term_id', termId);

        if (yearId) {
            marksQuery = marksQuery.eq('exams.academic_year_id', yearId);
        }

        const { data: allMarks, error: marksErr } = await marksQuery;

        if (marksErr) {
            console.error('Error fetching class marks:', marksErr);
            return NextResponse.json({ error: 'Failed to fetch marks' }, { status: 500 });
        }

        // Fetch all exams for this term and grade to ensure all subjects are shown even if missing from exam_marks
        let examsQ = supabase
            .from('exams')
            .select('id, max_score, subjects(id, name, code, category, display_order)')
            .eq('term_id', termId);
        if (yearId) examsQ = examsQ.eq('academic_year_id', yearId);
        if (gradeId) examsQ = examsQ.eq('grade_id', gradeId);

        const { data: termExams } = await examsQ;
        const examMap = new Map<string, any>();
        if (termExams) {
            termExams.forEach((ex: any) => {
                if (ex.subjects) {
                    examMap.set(ex.subjects.id, ex);
                }
            });
        }

        if (!allMarks || allMarks.length === 0) {
            // Wait, if no marks but we have exams? We should still generate empty reports!
            // Let's modify the check:
            if (!termExams || termExams.length === 0) {
                return NextResponse.json({ error: 'No marks and no exams found for this class and term' }, { status: 404 });
            }
        }

        // 7. Group marks by student and calculate ranks + per-subject ranks
        const marksByStudent: Record<string, any[]> = {};
        // Per-subject aggregation: subjectId -> { studentId -> pct }[]
        const subjectAggs: Record<string, { studentId: string; pct: number }[]> = {};

        for (const m of allMarks || []) {
            if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
            marksByStudent[m.student_id].push(m);

            // Accumulate per-subject scores for ranking
            const subjectId = (m as any).exams?.subjects?.id;
            if (subjectId) {
                if (!subjectAggs[subjectId]) subjectAggs[subjectId] = [];
                const maxScore = Number((m as any).exams.max_score);
                const pct = maxScore > 0 ? (Number(m.raw_score) / maxScore) * 100 : 0;
                subjectAggs[subjectId].push({ studentId: m.student_id, pct });
            }
        }

        // Aggregate each student for overall ranking
        const aggregates = students.map(student => {
            const marks = marksByStudent[student.id] || [];
            if (marks.length === 0) return { studentId: student.id, percentage: 0, totalPoints: 0 };
            
            const mapped: ExamMarkWithDetails[] = marks.map((m: any) => ({
                id: m.id,
                student_id: student.id,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
                remarks: m.remarks,
            }));
            const perf = aggregateStudentPerformance(mapped, gradingScales);
            return { studentId: student.id, percentage: perf.percentage, totalPoints: perf.totalPoints };
        });

        const ranks = calculateClassRanks(aggregates);
        const rankedStudentCount = aggregates.length;

        // Build per-subject rank maps: subjectId -> Map<studentId, rank>
        const subjectRankMaps: Record<string, Map<string, number>> = {};
        const subjectStudentCounts = getSubjectStudentCounts(subjectAggs);
        for (const [subjId, entries] of Object.entries(subjectAggs)) {
            subjectRankMaps[subjId] = calculateClassRanks(
                entries.map(e => ({ studentId: e.studentId, percentage: e.pct }))
            );
        }

        // 8. Generate raw data array instead of PDFs
        const reportCardsData: ReportCardData[] = [];

        for (const student of students) {
            const studentMarks = marksByStudent[student.id] || [];
            // If student has no marks and there are no exams either, skip
            if (studentMarks.length === 0 && (!termExams || termExams.length === 0)) continue;

            const mapped: ExamMarkWithDetails[] = studentMarks.map((m: any) => ({
                id: m.id,
                student_id: student.id,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
                remarks: m.remarks,
            }));

            const studentPerf = // only base on available marks
                 (mapped.length > 0) ? aggregateStudentPerformance(mapped, gradingScales) : { percentage: 0, totalPoints: 0, grade: '-', overallGrade: '-' };

            // Resolve overall grade from total points (KCSE) or percentage (CBC)
            const isKCSE = gradingSystemType === 'KCSE';
            const overallGradeSymbol = isKCSE 
                ? studentPerf.overallGrade 
                : (gradingScales.length > 0 
                    ? getGradeFromScales(studentPerf.percentage, gradingScales) 
                    : studentPerf.grade);

            // Fetch class teacher and principal comments
            let classTeacherComment = '';
            let principalComment = '';
            if (termId && yearId) {
                const { data: reportCard } = await supabase
                    .from('report_cards')
                    .select('comments_class_teacher, comments_principal')
                    .eq('student_id', student.id)
                    .eq('term_id', termId)
                    .eq('academic_year_id', yearId)
                    .single();

                if (reportCard?.comments_class_teacher) {
                    classTeacherComment = reportCard.comments_class_teacher;
                }
                if (reportCard?.comments_principal) {
                    principalComment = reportCard.comments_principal;
                }
            }

            const firstName = (student.users as any)?.first_name || 'Student';
            const lastName = (student.users as any)?.last_name || '';
            const streamName = (student.grade_streams as any)?.full_name || 'N/A';

            // Build subject marks map by subject ID
            const subjMarksMap = new Map<string, any>();
            studentMarks.forEach((m: any) => {
                const subject = m.exams.subjects;
                if (!subject) return;
                const pct = Number(m.percentage);
                // Prioritise manually-entered grade_symbol over auto-calculated
                const grade = m.grade_symbol
                    ? m.grade_symbol
                    : (gradingScales.length > 0
                        ? getGradeFromScales(pct, gradingScales)
                        : '-');
                const points = gradingScales.length > 0
                    ? getPointsFromScales(pct, gradingScales)
                    : undefined;
                const rubric = m.rubric || ((gradingSystemType === 'CBC' && gradingScales.length > 0)
                    ? getRubricFromScales(pct, gradingScales)
                    : undefined);

                subjMarksMap.set(subject.id, {
                    subjectCode: subject.code || subject.name || 'Unknown',
                    subjectName: subject.name || 'Unknown Subject',
                    category: subject.category || 'TECHNICAL',
                    score: Number(m.raw_score),
                    totalPossible: Number(m.exams.max_score),
                    percentage: pct,
                    grade,
                    points,
                    rubric,
                    teacherComment: m.remarks || '',
                    subjectRank: subjectRankMaps[subject.id]?.get(student.id) ?? undefined,
                    totalStudents: subjectStudentCounts[subject.id] ?? undefined,
                });
            });

            const subjectMarks = Array.from(subjMarksMap.values())
                .filter((m: any) => m.score !== null && m.score !== undefined);

            // Sort by category then name
            subjectMarks.sort((a: any, b: any) => {
                const catDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
                if (catDiff !== 0) return catDiff;
                return a.subjectName.localeCompare(b.subjectName);
            });

            // Calculate total score / total possible for the summary strip
            const computedTotalScore = subjectMarks.reduce((sum: number, m: any) => sum + (m.score || 0), 0);
            const computedTotalPossible = subjectMarks.reduce((sum: number, m: any) => sum + (m.totalPossible || 0), 0);

            const reportData: ReportCardData = {
                schoolName,
                schoolLogoUrl,
                schoolAddress,
                examTitle: termTitle,
                academicYear: academicYearName,
                studentName: `${firstName} ${lastName}`,
                enrollmentNumber: student.admission_number || '',
                className: streamName,
                gradingSystemType,
                subjectMarks,
                overallPercentage: studentPerf.percentage,
                overallGrade: overallGradeSymbol,
                totalPoints: studentPerf.totalPoints,
                overallPointsGrade: studentPerf.overallGrade,
                classRank: ranks.get(student.id) || 0,
                totalStudents: rankedStudentCount,
                classTeacherComment: classTeacherComment || undefined,
                principalComment: principalComment || undefined,
                gradeBoundaries,
                resultUrl: `${baseUrl}/student/${student.id}`,
                totalScore: computedTotalScore,
                totalPossible: computedTotalPossible,
            };

            reportCardsData.push(reportData);
        }

        return NextResponse.json(reportCardsData, { status: 200 });

    } catch (error: any) {
        console.error('Batch Data Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate class reports' }, { status: 500 });
    }
}
