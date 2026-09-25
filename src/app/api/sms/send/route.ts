import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { sendBulkSMS } from '@/lib/africastalking';
import { rateLimit } from '@/lib/rate-limit';
import { getExamType } from '@/lib/exam-types';
import { selectExamRound } from '@/lib/reports/exam-round';
import {
    getGradeFromScales,
    gradeSymbolFromScales,
} from '@/lib/analytics';
import type { GradingScale } from '@/types';

const MAX_STUDENT_IDS = 500;

export const runtime = 'nodejs';

interface SendSMSBody {
    studentIds: string[];
    termId: string;
    academicYearId: string;
    gradeStreamId: string;
    /** The round the texts report (Midterm, End Term, …); most recent when omitted. */
    examType?: string | null;
}

export async function POST(request: Request) {
    try {
        const caller = await getCaller();
        if (!caller) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { userId, schoolId } = caller;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();

        // Rate-limit SMS sends per caller
        const limit = rateLimit(`sms-send:${userId}`, { maxRequests: 5, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json({ error: 'Too many SMS requests. Please wait a minute and try again.' }, { status: 429 });
        }

        const body: SendSMSBody = await request.json();
        const { studentIds, termId, academicYearId, gradeStreamId } = body;
        const requestedRound = typeof body.examType === 'string' && body.examType.trim() ? body.examType.trim() : null;

        if (!studentIds?.length || !termId || !academicYearId || !gradeStreamId) {
            return NextResponse.json(
                { error: 'studentIds, termId, academicYearId, and gradeStreamId are required' },
                { status: 400 }
            );
        }

        // A class teacher texts their own class's guardians, nobody else's.
        if (caller.role === 'CLASS_TEACHER' && !caller.classStreamIds.includes(gradeStreamId)) {
            return NextResponse.json({ error: 'You can only send results for your own class.' }, { status: 403 });
        }

        if (studentIds.length > MAX_STUDENT_IDS) {
            return NextResponse.json(
                { error: `Too many students. Maximum ${MAX_STUDENT_IDS} per request.` },
                { status: 400 }
            );
        }

        // 1. Fetch students with guardian phone (tenant-scoped to the caller's school)
        const { data: allStudents, error: studentsErr } = await supabase
            .from('students')
            .select('id, admission_number, guardian_phone, guardian_name, current_grade_stream_id, users(first_name, last_name, school_id)')
            .in('id', studentIds);

        if (studentsErr) {
            return NextResponse.json({ error: studentsErr.message }, { status: 500 });
        }

        // Tenant-scope: only keep students that belong to the caller's school.
        // Class-scope too: the results sent are this class's, so a student
        // from another class would get a message about the wrong ranking.
        const students = (allStudents || []).filter(
            (s: any) => s.users?.school_id === schoolId && s.current_grade_stream_id === gradeStreamId
        );

        if (!students.length) {
            return NextResponse.json(
                { error: 'No students found for your school' },
                { status: 404 }
            );
        }

        // Only reference student ids that passed the tenant check downstream.
        const scopedStudentIds = students.map((s: any) => s.id);

        // 2. Fetch grading scales via grading_systems (grading_scales doesn't have school_id)
        let gradingScales: GradingScale[] = [];
        if (schoolId) {
            // First find the student's academic level to get the right grading system
            const { data: firstStudent } = await supabase
                .from('students')
                .select('academic_level_id')
                .eq('id', scopedStudentIds[0])
                .maybeSingle();

            if (firstStudent?.academic_level_id) {
                // Scoped to this school plus the seeded defaults (null school_id),
                // and ordered. Matching on academic_level_id alone picked an
                // arbitrary system — possibly another school's — and these
                // grades are texted to parents.
                //
                // An OVERALL system is a points-band table and must never grade
                // a subject mark.
                const { data: gradingSystem } = await supabase
                    .from('grading_systems')
                    .select('id')
                    .eq('academic_level_id', firstStudent.academic_level_id)
                    .or(`school_id.eq.${schoolId},school_id.is.null`)
                    .neq('system_kind', 'OVERALL')
                    .order('name', { ascending: true })
                    .limit(1)
                    .maybeSingle();

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

        // 3. Fetch term, year, stream & school names
        const [{ data: termData }, { data: yearData }, { data: streamData }, { data: schoolData }] = await Promise.all([
            supabase.from('terms').select('name').eq('id', termId).maybeSingle(),
            supabase.from('academic_years').select('name').eq('id', academicYearId).maybeSingle(),
            supabase.from('grade_streams').select('full_name').eq('id', gradeStreamId).maybeSingle(),
            schoolId ? supabase.from('schools').select('name').eq('id', schoolId).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        const termName = termData?.name || 'Term';
        const yearName = yearData?.name || '';
        const streamName = streamData?.full_name || '';
        const schoolName = schoolData?.name || 'School';

        // 4. The class's marks for ONE round of this term. This used to read
        // every mark in the term, so a parent could get Midterm and End Term
        // lines for the same subject side by side, with the average and rank
        // taken from a different aggregate again. Everything below now comes
        // from the same sitting as the report cards: the round chosen on the
        // page, else the most recent one entered (same rule as the reports).
        const { data: classStudents } = await supabase
            .from('students')
            .select('id')
            .eq('current_grade_stream_id', gradeStreamId);
        const classStudentIds = (classStudents ?? []).map(s => s.id as string);

        let marksQuery = supabase
            .from('exam_marks')
            .select('student_id, percentage, grade_symbol, exams!inner(id, exam_type, exam_date, created_at, term_id, subjects (id, name))')
            .in('student_id', classStudentIds.length > 0 ? classStudentIds : scopedStudentIds)
            .eq('exams.term_id', termId);
        if (requestedRound) marksQuery = marksQuery.eq('exams.exam_type', requestedRound);
        const { data: termMarks } = await marksQuery;
        const { round, marks } = requestedRound
            ? { round: requestedRound, marks: termMarks ?? [] }
            : selectExamRound(termMarks ?? []);
        const roundLabel = round ? (getExamType(round)?.shortName ?? round) : '';

        // Mean percentage per learner over the round's subjects, and the class
        // position that mean gives (equal means share a position).
        const pctsByStudent = new Map<string, number[]>();
        for (const m of marks as { student_id: string; percentage: number | string | null }[]) {
            if (m.percentage == null) continue;
            pctsByStudent.set(m.student_id, [...(pctsByStudent.get(m.student_id) ?? []), Number(m.percentage)]);
        }
        const meanByStudent = new Map([...pctsByStudent].map(([id, p]) => [id, p.reduce((a, b) => a + b, 0) / p.length]));
        const ordered = [...meanByStudent.values()].sort((a, b) => b - a);
        const positionOf = (mean: number) => ordered.indexOf(mean) + 1;
        const totalInClass = meanByStudent.size;

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

            // Get subject scores
            const studentMarks = (marks || []).filter((m: any) => m.student_id === student.id);
            const subjectLines = studentMarks
                .map((m: any) => {
                    const subjectName = m.exams?.subjects?.name || '?';
                    // A percentage, not the raw score: "45%" for 45 out of 60 was wrong.
                    const pct = m.percentage != null ? Math.round(Number(m.percentage)) : null;
                    const grade = m.grade_symbol || (pct != null && gradingScales.length > 0 ? getGradeFromScales(pct, gradingScales) : '-');
                    return `${subjectName}: ${pct ?? '-'}% (${grade})`;
                })
                .slice(0, 8); // Max 8 subjects to keep SMS short

            const mean = meanByStudent.get(student.id);
            const avg = mean != null ? mean.toFixed(1) : '-';
            // No invented grade in a message to a parent: without a configured
            // scale the grade stays "-" rather than a built-in A–F ladder.
            const grade = mean != null ? gradeSymbolFromScales(mean, gradingScales) ?? '-' : '-';
            const rankStr = mean != null ? `${positionOf(mean)}/${totalInClass}` : '-';

            let message = `${schoolName} Student Results`;
            message += `\n${studentName} - ${streamName}`;
            message += `\n${[termName, roundLabel, yearName].filter(Boolean).join(' ')}`;
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
