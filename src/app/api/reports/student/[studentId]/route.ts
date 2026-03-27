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
} from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import type { GradingScale } from '@/types';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const studentId = (await params).studentId;
        const { searchParams } = new URL(request.url);
        const baseUrl = new URL(request.url).origin;
        const termId = searchParams.get('termId') || searchParams.get('term');
        const yearId = searchParams.get('yearId') || searchParams.get('year');

        const supabase = createSupabaseAdmin();

        // 1. Fetch Student Data
        const { data: student, error: studentErr } = await supabase
            .from('students')
            .select(`
                *,
                users(first_name, last_name, school_id),
                grade_streams(full_name, grade_id)
            `)
            .eq('id', studentId)
            .single();

        if (studentErr || !student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Fetch school name, logo, and address
        let schoolName = 'School';
        let schoolLogoUrl: string | undefined;
        let schoolAddress: string | undefined;
        
        // Try getting school_id from the student's user relation first (if exists)
        const targetSchoolId = student.users?.school_id;
        
        const { getServerSession } = await import('next-auth');
        const { authOptions } = await import('@/lib/auth');
        const session = await getServerSession(authOptions) as any;

        if (!session?.user?.id) {
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
        const userId = session.user.id;

        if (role === 'STUDENT') {
            if (userId !== studentId) {
                 return NextResponse.json({ error: 'Unauthorized to view this student report' }, { status: 403 });
            }
        } else if (role !== 'ADMIN') {
            const { getTeacherPermissions } = await import('@/lib/teacher-utils');
            const perms = await getTeacherPermissions(userId);
            if (!perms.isClassTeacher || !perms.classTeacherStreams.includes(student.current_grade_stream_id)) {
                return NextResponse.json({ error: 'Only administrators and the designated class teacher can generate student reports.' }, { status: 403 });
            }
        }

        if (targetSchoolId) {
            const { data: schoolData } = await supabase
                .from('schools')
                .select('name, logo_url, address')
                .eq('id', targetSchoolId)
                .single();
            if (schoolData) {
                schoolName = schoolData.name;
                schoolLogoUrl = schoolData.logo_url || undefined;
                schoolAddress = schoolData.address || undefined;
            }
        }

        // 3. Determine academic level and grading system
        let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
        let gradingScales: GradingScale[] = [];

        if (student.academic_level_id) {
            // Fetch the academic level code to determine KCSE vs CBC
            const { data: academicLevel } = await supabase
                .from('academic_levels')
                .select('code')
                .eq('id', student.academic_level_id)
                .single();

            if (academicLevel) {
                gradingSystemType = academicLevel.code === 'CBC' ? 'CBC' : 'KCSE';
            }

            // Fetch grading scales for this academic level
            const { data: gradingSystem } = await supabase
                .from('grading_systems')
                .select('id')
                .eq('academic_level_id', student.academic_level_id)
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

        // 3.5 Fetch all term exams to ensure empty subjects are displayed
        const gradeId = student.grade_streams?.grade_id;

        let examsQ = supabase
            .from('exams')
            .select('id, max_score, terms(name), academic_years(name), subjects(id, name, code, category, display_order)')
            .eq('term_id', termId);
        
        if (yearId) examsQ = examsQ.eq('academic_year_id', yearId);
        if (gradeId) examsQ = examsQ.eq('grade_id', gradeId);

        const { data: termExams } = await examsQ;

        // 4. Fetch Marks with subject details including category
        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, percentage, raw_score, grade_symbol, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    terms ( name ),
                    academic_years ( name ),
                    subjects ( id, name, code, category, display_order )
                )
            `)
            .eq('student_id', studentId);

        if (termId) {
            marksQuery = marksQuery.eq('exams.term_id', termId);
        }
        if (yearId) {
            marksQuery = marksQuery.eq('exams.academic_year_id', yearId);
        }

        const { data: marks, error: marksErr } = await marksQuery;

        if (marksErr) {
            console.error("Supabase error fetching marks:", marksErr);
            return NextResponse.json({ error: 'Supabase error fetching marks', details: marksErr }, { status: 500 });
        }

        if ((!marks || marks.length === 0) && (!termExams || termExams.length === 0)) {
            return NextResponse.json({ error: 'No marks and no exams found for student in this term' }, { status: 404 });
        }

        const safeMarks = marks || [];
        const firstExam = safeMarks.length > 0 ? safeMarks[0].exams : (termExams && termExams.length > 0 ? termExams[0] : null);

        let termTitle = 'Term Report';
        let academicYear = 'Academic Year';
        
        if (firstExam) {
            termTitle = (firstExam as any).terms?.name || 'Term Report';
            academicYear = (firstExam as any).academic_years?.name || 'Academic Year';
        }

        const customTitle = searchParams.get('customTitle');
        if (customTitle) {
            termTitle = customTitle;
        }

        // 5. Map to analytics interface and calculate performance
        const mappedMarks: ExamMarkWithDetails[] = safeMarks.map((m: any) => ({
            id: m.id,
            student_id: studentId,
            exam_id: m.exams.id || '',
            subject_id: m.exams.subjects?.id || '',
            raw_score: Number(m.raw_score),
            percentage: Number(m.percentage || 0),
            max_score: Number(m.exams.max_score),
            grade_symbol: m.grade_symbol,
            remarks: m.remarks
        }));

        const studentPerf = mappedMarks.length > 0 ? aggregateStudentPerformance(mappedMarks, gradingScales) : { percentage: 0, totalPoints: 0, grade: '-' };

        // 6. Calculate class ranking + per-subject ranks
        let classRank = 0;
        let totalStudents = 0;
        const gradeStreamId = student.current_grade_stream_id;
        const subjectRanksMap = new Map<string, number>(); // subjectId -> this student's rank

        if (gradeStreamId) {
            const { data: classmates } = await supabase
                .from('students')
                .select('id')
                .eq('current_grade_stream_id', gradeStreamId);

            if (classmates && classmates.length > 0) {
                totalStudents = classmates.length;
                const classmateIds = classmates.map((c: any) => c.id);

                let rankQuery = supabase
                    .from('exam_marks')
                    .select('student_id, raw_score, exams!inner(max_score, term_id, academic_year_id, subjects(id))')
                    .in('student_id', classmateIds);

                if (termId) rankQuery = rankQuery.eq('exams.term_id', termId);
                if (yearId) rankQuery = rankQuery.eq('exams.academic_year_id', yearId);

                const { data: allMarks } = await rankQuery;

                if (allMarks && allMarks.length > 0) {
                    const studentAggs: Record<string, { totalScore: number; totalPossible: number }> = {};
                    // Per-subject aggregation: subjectId -> { studentId -> percentage }
                    const subjectAggs: Record<string, { studentId: string; pct: number }[]> = {};

                    for (const m of allMarks as any[]) {
                        const sid = m.student_id;
                        const subjectId = m.exams.subjects?.id;
                        if (!studentAggs[sid]) studentAggs[sid] = { totalScore: 0, totalPossible: 0 };
                        studentAggs[sid].totalScore += Number(m.raw_score);
                        studentAggs[sid].totalPossible += Number(m.exams.max_score);

                        // Accumulate per-subject scores
                        if (subjectId) {
                            if (!subjectAggs[subjectId]) subjectAggs[subjectId] = [];
                            const maxScore = Number(m.exams.max_score);
                            const pct = maxScore > 0 ? (Number(m.raw_score) / maxScore) * 100 : 0;
                            subjectAggs[subjectId].push({ studentId: sid, pct });
                        }
                    }

                    // Overall class ranks
                    const aggregates = Object.entries(studentAggs)
                        .filter(([, v]) => v.totalPossible > 0)
                        .map(([sid, v]) => ({
                            studentId: sid,
                            percentage: (v.totalScore / v.totalPossible) * 100,
                        }));

                    const ranks = calculateClassRanks(aggregates);
                    classRank = ranks.get(studentId) || 0;
                    totalStudents = aggregates.length;

                    // Per-subject ranks for this student
                    for (const [subjId, entries] of Object.entries(subjectAggs)) {
                        const subjRanks = calculateClassRanks(
                            entries.map(e => ({ studentId: e.studentId, percentage: e.pct }))
                        );
                        const rank = subjRanks.get(studentId);
                        if (rank) subjectRanksMap.set(subjId, rank);
                    }
                }
            }
        }

        // 7. Resolve overall grade from DB grading scales
        const overallGradeSymbol = gradingScales.length > 0
            ? getGradeFromScales(studentPerf.percentage, gradingScales)
            : studentPerf.grade;

        // 8. Fetch class teacher and principal comments from report_cards table
        let classTeacherComment = '';
        let principalComment = '';
        if (termId && yearId) {
            const { data: reportCard } = await supabase
                .from('report_cards')
                .select('comments_class_teacher, comments_principal')
                .eq('student_id', studentId)
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

        // 9. Build grade boundaries from scales
        const gradeBoundaries = gradingScales.map(s => ({
            symbol: s.symbol,
            label: s.label,
            min: Number(s.min_percentage),
            max: Number(s.max_percentage),
            points: s.points,
        }));

        // 10. Build subject marks with category, points/rubric, ranks, and teacher comments
        const subjMarksMap = new Map<string, any>();
        
        safeMarks.forEach((m: any) => {
            const subject = m.exams.subjects;
            if (!subject) return;
            const pct = Number(m.percentage);

            // Determine grade, points, rubric from scales
            // Prioritise manually-entered grade_symbol over auto-calculated
            const grade = m.grade_symbol
                ? m.grade_symbol
                : (gradingScales.length > 0
                    ? getGradeFromScales(pct, gradingScales)
                    : '-');

            const points = gradingScales.length > 0
                ? getPointsFromScales(pct, gradingScales)
                : undefined;

            const rubric = (gradingSystemType === 'CBC' && gradingScales.length > 0)
                ? getRubricFromScales(pct, gradingScales)
                : undefined;

            subjMarksMap.set(subject.id, {
                subjectCode: subject.code || subject.name || 'Unknown',
                subjectName: subject.name || 'Unknown Subject',
                category: subject.category || 'OTHER',
                score: Number(m.raw_score),
                totalPossible: Number(m.exams.max_score),
                percentage: pct,
                grade,
                points,
                rubric,
                teacherComment: m.remarks || '',
                subjectRank: subjectRanksMap.get(subject.id) ?? undefined,
            });
        });

        // Only include subjects that have marks entered (filter out exams without marks)
        // This handles CBC students who don't take all subjects
        const subjectMarks = Array.from(subjMarksMap.values())
            .filter((m: any) => m.score !== null && m.score !== undefined);

        // Sort by category then display_order
        subjectMarks.sort((a: any, b: any) => {
            const catDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
            if (catDiff !== 0) return catDiff;
            return a.subjectName.localeCompare(b.subjectName);
        });

        // 11. Calculate total score / total possible for the summary strip (only for subjects with marks)
        const computedTotalScore = subjectMarks.reduce((sum: number, m: any) => sum + (m.score || 0), 0);
        const computedTotalPossible = subjectMarks.reduce((sum: number, m: any) => sum + (m.totalPossible || 0), 0);

        // 12. Structure data for PDF Generator
        const reportData: ReportCardData = {
            schoolName,
            schoolLogoUrl,
            schoolAddress,
            examTitle: termTitle,
            academicYear,
            studentName: `${student.users?.first_name} ${student.users?.last_name}`,
            enrollmentNumber: student.admission_number || '',
            className: student.grade_streams?.full_name || 'N/A',
            gradingSystemType,
            subjectMarks,
            overallPercentage: studentPerf.percentage,
            overallGrade: overallGradeSymbol,
            totalPoints: studentPerf.totalPoints,
            classRank,
            totalStudents,
            classTeacherComment: classTeacherComment || undefined,
            principalComment: principalComment || undefined,
            gradeBoundaries,
            resultUrl: `${baseUrl}/student/${studentId}`,
            totalScore: computedTotalScore,
            totalPossible: computedTotalPossible,
        };

        // 12. Generate PDF Buffer
        const pdfBuffer = await generateStudentReportCardPDF(reportData);

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${student.users?.first_name}_${student.users?.last_name}_${termTitle}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 });
    }
}
