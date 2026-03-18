import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { generateStudentReportCardPDF, ReportCardData } from '@/lib/pdfGenerator';
import { aggregateStudentPerformance, calculateClassRanks, generateFeedback } from '@/lib/analytics';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const studentId = (await params).studentId;
        const { searchParams } = new URL(request.url);
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

        // Fetch school name dynamically
        let schoolName = 'School';
        if (student.users?.school_id) {
            const { data: schoolData } = await supabase.from('schools').select('name').eq('id', student.users.school_id).single();
            if (schoolData) {
                schoolName = schoolData.name;
            }
        }

        // 2. Fetch Marks for the specified term
        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, percentage, raw_score, grade_symbol, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    terms ( name ),
                    academic_years ( name ),
                    subjects ( id, name )
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

        if (marksErr || !marks || marks.length === 0) {
            return NextResponse.json({ error: 'No marks found for student in this term' }, { status: 404 });
        }

        const firstExam = marks[0].exams as any;
        const termTitle = firstExam.terms?.name || 'Term Report';
        const academicYear = firstExam.academic_years?.name || 'Academic Year';

        // 3. Map to analytics interface and calculate performance
        const mappedMarks = marks.map((m: any) => ({
            id: m.id,
            student_id: studentId,
            subject_id: m.exams.subjects?.id || '',
            exam_id: m.exams.id || '',
            score: Number(m.raw_score),
            total_possible: Number(m.exams.max_score),
            remarks: m.remarks
        }));

        const studentPerf = aggregateStudentPerformance(mappedMarks);

        // 4. Calculate class ranking — fetch all classmates' marks for the same term
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
                const classmateIds = classmates.map(c => c.id);

                // Fetch all marks for all classmates within the same exam scope
                let rankQuery = supabase
                    .from('exam_marks')
                    .select('student_id, raw_score, exams!inner(max_score, term_id, academic_year_id)')
                    .in('student_id', classmateIds);

                if (termId) rankQuery = rankQuery.eq('exams.term_id', termId);
                if (yearId) rankQuery = rankQuery.eq('exams.academic_year_id', yearId);

                const { data: allMarks } = await rankQuery;

                if (allMarks && allMarks.length > 0) {
                    // Aggregate per student
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

        // 5. Resolve overall grade from DB grading scales
        let overallGradeSymbol = studentPerf.grade;
        if (student.academic_level_id) {
            const { data: gradingSystem } = await supabase
                .from('grading_systems')
                .select('id')
                .eq('academic_level_id', student.academic_level_id)
                .limit(1)
                .single();

            if (gradingSystem) {
                const { data: matchedScale } = await supabase
                    .from('grading_scales')
                    .select('symbol')
                    .eq('grading_system_id', gradingSystem.id)
                    .lte('min_percentage', studentPerf.percentage)
                    .gte('max_percentage', studentPerf.percentage)
                    .order('min_percentage', { ascending: false })
                    .limit(1)
                    .single();

                if (matchedScale) {
                    overallGradeSymbol = matchedScale.symbol;
                }
            }
        }

        // 6. Structure data for PDF Generator
        const reportData: ReportCardData = {
            schoolName,
            examTitle: termTitle,
            academicYear: academicYear,
            studentName: `${student.users?.first_name} ${student.users?.last_name}`,
            enrollmentNumber: student.admission_number || '',
            className: student.grade_streams?.full_name || 'N/A',
            subjectMarks: marks.map((m: any) => {
                const sname = m.exams.subjects?.name || 'Unknown Subject';
                const gradeBase = (m.grade_symbol || 'F').replace(/[+-]/g, '');

                return {
                    subjectName: sname,
                    score: Number(m.raw_score),
                    totalPossible: Number(m.exams.max_score),
                    percentage: Number(m.percentage),
                    grade: m.grade_symbol || '-',
                    gradeBase: gradeBase,
                    remarks: m.remarks || 'No remarks provided.',
                };
            }),
            overallPercentage: studentPerf.percentage,
            overallGrade: overallGradeSymbol,
            gpa: studentPerf.gpa,
            classRank,
            totalStudents,
            actionableFeedback: generateFeedback(studentPerf.percentage, 'General Academics')
        };

        // 7. Generate PDF Buffer
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
