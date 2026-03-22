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
        const termId = searchParams.get('term');
        const yearId = searchParams.get('year');

        const supabase = createSupabaseAdmin();

        // 1. Fetch Student Data
        const { data: student, error: studentErr } = await supabase
            .from('students')
            .select(`
                *,
                users(first_name, last_name, school_id),
                grade_streams(full_name)
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

        // 4. Fetch Marks with subject details including category
        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, percentage, raw_score, grade_symbol, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    terms ( name ),
                    academic_years ( name ),
                    subjects ( id, name, category, display_order )
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

        if (!marks || marks.length === 0) {
            return NextResponse.json({ error: 'No marks found for student in this term' }, { status: 404 });
        }

        const firstExam = marks[0].exams as any;
        let termTitle = firstExam.terms?.name || 'Term Report';
        const customTitle = searchParams.get('customTitle');
        if (customTitle) {
            termTitle = customTitle;
        }
        const academicYear = firstExam.academic_years?.name || 'Academic Year';

        // 5. Map to analytics interface and calculate performance
        const mappedMarks: ExamMarkWithDetails[] = marks.map((m: any) => ({
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

        const studentPerf = aggregateStudentPerformance(mappedMarks, gradingScales);

        // 6. Calculate class ranking
        let classRank = 0;
        let totalStudents = 0;
        const gradeStreamId = student.current_grade_stream_id;

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
                    .select('student_id, raw_score, exams!inner(max_score, term_id, academic_year_id)')
                    .in('student_id', classmateIds);

                if (termId) rankQuery = rankQuery.eq('exams.term_id', termId);
                if (yearId) rankQuery = rankQuery.eq('exams.academic_year_id', yearId);

                const { data: allMarks } = await rankQuery;

                if (allMarks && allMarks.length > 0) {
                    const studentAggs: Record<string, { totalScore: number; totalPossible: number }> = {};
                    for (const m of allMarks as any[]) {
                        const sid = m.student_id;
                        if (!studentAggs[sid]) studentAggs[sid] = { totalScore: 0, totalPossible: 0 };
                        studentAggs[sid].totalScore += Number(m.raw_score);
                        studentAggs[sid].totalPossible += Number(m.exams.max_score);
                    }

                    const aggregates = Object.entries(studentAggs)
                        .filter(([, v]) => v.totalPossible > 0)
                        .map(([sid, v]) => ({
                            studentId: sid,
                            percentage: (v.totalScore / v.totalPossible) * 100,
                        }));

                    const ranks = calculateClassRanks(aggregates);
                    classRank = ranks.get(studentId) || 0;
                    totalStudents = aggregates.length;
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

        // 10. Build subject marks with category, points/rubric, and teacher comments
        const subjectMarks = marks.map((m: any) => {
            const subject = m.exams.subjects;
            const sname = subject?.name || 'Unknown Subject';
            const category = subject?.category || 'OTHER';
            const pct = Number(m.percentage);

            // Determine grade, points, rubric from scales
            const grade = gradingScales.length > 0
                ? getGradeFromScales(pct, gradingScales)
                : (m.grade_symbol || '-');

            const points = gradingScales.length > 0
                ? getPointsFromScales(pct, gradingScales)
                : undefined;

            const rubric = (gradingSystemType === 'CBC' && gradingScales.length > 0)
                ? getRubricFromScales(pct, gradingScales)
                : undefined;

            return {
                subjectName: sname,
                category,
                score: Number(m.raw_score),
                totalPossible: Number(m.exams.max_score),
                percentage: pct,
                grade,
                points,
                rubric,
                teacherComment: m.remarks || '',
            };
        });

        // Sort by category then display_order
        subjectMarks.sort((a: any, b: any) => {
            const catDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
            if (catDiff !== 0) return catDiff;
            return a.subjectName.localeCompare(b.subjectName);
        });

        // 11. Structure data for PDF Generator
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
