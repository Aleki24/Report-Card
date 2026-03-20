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
        
        let targetSchoolId = (students[0].users as any)?.school_id;

        if (!targetSchoolId) {
            try {
                const { getServerSession } = await import('next-auth');
                const { authOptions } = await import('@/lib/auth');
                const session = await getServerSession(authOptions);
                if (session?.user && (session.user as any).schoolId) {
                    targetSchoolId = (session.user as any).schoolId;
                }
            } catch (err) {
                console.warn('Could not get session for school fallback:', err);
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

        // 6. Fetch all marks for all students in this class for the given term
        const studentIds = students.map(s => s.id);

        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, student_id, percentage, raw_score, grade_symbol, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    subjects ( id, name, category, display_order )
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

        if (!allMarks || allMarks.length === 0) {
            return NextResponse.json({ error: 'No marks found for this class and term' }, { status: 404 });
        }

        // 7. Group marks by student and calculate ranks
        const marksByStudent: Record<string, any[]> = {};
        for (const m of allMarks) {
            if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
            marksByStudent[m.student_id].push(m);
        }

        // Aggregate each student for ranking
        const aggregates = Object.entries(marksByStudent).map(([sid, marks]) => {
            const mapped: ExamMarkWithDetails[] = marks.map((m: any) => ({
                id: m.id,
                student_id: sid,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
                remarks: m.remarks,
            }));
            const perf = aggregateStudentPerformance(mapped, gradingScales);
            return { studentId: sid, percentage: perf.percentage };
        });

        const ranks = calculateClassRanks(aggregates);
        const rankedStudentCount = aggregates.length;

        // 8. Generate PDFs and add to ZIP
        const zip = new JSZip();

        for (const student of students) {
            const studentMarks = marksByStudent[student.id];
            if (!studentMarks || studentMarks.length === 0) continue;

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

            const studentPerf = aggregateStudentPerformance(mapped, gradingScales);

            // Resolve overall grade from DB grading scales
            const overallGradeSymbol = gradingScales.length > 0
                ? getGradeFromScales(studentPerf.percentage, gradingScales)
                : studentPerf.grade;

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

            // Build subject marks with category, points/rubric, and teacher comments
            const subjectMarks = studentMarks.map((m: any) => {
                const subject = m.exams.subjects;
                const sname = subject?.name || 'Unknown Subject';
                const category = subject?.category || 'OTHER';
                const pct = Number(m.percentage);

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

            // Sort by category then name
            subjectMarks.sort((a: any, b: any) => {
                const catDiff = getCategoryOrder(a.category) - getCategoryOrder(b.category);
                if (catDiff !== 0) return catDiff;
                return a.subjectName.localeCompare(b.subjectName);
            });

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
                classRank: ranks.get(student.id) || 0,
                totalStudents: rankedStudentCount,
                classTeacherComment: classTeacherComment || undefined,
                principalComment: principalComment || undefined,
                gradeBoundaries,
                resultUrl: `${baseUrl}/student/${student.id}`,
            };

            const pdfBuffer = await generateStudentReportCardPDF(reportData);

            const fileName = `${lastName}_${firstName}_${termTitle}.pdf`;
            zip.file(fileName, pdfBuffer);
        }

        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

        return new NextResponse(new Uint8Array(zipContent), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="Class_Reports_${termTitle}.zip"`,
            },
        });

    } catch (error: any) {
        console.error('Batch PDF Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate class reports' }, { status: 500 });
    }
}
