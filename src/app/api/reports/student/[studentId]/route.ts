import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateStudentReportCardPDF, ReportCardData } from '@/lib/pdfGenerator';
import { aggregateStudentPerformance, calculateClassRanks, generateFeedback } from '@/lib/analytics';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const studentId = (await params).studentId;

        // 1. Fetch Student Data
        const { data: student, error: studentErr } = await supabase
            .from('students')
            .select(`
        *,
        classes (name, academic_year)
      `)
            .eq('id', studentId)
            .single();

        if (studentErr || !student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Fetch Marks for exactly one exam (for simplicity, passing examId via query param or default to latest)
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');

        let marksQuery = supabase
            .from('marks')
            .select(`
        *,
        subjects (name),
        exams (title, academic_year, term)
      `)
            .eq('student_id', studentId);

        if (examId) {
            marksQuery = marksQuery.eq('exam_id', examId);
        }

        const { data: marks, error: marksErr } = await marksQuery;

        if (marksErr || !marks || marks.length === 0) {
            return NextResponse.json({ error: 'No marks found for student' }, { status: 404 });
        }

        // Use the exam details from the first mark record
        const examInfo = marks[0].exams;

        // 3. For accurate Class Rank, we need all students' marks for this class & exam
        const { data: classMarks } = await supabase
            .from('marks')
            .select('student_id, score, total_possible')
            .eq('exam_id', examInfo.id)
            .in('student_id', (
                await supabase.from('students').select('id').eq('class_id', student.class_id)
            ).data?.map(s => s.id) || []);

        // 4. Calculate Analytics
        const studentPerf = aggregateStudentPerformance(marks);

        // Group all class marks by student to get ranks
        const studentAggs = [];
        // Assuming classMarks exists and grouping logic... (simplified here for brevity)
        // We will just fetch count of students in class for the ratio
        const { count: totalStudents } = await supabase
            .from('students')
            .select('*', { count: 'exact' })
            .eq('class_id', student.class_id);

        // Mock rank for now if we don't have full data aggregation
        const classRank = 1;

        // 5. Structure data for Handlebars
        const reportData: ReportCardData = {
            schoolName: 'Evergreen International Academy',
            examTitle: examInfo.title,
            academicYear: student.classes.academic_year,
            studentName: `${student.first_name} ${student.last_name}`,
            enrollmentNumber: student.enrollment_number,
            className: student.classes.name,
            subjectMarks: marks.map((m: any) => {
                const perf = aggregateStudentPerformance([m]);
                return {
                    subjectName: m.subjects.name,
                    score: m.score,
                    totalPossible: m.total_possible,
                    percentage: perf.percentage,
                    grade: perf.grade,
                    gradeBase: perf.grade.replace('+', ''), // A+ -> A for colour class
                    remarks: m.remarks || 'No remarks provided.'
                };
            }),
            overallPercentage: studentPerf.percentage,
            gpa: studentPerf.gpa,
            classRank: classRank,
            totalStudents: totalStudents || 1,
            actionableFeedback: generateFeedback(studentPerf.percentage, 'General Academics')
        };

        // 6. Generate PDF Buffer
        const pdfBuffer = await generateStudentReportCardPDF(reportData);

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${student.first_name}_${student.last_name}_Report.pdf"`,
            },
        });

    } catch (error) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
