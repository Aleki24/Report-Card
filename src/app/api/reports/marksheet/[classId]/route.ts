import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
    aggregateStudentPerformance,
    calculateClassRanks,
    getGradeFromScales,
} from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import type { GradingScale } from '@/types';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ classId: string }> }
) {
    try {
        const classId = (await params).classId;
        const { searchParams } = new URL(request.url);
        const termId = searchParams.get('termId');
        const yearId = searchParams.get('yearId');

        if (!termId) {
            return NextResponse.json({ error: 'termId is required for marksheet reports' }, { status: 400 });
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

        // 2. Fetch school info
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
        if (!userSchoolId || (targetSchoolId && targetSchoolId !== userSchoolId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (targetSchoolId) {
            const { data: schoolData } = await supabase.from('schools').select('name, logo_url, address').eq('id', targetSchoolId).single();
            if (schoolData) {
                schoolName = schoolData.name;
                schoolLogoUrl = schoolData.logo_url || undefined;
                schoolAddress = schoolData.address || undefined;
            }
        }

        // 3. Grading info
        let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
        let gradingScales: GradingScale[] = [];

        const firstAcademicLevelId = students[0].academic_level_id;
        if (firstAcademicLevelId) {
            const { data: academicLevel } = await supabase.from('academic_levels').select('code').eq('id', firstAcademicLevelId).single();
            if (academicLevel) {
                gradingSystemType = academicLevel.code === 'CBC' ? 'CBC' : 'KCSE';
            }

            const { data: gradingSystem } = await supabase.from('grading_systems').select('id').eq('academic_level_id', firstAcademicLevelId).limit(1).single();

            if (gradingSystem) {
                const { data: scales } = await supabase.from('grading_scales').select('*').eq('grading_system_id', gradingSystem.id).order('order_index', { ascending: true });
                if (scales) gradingScales = scales as GradingScale[];
            }
        }

        // 4. Term and Year Titles
        let termTitle = 'Term Report';
        let academicYearName = 'Academic Year';
        if (termId) {
            const { data: termData } = await supabase.from('terms').select('name').eq('id', termId).single();
            if (termData) termTitle = termData.name;
        }
        const customTitle = searchParams.get('customTitle');
        if (customTitle) termTitle = customTitle;

        if (yearId) {
            const { data: yearData } = await supabase.from('academic_years').select('name').eq('id', yearId).single();
            if (yearData) academicYearName = yearData.name;
        }

        // 5. Fetch all marks
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

        if (yearId) marksQuery = marksQuery.eq('exams.academic_year_id', yearId);

        const { data: allMarks, error: marksErr } = await marksQuery;
        if (marksErr) throw marksErr;

        if (!allMarks || allMarks.length === 0) {
            return NextResponse.json({ error: 'No marks found for this class and term' }, { status: 404 });
        }

        // Collect all distinct subject names and codes for the table columns
        const subjectsMap = new Map<string, { code: string; name: string }>();
        allMarks.forEach((m: any) => {
            const sname = m.exams.subjects?.name;
            const scode = m.exams.subjects?.code;
            if (sname) subjectsMap.set(scode || sname, { code: scode || sname, name: sname });
        });
        const subjectsArray = Array.from(subjectsMap.values()).sort((a, b) => a.code.localeCompare(b.code));

        // 6. Group marks by student and calculate ranks
        const marksByStudent: Record<string, any[]> = {};
        for (const m of allMarks) {
            if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
            marksByStudent[m.student_id].push(m);
        }

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

        // 7. Aggregate data for the specific report format
        let totalClassPercentage = 0;

        const studentsData = students.map(student => {
            const studentMarks = marksByStudent[student.id] || [];
            
            const mapped: ExamMarkWithDetails[] = studentMarks.map((m: any) => ({
                id: m.id,
                student_id: student.id,
                exam_id: m.exams.id || '',
                subject_id: m.exams.subjects?.id || '',
                raw_score: Number(m.raw_score),
                percentage: Number(m.percentage || 0),
                max_score: Number(m.exams.max_score),
                grade_symbol: m.grade_symbol,
            }));

            const studentPerf = aggregateStudentPerformance(mapped, gradingScales);
            const overallGradeSymbol = gradingScales.length > 0
                ? getGradeFromScales(studentPerf.percentage, gradingScales)
                : studentPerf.grade;

            if (studentMarks.length > 0) {
                totalClassPercentage += studentPerf.percentage;
            }

            const firstName = (student.users as any)?.first_name || 'Student';
            const lastName = (student.users as any)?.last_name || '';

            const marksRecord: Record<string, number | null> = {};
            // Initialize with null using subject codes as keys
            subjectsArray.forEach(sub => marksRecord[sub.code] = null);
            
            studentMarks.forEach((m: any) => {
                const scode = m.exams.subjects?.code || m.exams.subjects?.name;
                if (scode) {
                    marksRecord[scode] = Number(m.percentage); // Taking percentage for the mark sheet
                }
            });

            return {
                studentName: `${firstName} ${lastName}`,
                admissionNumber: student.admission_number || '',
                marks: marksRecord,
                overallPercentage: studentPerf.percentage,
                overallGrade: overallGradeSymbol,
                totalPoints: studentPerf.totalPoints || 0,
                classRank: ranks.get(student.id) || 0,
            };
        }).filter(s => s.overallPercentage > 0); // only students with marks

        // Sort students by rank
        studentsData.sort((a, b) => a.classRank - b.classRank);

        // Grade distribution — computed ONLY from students who have marks (after filter)
        const gradeDistribution: Record<string, number> = {};
        for (const s of studentsData) {
            if (s.overallGrade) {
                gradeDistribution[s.overallGrade] = (gradeDistribution[s.overallGrade] || 0) + 1;
            }
        }

        const meanPercentage = studentsData.length > 0 ? (totalClassPercentage / studentsData.length) : 0;
        const meanGrade = gradingScales.length > 0 ? getGradeFromScales(meanPercentage, gradingScales) : '';

        const markSheetData = {
            schoolName,
            schoolLogoUrl,
            schoolAddress,
            examTitle: termTitle,
            academicYear: academicYearName,
            className: (students[0].grade_streams as any)?.full_name || 'Class',
            gradingSystemType,
            subjects: subjectsArray,
            students: studentsData,
            gradeDistribution,
            meanGrade,
            meanPercentage: Number(meanPercentage.toFixed(2)),
        };

        return NextResponse.json(markSheetData, { status: 200 });

    } catch (error: any) {
        console.error('Marksheet Data Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
