import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkSMS } from '@/lib/africastalking';
import {
    getGradeFromScales,
} from '@/lib/analytics';
import type { GradingScale } from '@/types';

export const runtime = 'nodejs';

interface SendSMSBody {
    studentIds: string[];
    termId: string;
    academicYearId: string;
    gradeStreamId: string;
}

export async function POST(request: Request) {
    try {
        // Auth check — only authenticated users can send SMS
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: SendSMSBody = await request.json();
        const { studentIds, termId, academicYearId, gradeStreamId } = body;

        if (!studentIds?.length || !termId || !academicYearId || !gradeStreamId) {
            return NextResponse.json(
                { error: 'studentIds, termId, academicYearId, and gradeStreamId are required' },
                { status: 400 }
            );
        }

        const supabase = createSupabaseAdmin();

        // 1. Fetch students with guardian phone
        const { data: students, error: studentsErr } = await supabase
            .from('students')
            .select('id, admission_number, guardian_phone, guardian_name, users(first_name, last_name, school_id)')
            .in('id', studentIds);

        if (studentsErr || !students?.length) {
            return NextResponse.json(
                { error: studentsErr?.message || 'No students found' },
                { status: 404 }
            );
        }

        // Get school_id from first student
        const schoolId = (students[0] as any).users?.school_id;

        // 2. Fetch grading scales via grading_systems (grading_scales doesn't have school_id)
        let gradingScales: GradingScale[] = [];
        if (schoolId) {
            // First find the student's academic level to get the right grading system
            const { data: firstStudent } = await supabase
                .from('students')
                .select('academic_level_id')
                .eq('id', studentIds[0])
                .single();

            if (firstStudent?.academic_level_id) {
                const { data: gradingSystem } = await supabase
                    .from('grading_systems')
                    .select('id')
                    .eq('academic_level_id', firstStudent.academic_level_id)
                    .limit(1)
                    .single();

                if (gradingSystem) {
                    const { data: scales } = await supabase
                        .from('grading_scales')
                        .select('*')
                        .eq('grading_system_id', gradingSystem.id)
                        .order('order_index', { ascending: true });
                    gradingScales = (scales || []) as GradingScale[];
                }
            }
        }

        // 3. Fetch term & year names
        const [{ data: termData }, { data: yearData }, { data: streamData }] = await Promise.all([
            supabase.from('terms').select('name').eq('id', termId).single(),
            supabase.from('academic_years').select('name').eq('id', academicYearId).single(),
            supabase.from('grade_streams').select('full_name').eq('id', gradeStreamId).single(),
        ]);

        const termName = termData?.name || 'Term';
        const yearName = yearData?.name || '';
        const streamName = streamData?.full_name || '';

        // 4. Fetch exam marks for these students in this term
        const { data: marks } = await supabase
            .from('exam_marks')
            .select(`
                student_id,
                score,
                grade,
                exams!inner(term_id),
                subjects(name)
            `)
            .in('student_id', studentIds)
            .eq('exams.term_id', termId);

        // 5. Fetch term reports for averages/ranks
        const { data: termReports } = await supabase
            .from('term_reports')
            .select('student_id, average_score, overall_grade, rank')
            .in('student_id', studentIds)
            .eq('term_id', termId)
            .eq('grade_stream_id', gradeStreamId);

        // Count total students in class for rank context
        const { count: totalInClass } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('current_grade_stream_id', gradeStreamId);

        // 6. Build SMS messages per student
        const recipients: { phone: string; message: string }[] = [];
        const skipped: { studentId: string; name: string; reason: string }[] = [];

        for (const student of students) {
            const studentName = `${(student as any).users?.first_name || ''} ${(student as any).users?.last_name || ''}`.trim();
            const phone = student.guardian_phone;

            if (!phone) {
                skipped.push({ studentId: student.id, name: studentName, reason: 'No guardian phone' });
                continue;
            }

            // Get term report for this student
            const report = termReports?.find((r: any) => r.student_id === student.id);

            // Get subject scores
            const studentMarks = (marks || []).filter((m: any) => m.student_id === student.id);
            const subjectLines = studentMarks
                .map((m: any) => {
                    const subjectName = (m as any).subjects?.name || '?';
                    const score = m.score != null ? m.score : '-';
                    const grade = m.grade || (m.score != null && gradingScales.length > 0 ? getGradeFromScales(Number(m.score), gradingScales) : '-');
                    return `${subjectName}: ${score}% (${grade})`;
                })
                .slice(0, 8); // Max 8 subjects to keep SMS short

            const avg = report?.average_score ? Number(report.average_score).toFixed(1) : '-';
            const grade = report?.overall_grade || (report?.average_score ? getGradeFromScales(Number(report.average_score), gradingScales) : '-');
            const rank = report?.rank || '-';
            const rankStr = totalInClass ? `${rank}/${totalInClass}` : `${rank}`;

            let message = `Sathya Student Results`;
            message += `\n${studentName} - ${streamName}`;
            message += `\n${termName} ${yearName}`;
            if (subjectLines.length > 0) {
                message += `\n${subjectLines.join('\n')}`;
            }
            message += `\nAvg: ${avg}% | Grade: ${grade} | Rank: ${rankStr}`;

            recipients.push({ phone, message });
        }

        if (recipients.length === 0) {
            return NextResponse.json({
                sent: 0,
                failed: 0,
                skipped,
                error: 'No valid phone numbers found for selected students',
            });
        }

        // 7. Send SMS via Africa's Talking
        const result = await sendBulkSMS(recipients);

        return NextResponse.json({
            sent: result.sent,
            failed: result.failed,
            skipped,
            results: result.results,
        });
    } catch (err: any) {
        console.error('SMS API error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
