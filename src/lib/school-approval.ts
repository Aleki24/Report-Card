import { sendSchoolApprovalRequestEmail, type SchoolApprovalRequest } from '@/lib/email';
import { sendSMS } from '@/lib/africastalking';

/**
 * Who to alert when someone asks to create a school.
 *
 * These are the platform owner's own contacts, kept as defaults so the
 * approval workflow notifies someone out of the box rather than depending on
 * deployment config being remembered. PLATFORM_OWNER_EMAIL /
 * PLATFORM_OWNER_PHONE override them without a code change.
 */
const DEFAULT_OWNER_EMAILS = ['alexotieno293@gmail.com', 'otienoalex553@gmail.com'];
const DEFAULT_OWNER_PHONES = ['0740129444'];

function fromEnvList(...vars: (string | undefined)[]): string[] {
    for (const raw of vars) {
        if (!raw) continue;
        const list = raw.split(',').map(v => v.trim()).filter(Boolean);
        if (list.length > 0) return list;
    }
    return [];
}

/** Email addresses notified of a new school request. */
export function platformOwnerEmails(): string[] {
    const configured = fromEnvList(process.env.PLATFORM_OWNER_EMAIL, process.env.PLATFORM_OWNER_EMAILS);
    return configured.length > 0 ? configured : DEFAULT_OWNER_EMAILS;
}

/** Phone numbers texted about a new school request. */
export function platformOwnerPhones(): string[] {
    const configured = fromEnvList(process.env.PLATFORM_OWNER_PHONE, process.env.PLATFORM_OWNER_PHONES);
    return configured.length > 0 ? configured : DEFAULT_OWNER_PHONES;
}

/**
 * Alert the platform owner that a school is waiting for approval.
 *
 * Email carries the one-click approve/reject links; the SMS is only a nudge to
 * go read it, because the approval token is far too long to put in a text
 * without splitting it across several messages.
 *
 * Never throws: a mail or SMS outage must not roll back the sign-up. The
 * school is parked as PENDING_APPROVAL either way, so the worst case is the
 * owner finds it in the pending list rather than in their inbox.
 */
export async function notifyOwnerOfSchoolRequest(req: SchoolApprovalRequest): Promise<void> {
    const emails = platformOwnerEmails();
    const phones = platformOwnerPhones();

    if (emails.length === 0 && phones.length === 0) {
        console.error(
            '[school-approval] no owner contacts configured — nobody was notified that ' +
            `"${req.schoolName}" (${req.schoolId}) is awaiting approval. It stays PENDING_APPROVAL ` +
            'and unusable until approved.'
        );
        return;
    }

    // Sent in parallel so a slow SMS gateway doesn't hold up the email.
    await Promise.allSettled([
        ...(emails.length > 0
            ? [sendSchoolApprovalRequestEmail(emails.join(','), req).catch(err => {
                console.error('[school-approval] owner email failed:', err);
                throw err;
              })]
            : []),
        ...phones.map(phone =>
            sendSMS(
                phone,
                `Skulbase: "${req.schoolName}" has requested a new school account`
                + `${req.requesterName ? ` (${req.requesterName})` : ''}.`
                + ' It stays locked until you approve. Check your email to approve or reject.'
            ).catch(err => {
                console.error('[school-approval] owner SMS failed:', err);
                throw err;
            })
        ),
    ]);
}
