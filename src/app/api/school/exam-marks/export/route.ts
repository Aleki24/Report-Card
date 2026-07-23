import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherPermissions, isExamVisibleToTeacher } from '@/lib/teacher-utils';
import { generateExamResultsPdf } from '@/lib/pdf/examResultsPdf';

export const runtime = 'nodejs';

function safeName(s: string) {
    return (s || 'export').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'export';
}

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const examId = searchParams.get('exam_id');
        const format = (searchParams.get('format') || 'csv').toLowerCase();
        if (!examId) {
            return NextResponse.json({ error: 'exam_id is required' }, { status: 400 });
        }
        if (format !== 'csv' && format !== 'pdf') {
            return NextResponse.json({ error: 'format must be csv or pdf' }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id, role, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const schoolId = userProfile.school_id;
        const role = userProfile.role;
        if (!schoolId) {
            return NextResponse.json({ error: 'No school associated' }, { status: 403 });
        }
        if (role === 'STUDENT') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: exam } = await supabase
            .from('exams')
            .select('id, name, max_score, school_id, status, subject_id, grade_id, grade_stream_id, created_by_teacher_id, subjects(name), grades(name_display), grade_streams(full_name)')
            .eq('id', examId)
            .maybeSingle();

        if (!exam || exam.school_id !== schoolId) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        if (role === 'CLASS_TEACHER' || role === 'SUBJECT_TEACHER') {
            const perms = await getTeacherPermissions(userId);
            if (!isExamVisibleToTeacher(exam, perms, userId)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Downloading exported results is a form of "release" — only allow it
        // once an admin has approved these results (admins can always export
        // since they're the ones doing the approving).
        if (role !== 'ADMIN' && exam.status !== 'APPROVED') {
            return NextResponse.json({
                error: exam.status === 'DRAFT'
                    ? 'These results have not been published yet. Publish them for review before exporting.'
                    : 'These results are pending admin approval and cannot be exported yet.',
            }, { status: 403 });
        }

        const { data: marks, error } = await supabase
            .from('exam_marks')
            .select(`
                id, student_id, raw_score, percentage, grade_symbol, remarks,
                students!inner (
                    admission_number,
                    users!inner ( first_name, last_name, school_id )
                )
            `)
            .eq('exam_id', examId)
            .eq('students.users.school_id', schoolId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        const mapped = (marks || []).map((m: any) => ({
            studentName: `${m.students?.users?.first_name || ''} ${m.students?.users?.last_name || ''}`.trim(),
            admissionNumber: m.students?.admission_number || '',
            rawScore: Number(m.raw_score),
            percentage: Number(m.percentage || 0),
            grade: m.grade_symbol || '-',
            remarks: m.remarks || '',
        }));

        if (mapped.length === 0) {
            return NextResponse.json({ error: 'No marks recorded for this exam yet.' }, { status: 404 });
        }

        // Same descending-by-score order and tie-aware ranking shown on screen.
        const sorted = [...mapped].sort((a, b) => b.percentage - a.percentage);
        let rank = 0;
        let prevPct: number | null = null;
        const ranked = sorted.map((m, idx) => {
            if (prevPct === null || m.percentage !== prevPct) {
                rank = idx + 1;
                prevPct = m.percentage;
            }
            return { ...m, position: rank };
        });

        const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
        const subjectName = (exam as any).subjects?.name || 'Subject';
        const className = (exam as any).grade_streams?.full_name || (exam as any).grades?.name_display || '';
        const fileBase = `${safeName(exam.name)}_${safeName(subjectName)}`;

        if (format === 'csv') {
            const header = 'Position,Student Name,Admission Number,Marks,Grade,Remarks';
            const rows = ranked.map(r =>
                `${r.position},"${r.studentName}","${r.admissionNumber}",${r.rawScore}/${exam.max_score},${r.grade},"${r.remarks.replace(/"/g, '""')}"`
            );
            const csv = [header, ...rows].join('\n');
            return new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${fileBase}.csv"`,
                },
            });
        }

        const pdfBuffer = await generateExamResultsPdf({
            schoolName: school?.name || 'School',
            examName: exam.name,
            subjectName,
            className,
            maxScore: Number(exam.max_score),
            generatedAt: new Date().toLocaleDateString(),
            rows: ranked.map(r => ({
                position: r.position,
                studentName: r.studentName,
                admissionNumber: r.admissionNumber,
                marks: `${r.rawScore}/${exam.max_score}`,
                grade: r.grade,
                remarks: r.remarks,
            })),
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileBase}.pdf"`,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
