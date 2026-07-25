import { createClerkClient } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Everything the public QR landing page is allowed to show for a scanned
 * token. Deliberately minimal: a token is a bearer credential printed on
 * paper, so it reveals only what the learner holding the report card already
 * knows about themselves — never marks, fees or contact details.
 */
export interface PortalStudent {
    /** students.id — the pending users.id before activation, the Clerk id after. */
    studentId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    admissionNumber: string;
    schoolName: string;
    /** Suggested login name, pre-filled into the sign-up form. */
    username: string | null;
    /** True once a Clerk account exists — the learner should sign in, not sign up. */
    isClaimed: boolean;
}

/** Where a report-card QR code points for a given student token. */
export function buildPortalUrl(baseUrl: string, portalToken: string): string {
    return `${baseUrl.replace(/\/$/, '')}/portal/${portalToken}`;
}

/**
 * A portal token is 32 hex characters (a dash-stripped UUID). Rejecting
 * anything else up front keeps malformed scans off the database entirely.
 */
export function isValidPortalToken(token: unknown): token is string {
    return typeof token === 'string' && /^[0-9a-f]{32}$/.test(token);
}

/**
 * Resolve a scanned portal token to the learner it belongs to, or null if the
 * token is unknown, malformed, or points at a record that is no longer usable.
 *
 * `isClaimed` is answered by Clerk rather than by anything in our own tables:
 * the users row exists from the moment an admin adds the learner, so only
 * Clerk knows whether someone has actually set a password on the account.
 */
export async function lookupPortalStudent(token: string): Promise<PortalStudent | null> {
    if (!isValidPortalToken(token)) return null;

    const supabase = createSupabaseAdmin();

    const { data: student, error } = await supabase
        .from('students')
        .select('id, admission_number, status')
        .eq('portal_token', token)
        .maybeSingle();

    if (error || !student) return null;

    // A withdrawn or graduated learner keeps their record for reporting, but
    // their QR must not hand out a live portal account.
    if (student.status && student.status !== 'ACTIVE') return null;

    const { data: user } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, role, school_id, is_active')
        .eq('id', student.id)
        .maybeSingle();

    if (!user || user.role !== 'STUDENT' || user.is_active === false) return null;

    let schoolName = 'your school';
    if (user.school_id) {
        const { data: school } = await supabase
            .from('schools')
            .select('name')
            .eq('id', user.school_id)
            .maybeSingle();
        if (school?.name) schoolName = school.name;
    }

    let isClaimed = false;
    try {
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        await clerkClient.users.getUser(student.id);
        isClaimed = true;
    } catch {
        // No Clerk account for this id — the learner has not signed up yet.
    }

    return {
        studentId: student.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`.trim(),
        admissionNumber: student.admission_number,
        schoolName,
        username: user.username,
        isClaimed,
    };
}
