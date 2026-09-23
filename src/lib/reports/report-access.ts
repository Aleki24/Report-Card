import { NextResponse } from 'next/server';
import { getAuthSession, type ServerSession } from '@/lib/auth-server';
import { getTeacherPermissions } from '@/lib/teacher-utils';
import { streamBelongsToSchool } from '@/lib/tenant-scope';

export type SchoolSession = ServerSession & { schoolId: string };

export type ReportAccess =
    | { ok: true; session: SchoolSession }
    | { ok: false; response: NextResponse };

function deny(error: string, status: number): ReportAccess {
    return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * The signed-in, active user with a school, or the response to send instead.
 * Goes through getAuthSession so a deactivated account is refused even while
 * its Clerk session is still valid.
 */
export async function requireSchoolSession(): Promise<ReportAccess> {
    const session = await getAuthSession();
    if (!session) return deny('Unauthorized', 401);
    if (!session.schoolId) return deny('No school associated', 403);
    return { ok: true, session: session as SchoolSession };
}

/** Admins, and the class teacher of this stream. */
export async function canStaffReportOnStream(
    session: Pick<ServerSession, 'role' | 'userId'>,
    streamId: string,
): Promise<boolean> {
    if (session.role === 'ADMIN') return true;
    const perms = await getTeacherPermissions(session.userId);
    return perms.isClassTeacher && perms.classTeacherStreams.includes(streamId);
}

/**
 * Gate for whole-class documents (class report cards, mark sheets, report
 * comments): the stream must belong to the caller's school, and the caller
 * must be an admin or that stream's class teacher.
 *
 * Runs before any class data is read. The routes used to load the class's
 * students first and only then check the caller, which answered an
 * unauthenticated request with "No students found" versus 401 — enough to
 * probe which class ids exist — and let a class whose first student had no
 * school row skip the school comparison entirely.
 */
export async function authorizeClassReport(streamId: string, forbiddenMessage: string): Promise<ReportAccess> {
    const access = await requireSchoolSession();
    if (!access.ok) return access;

    if (!(await streamBelongsToSchool(streamId, access.session.schoolId))) {
        return deny('Class not found', 404);
    }

    if (!(await canStaffReportOnStream(access.session, streamId))) {
        return deny(forbiddenMessage, 403);
    }
    return access;
}
