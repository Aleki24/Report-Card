import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherPermissions, isExamVisibleToTeacher } from '@/lib/teacher-utils';
import { fetchExamComponentScheme } from '@/lib/multi-paper-server';
import { isMultiPaper } from '@/lib/multi-paper';

const VALID_ACTIONS = ['publish', 'approve', 'unpublish'] as const;
type Action = typeof VALID_ACTIONS[number];

interface StudentGap { name: string; admission_number: string; missing?: string[] }
export interface PublishReadiness {
    isMultiPaper: boolean;
    papers: { code: string; name: string }[];
    rosterCount: number;
    markedCount: number;
    fullyMarkedCount: number;
    /** Roster students with no marks at all — excluded from the submission. */
    unmarked: StudentGap[];
    /** Marked students missing one or more papers (still submitted, scored on what's entered). */
    partiallyMarked: StudentGap[];
    hasIssues: boolean;
}

/**
 * Build the pre-publish readiness report for an exam: who in the class is
 * fully marked, who is missing some papers (still submitted, scored on the
 * papers they have), and who has no marks at all (excluded). Drives the
 * teacher's "are you sure?" confirmation so results are published knowingly.
 */
async function computePublishReadiness(
    supabase: SupabaseClient,
    exam: { id: string; school_id: string; grade_id: string; grade_stream_id: string | null; subject_id: string }
): Promise<PublishReadiness> {
    // Roster = students in the exam's stream (or across the grade's streams for
    // a grade-wide exam), narrowed to those enrolled in the subject when the
    // subject has an explicit roster (electives) — mirrors mark entry.
    let streamIds: string[] = [];
    if (exam.grade_stream_id) {
        streamIds = [exam.grade_stream_id];
    } else {
        const { data: streams } = await supabase.from('grade_streams').select('id').eq('grade_id', exam.grade_id);
        streamIds = (streams || []).map((s: any) => s.id);
    }

    let roster: { id: string; admission_number: string; name: string }[] = [];
    if (streamIds.length > 0) {
        const { data: rosterRows } = await supabase
            .from('students')
            .select('id, admission_number, users!inner(first_name, last_name, school_id)')
            .in('current_grade_stream_id', streamIds)
            .eq('users.school_id', exam.school_id);
        roster = (rosterRows || []).map((s: any) => ({
            id: s.id,
            admission_number: s.admission_number || '',
            name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
        }));

        // Subject enrollment filter (only when the subject has any enrollment)
        if (roster.length > 0) {
            const { data: enrollments } = await supabase
                .from('student_subjects')
                .select('student_id')
                .eq('subject_id', exam.subject_id)
                .in('student_id', roster.map(s => s.id));
            const enrolledIds = new Set((enrollments || []).map((e: any) => e.student_id));
            if (enrolledIds.size > 0) roster = roster.filter(s => enrolledIds.has(s.id));
        }
    }

    const { data: markRows } = await supabase
        .from('exam_marks')
        .select('student_id')
        .eq('exam_id', exam.id);
    const markedIds = new Set((markRows || []).map((m: any) => m.student_id));

    const scheme = await fetchExamComponentScheme(supabase, exam.id);
    const multi = isMultiPaper(scheme);
    const papers = multi && scheme ? (scheme.components || []).map(c => ({ code: c.component_code, name: c.component_name })) : [];

    // Per-student entered papers (multi-paper only)
    const enteredByStudent = new Map<string, Set<string>>();
    if (multi && scheme) {
        const { data: comps } = await supabase
            .from('exam_mark_components')
            .select('student_id, component_id')
            .eq('exam_id', exam.id);
        for (const c of comps || []) {
            const set = enteredByStudent.get(c.student_id) || new Set<string>();
            set.add(c.component_id);
            enteredByStudent.set(c.student_id, set);
        }
    }

    const unmarked: StudentGap[] = [];
    const partiallyMarked: StudentGap[] = [];
    let fullyMarkedCount = 0;

    for (const s of roster) {
        if (!markedIds.has(s.id)) {
            unmarked.push({ name: s.name, admission_number: s.admission_number });
            continue;
        }
        if (multi && scheme) {
            const entered = enteredByStudent.get(s.id) || new Set<string>();
            const missing = (scheme.components || []).filter(c => !entered.has(c.id)).map(c => c.component_name);
            if (missing.length > 0) {
                partiallyMarked.push({ name: s.name, admission_number: s.admission_number, missing });
            } else {
                fullyMarkedCount++;
            }
        } else {
            fullyMarkedCount++;
        }
    }

    return {
        isMultiPaper: multi,
        papers,
        rosterCount: roster.length,
        markedCount: markedIds.size,
        fullyMarkedCount,
        unmarked,
        partiallyMarked,
        hasIssues: unmarked.length > 0 || partiallyMarked.length > 0,
    };
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { examId } = await params;
        if (!examId) return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();
        if (!userProfile || userProfile.is_active === false || !userProfile.school_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: exam } = await supabase
            .from('exams')
            .select('id, school_id, status, grade_id, grade_stream_id, subject_id')
            .eq('id', examId)
            .maybeSingle();
        if (!exam || exam.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        const readiness = await computePublishReadiness(supabase, exam);
        return NextResponse.json({ status: exam.status, readiness });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examId } = await params;
        if (!examId) {
            return NextResponse.json({ error: 'Exam ID is required' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const action = body.action as Action;
        if (!VALID_ACTIONS.includes(action)) {
            return NextResponse.json({ error: `Invalid action. Use one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
        }

        const supabase = createSupabaseAdmin();

        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id, is_active')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.is_active === false) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!userProfile.school_id) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
        }

        const { data: exam } = await supabase
            .from('exams')
            .select('id, school_id, status, created_by_teacher_id, grade_id, grade_stream_id, subject_id, published_by, name')
            .eq('id', examId)
            .maybeSingle();

        if (!exam || exam.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        const isAdmin = userProfile.role === 'ADMIN';

        // "Those who added" = the teacher who created the exam, or a class/subject
        // teacher whose assignment covers it — the same visibility rule already
        // used to decide who can see/enter marks for this exam.
        const canActAsOwner = async () => {
            if (isAdmin) return true;
            const perms = await getTeacherPermissions(userId);
            return isExamVisibleToTeacher(exam, perms, userId);
        };

        if (action === 'publish') {
            if (exam.status !== 'DRAFT') {
                return NextResponse.json({ error: `Cannot publish — results are already ${exam.status === 'PENDING_APPROVAL' ? 'pending approval' : 'approved'}.` }, { status: 409 });
            }
            if (!(await canActAsOwner())) {
                return NextResponse.json({ error: 'Only the teacher who entered these marks (or an admin) can publish them.' }, { status: 403 });
            }
            const { count: markCount } = await supabase
                .from('exam_marks')
                .select('id', { count: 'exact', head: true })
                .eq('exam_id', examId);
            if (!markCount) {
                return NextResponse.json({ error: 'Enter at least one student\'s marks before publishing.' }, { status: 400 });
            }

            const readiness = await computePublishReadiness(supabase, exam);

            // Two-step publish: the first call (no confirm) returns the readiness
            // report so the teacher can see who is missing papers or has no marks
            // before committing. Nothing is published until confirm is sent.
            if (!body.confirm) {
                return NextResponse.json({ requiresConfirmation: true, readiness });
            }

            const { data: updated, error } = await supabase
                .from('exams')
                .update({ status: 'PENDING_APPROVAL', published_by: userId, published_at: new Date().toISOString() })
                .eq('id', examId)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ success: true, data: updated, readiness });
        }

        if (action === 'approve') {
            if (!isAdmin) {
                return NextResponse.json({ error: 'Only an admin can approve results.' }, { status: 403 });
            }
            if (exam.status !== 'PENDING_APPROVAL') {
                return NextResponse.json({ error: exam.status === 'DRAFT' ? 'These results have not been published yet.' : 'These results are already approved.' }, { status: 409 });
            }
            const { data: updated, error } = await supabase
                .from('exams')
                .update({ status: 'APPROVED', approved_by: userId, approved_at: new Date().toISOString() })
                .eq('id', examId)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ success: true, data: updated });
        }

        // unpublish
        if (exam.status === 'DRAFT') {
            return NextResponse.json({ error: 'These results are already in draft.' }, { status: 409 });
        }
        if (exam.status === 'PENDING_APPROVAL') {
            // Reverting a pending publish — same people who could publish it.
            if (!(await canActAsOwner())) {
                return NextResponse.json({ error: 'Only the teacher who published these marks (or an admin) can unpublish them.' }, { status: 403 });
            }
            const { data: updated, error } = await supabase
                .from('exams')
                .update({ status: 'DRAFT', published_by: null, published_at: null })
                .eq('id', examId)
                .select()
                .single();
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
            return NextResponse.json({ success: true, data: updated });
        }
        // status === 'APPROVED' — undoing an approval is an admin-only action
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only an admin can unpublish already-approved results.' }, { status: 403 });
        }
        const { data: updated, error } = await supabase
            .from('exams')
            .update({ status: 'PENDING_APPROVAL', approved_by: null, approved_at: null })
            .eq('id', examId)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ success: true, data: updated });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
