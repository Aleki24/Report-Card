import { sendSchoolApprovalRequestEmail, type SchoolApprovalRequest } from '@/lib/email';

/**
 * Who gets told when someone asks to create a school.
 *
 * Comma-separated so the owner can add a colleague. Falls back to nothing —
 * and `notifyOwnerOfSchoolRequest` shouts in the logs rather than failing
 * quietly, because a silent no-op here is the exact problem this workflow
 * exists to fix.
 */
export function platformOwnerEmails(): string[] {
    const raw = process.env.PLATFORM_OWNER_EMAIL || process.env.PLATFORM_OWNER_EMAILS || '';
    return raw.split(',').map(e => e.trim()).filter(Boolean);
}

/**
 * Email the platform owner that a school is waiting for approval.
 *
 * Never throws: a mail outage must not roll back the sign-up. The school is
 * still parked as PENDING_APPROVAL either way, so the worst case is that the
 * owner has to find it in the pending list rather than in their inbox.
 */
export async function notifyOwnerOfSchoolRequest(req: SchoolApprovalRequest): Promise<void> {
    const owners = platformOwnerEmails();
    if (owners.length === 0) {
        console.error(
            '[school-approval] PLATFORM_OWNER_EMAIL is not set — nobody was notified that ' +
            `"${req.schoolName}" (${req.schoolId}) is awaiting approval. It stays PENDING_APPROVAL ` +
            'and unusable until approved.'
        );
        return;
    }
    try {
        await sendSchoolApprovalRequestEmail(owners.join(','), req);
    } catch (err) {
        console.error('[school-approval] failed to email the platform owner:', err);
    }
}
