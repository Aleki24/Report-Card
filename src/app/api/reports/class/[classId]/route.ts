import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { generateStudentReportCardPDF, ReportCardData } from '@/lib/pdfGenerator';
import { aggregateStudentPerformance, calculateClassRanks, generateFeedback } from '@/lib/analytics';
import JSZip from 'jszip';

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

        const totalStudents = students.length;

        // 2. Fetch school name dynamically from the first student's record
        let schoolName = 'School';
        const firstSchoolId = (students[0].users as any)?.school_id;
        if (firstSchoolId) {
            const { data: schoolData } = await supabase.from('schools').select('name').eq('id', firstSchoolId).single();
            if (schoolData) schoolName = schoolData.name;
        }

        // 3. Fetch term/year info
        let termTitle = 'Term Report';
        let academicYearName = 'Academic Year';
        if (termId) {
            const { data: termData } = await supabase.from('terms').select('name').eq('id', termId).single();
            if (termData) termTitle = termData.name;
        }
        if (yearId) {
            const { data: yearData } = await supabase.from('academic_years').select('name').eq('id', yearId).single();
            if (yearData) academicYearName = yearData.name;
        }

        // 4. Fetch all marks for all students in this class for the given term
        const studentIds = students.map(s => s.id);

        let marksQuery = supabase
            .from('exam_marks')
            .select(`
                id, student_id, percentage, raw_score, grade_symbol, remarks,
                exams!inner ( id, name, max_score, term_id, academic_year_id,
                    subjects ( id, name )
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

        // 5. Group marks by student and calculate ranks
        const marksByStudent: Record<string, any[]> = {};
        for (const m of allMarks) {
            if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
            marksByStudent[m.student_id].push(m);
        }

        // Aggregate each student for ranking
        const aggregates = Object.entries(marksByStudent).map(([sid, marks]) => {
            const mapped = marks.map((m: any) => ({
                id: m.id,
                student_id: sid,
                subject_id: m.exams.subjects?.id || '',
                exam_id: m.exams.id || '',
                score: Number(m.raw_score),
                total_possible: Number(m.exams.max_score),
                remarks: m.remarks,
            }));
            const perf = aggregateStudentPerformance(mapped);
            return { studentId: sid, percentage: perf.percentage };
        });

        const ranks = calculateClassRanks(aggregates);
        const rankedStudentCount = aggregates.length;

        // 6. Generate PDFs and add to ZIP
        const zip = new JSZip();

        for (const student of students) {
            const studentMarks = marksByStudent[student.id];
            if (!studentMarks || studentMarks.length === 0) continue;

            const mapped = studentMarks.map((m: any) => ({
                id: m.id,
                student_id: student.id,
                subject_id: m.exams.subjects?.id || '',
                exam_id: m.exams.id || '',
                score: Number(m.raw_score),
                total_possible: Number(m.exams.max_score),
                remarks: m.remarks,
            }));

            const studentPerf = aggregateStudentPerformance(mapped);

            // Resolve grade from DB grading scales if possible
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

            const firstName = (student.users as any)?.first_name || 'Student';
            const lastName = (student.users as any)?.last_name || '';
            const streamName = (student.grade_streams as any)?.full_name || 'N/A';

            const reportData: ReportCardData = {
                schoolName,
                examTitle: termTitle,
                academicYear: academicYearName,
                studentName: `${firstName} ${lastName}`,
                enrollmentNumber: student.admission_number || '',
                className: streamName,
                subjectMarks: studentMarks.map((m: any) => {
                    const gradeBase = (m.grade_symbol || 'F').replace(/[+-]/g, '');
                    return {
                        subjectName: m.exams.subjects?.name || 'Unknown Subject',
                        score: Number(m.raw_score),
                        totalPossible: Number(m.exams.max_score),
                        percentage: Number(m.percentage),
                        grade: m.grade_symbol || '-',
                        gradeBase,
                        remarks: m.remarks || '',
                    };
                }),
                overallPercentage: studentPerf.percentage,
                overallGrade: overallGradeSymbol,
                gpa: studentPerf.gpa,
                classRank: ranks.get(student.id) || 0,
                totalStudents: rankedStudentCount,
                actionableFeedback: generateFeedback(studentPerf.percentage, 'General Academics'),
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
