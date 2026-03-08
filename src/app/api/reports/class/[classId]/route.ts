import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateStudentReportCardPDF, ReportCardData } from '@/lib/pdfGenerator';
import { aggregateStudentPerformance, generateFeedback } from '@/lib/analytics';
import JSZip from 'jszip';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ classId: string }> }
) {
    try {
        const classId = (await params).classId;
        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('examId');

        if (!examId) {
            return NextResponse.json({ error: 'examId is required for class reports' }, { status: 400 });
        }

        // 1. Fetch Students in Class
        const { data: students, error: studentsErr } = await supabase
            .from('students')
            .select('*, classes (name, academic_year)')
            .eq('class_id', classId);

        if (studentsErr || !students || students.length === 0) {
            return NextResponse.json({ error: 'No students found in this class' }, { status: 404 });
        }

        const totalStudents = students.length;
        const zip = new JSZip();

        // 2. Fetch Exam details
        const { data: examInfo } = await supabase
            .from('exams')
            .select('*')
            .eq('id', examId)
            .single();

        // 3. Loop through students and build PDFs
        // For large classes, you would want to run these sequentially or in small batches
        // to prevent overwhelming Puppeteer / memory
        for (const student of students) {
            const { data: marks } = await supabase
                .from('marks')
                .select('*, subjects(name)')
                .eq('student_id', student.id)
                .eq('exam_id', examId);

            if (!marks || marks.length === 0) continue; // Skip students with no marks

            const studentPerf = aggregateStudentPerformance(marks);

            const reportData: ReportCardData = {
                schoolName: 'Evergreen International Academy',
                examTitle: examInfo?.title || 'Exam Report',
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
                        gradeBase: perf.grade.replace('+', ''),
                        remarks: m.remarks || ''
                    };
                }),
                overallPercentage: studentPerf.percentage,
                gpa: studentPerf.gpa,
                classRank: 0, // Simplified for batch
                totalStudents,
                actionableFeedback: generateFeedback(studentPerf.percentage, 'General Academics')
            };

            const pdfBuffer = await generateStudentReportCardPDF(reportData);

            // Add PDF to Zip
            const fileName = `${student.last_name}_${student.first_name}_${examInfo?.title || 'Report'}.pdf`;
            zip.file(fileName, pdfBuffer);
        }

        const zipContent = await zip.generateAsync({ type: 'blob' });

        return new NextResponse(zipContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="Class_${students[0].classes.name}_Reports.zip"`,
            },
        });

    } catch (error) {
        console.error('Batch PDF Generation Error:', error);
        return NextResponse.json({ error: 'Failed to generate class reports' }, { status: 500 });
    }
}
