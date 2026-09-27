import { NextResponse } from 'next/server';
import { getCaller, type Caller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import { streamBelongsToSchool } from '@/lib/tenant-scope';
import { SCHOOL_SUBJECT_VIEW } from '@/lib/school-subjects';

/** Why the subject or class can't be used by this school, or null when both can. */
export async function assignmentRefsBelongToSchool(schoolId: string, subjectId: string, streamId: string): Promise<string | null> {
    const [streamOk, subject] = await Promise.all([
        streamBelongsToSchool(streamId, schoolId),
        createSupabaseAdmin().from(SCHOOL_SUBJECT_VIEW).select('id').eq('school_id', schoolId).eq('id', subjectId).maybeSingle(),
    ]);
    if (!streamOk) return 'Class not found in your school.';
    if (!subject.data) return 'Subject not offered by your school.';
    return null;
}

export type AssignmentAccess = { ok: true; caller: Caller } | { ok: false; response: NextResponse };

/**
 * The admin manages every assignment in the school; a teacher manages the
 * ones they set. Any teacher could once edit or delete anyone's work.
 */
export async function authorizeAssignment(assignmentId: string, verb: 'edit' | 'delete'): Promise<AssignmentAccess> {
    const caller = await getCaller();
    if (!caller) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    if (!isRoleIn(caller.role, STAFF_TEACHING_ROLES)) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    const { data: item } = await createSupabaseAdmin()
        .from('assignments')
        .select('school_id, created_by')
        .eq('id', assignmentId)
        .maybeSingle();
    if (!item || item.school_id !== caller.schoolId) {
        return { ok: false, response: NextResponse.json({ error: 'Assignment not found' }, { status: 404 }) };
    }
    if (caller.role !== 'ADMIN' && item.created_by !== caller.userId) {
        return { ok: false, response: NextResponse.json({ error: `You can only ${verb} assignments you set.` }, { status: 403 }) };
    }
    return { ok: true, caller };
}
