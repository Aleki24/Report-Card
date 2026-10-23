import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/postgrest';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { getTeacherPermissions, isExamVisibleToTeacher, markableStudentIds } from '@/lib/teacher-utils';
import { MARK_HISTORY_TABLE, MISSING_TABLE } from '@/lib/mark-history-server';
import type { MarkChange, MarkChangeAction, MarkHistoryResponse } from '@/lib/mark-history';

/**
 * GET ?exam_id=&student_id= — the latest changes to an exam's marks, newest
 * first; one learner's when student_id is given. Whoever can open the mark
 * sheet can read its history; a teacher sees the learners they mark.
 */

const LIMIT = 200;

interface HistoryRow {
    id: number;
    student_id: string;
    action: MarkChangeAction;
    old_score: number | null;
    new_score: number | null;
    old_grade: string | null;
    new_grade: string | null;
    changed_by: string | null;
    changed_at: string;
}

const fullName = (u: { first_name: string | null; last_name: string | null }) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();

export async function GET(request: NextRequest) {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!caller.schoolId || !isRoleIn(caller.role, STAFF_TEACHING_ROLES)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const params = new URL(request.url).searchParams;
    const examId = params.get('exam_id');
    const studentId = params.get('student_id');
    if (!examId || !isUuid(examId)) return NextResponse.json({ error: 'exam_id is required' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data: exam } = await supabase
        .from('exams')
        .select('id, school_id, grade_id, grade_stream_id, subject_id, created_by_teacher_id')
        .eq('id', examId)
        .maybeSingle();
    if (!exam || exam.school_id !== caller.schoolId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const perms = caller.role === 'ADMIN' ? null : await getTeacherPermissions(caller.userId);
    if (perms && !isExamVisibleToTeacher(exam, perms, caller.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let query = supabase
        .from(MARK_HISTORY_TABLE)
        .select('id, student_id, action, old_score, new_score, old_grade, new_grade, changed_by, changed_at')
        .eq('exam_id', examId)
        .order('changed_at', { ascending: false })
        .limit(LIMIT);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query.returns<HistoryRow[]>();
    if (error) {
        if (error.code === MISSING_TABLE) return NextResponse.json({ data: [], recording: false } satisfies MarkHistoryResponse);
        return NextResponse.json({ error: 'Could not load the history' }, { status: 500 });
    }

    let rows = data ?? [];
    // A stream's teacher sees the history of the learners they mark, as on the sheet.
    if (perms && exam.created_by_teacher_id !== caller.userId && rows.length > 0) {
        const allowed = await markableStudentIds(perms, exam.subject_id as string, [...new Set(rows.map(r => r.student_id))]);
        rows = rows.filter(r => allowed.has(r.student_id));
    }

    const userIds = [...new Set(rows.flatMap(r => (r.changed_by ? [r.student_id, r.changed_by] : [r.student_id])))];
    const { data: users } = userIds.length === 0
        ? { data: [] }
        : await supabase.from('users').select('id, first_name, last_name').eq('school_id', caller.schoolId).in('id', userIds);
    const nameOf = new Map((users ?? []).map(u => [u.id as string, fullName(u)]));

    const changes: MarkChange[] = rows.map(r => ({
        id: r.id,
        studentId: r.student_id,
        studentName: nameOf.get(r.student_id) || 'A learner',
        action: r.action,
        oldScore: r.old_score === null ? null : Number(r.old_score),
        newScore: r.new_score === null ? null : Number(r.new_score),
        oldGrade: r.old_grade,
        newGrade: r.new_grade,
        changedBy: r.changed_by ? nameOf.get(r.changed_by) || 'A staff member' : null,
        changedAt: r.changed_at,
    }));
    return NextResponse.json({ data: changes, recording: true } satisfies MarkHistoryResponse);
}
