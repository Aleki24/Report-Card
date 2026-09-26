import { sendSchoolApprovalRequestEmail, sendSchoolApprovedEmail, type SchoolApprovalRequest } from '@/lib/email';
import { sendSMS } from '@/lib/africastalking';
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from '@/lib/whatsapp';

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

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://skulbase.com').replace(/\/$/, '');

/** Where the owner reviews every school waiting for approval. */
export const PENDING_SCHOOLS_PATH = '/dashboard/pending-schools';

/** Whether this email belongs to the platform owner (case-insensitive). */
export function isPlatformOwnerEmail(email: string | null | undefined): boolean {
    const e = email?.trim().toLowerCase();
    return !!e && platformOwnerEmails().some(o => o.toLowerCase() === e);
}

/**
 * Alert the platform owner that a school is waiting for approval: email with
 * one-click approve/reject links, and SMS and WhatsApp pointing to the list
 * of waiting schools (the single-use token is too long for a text).
 *
 * Never throws: a mail, SMS or WhatsApp outage must not roll back the
 * sign-up. The school stays PENDING_APPROVAL either way and is listed on the
 * owner's pending-schools page, so nothing depends on a message arriving.
 */
export async function notifyOwnerOfSchoolRequest(req: SchoolApprovalRequest): Promise<void> {
    const emails = platformOwnerEmails();
    const phones = platformOwnerPhones();
    const reviewUrl = `${appUrl()}${PENDING_SCHOOLS_PATH}`;
    const from = req.requesterName || req.requesterEmail || 'someone';
    const contact = [req.schoolPhone, req.schoolEmail || req.requesterEmail].filter(Boolean).join(', ') || 'no contact given';

    const results = await Promise.allSettled([
        ...(emails.length > 0 ? [sendSchoolApprovalRequestEmail(emails, req)] : []),
        ...phones.flatMap(phone => [
            sendSMS(phone, `Skulbase: "${req.schoolName}" is waiting for your approval (from ${from}). Review: ${reviewUrl}`)
                .then(res => { if (!res.success) throw new Error(`SMS to ${res.to}: ${res.error}`); }),
            sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.schoolRequest, [req.schoolName, from, contact, reviewUrl])
                .then(res => { if (!res.ok && res.error !== 'WhatsApp is not configured') throw new Error(`WhatsApp to ${res.to}: ${res.error}`); }),
        ]),
    ]);
    for (const r of results) {
        if (r.status === 'rejected') console.error('[school-approval] owner notification failed:', r.reason);
    }
}

/**
 * Tell the requester their school was approved: email, SMS and WhatsApp to
 * every number on file for them or the school. Never throws.
 */
export async function notifyRequesterOfApproval({ schoolName, firstName, email, phones }: {
    schoolName: string;
    firstName: string | null;
    email: string | null;
    phones: readonly (string | null | undefined)[];
}): Promise<void> {
    const signIn = `${appUrl()}/login`;
    const numbers = [...new Set(phones.filter((p): p is string => !!p?.trim()))];
    const results = await Promise.allSettled([
        ...(email ? [sendSchoolApprovedEmail(email, firstName, schoolName)] : []),
        ...numbers.flatMap(phone => [
            sendSMS(phone, `Skulbase: ${schoolName} has been approved. Sign in at ${signIn} to add your classes and invite your teachers.`)
                .then(res => { if (!res.success) throw new Error(`SMS to ${res.to}: ${res.error}`); }),
            sendWhatsAppTemplate(phone, WHATSAPP_TEMPLATES.schoolApproved, [firstName || 'there', schoolName, signIn])
                .then(res => { if (!res.ok && res.error !== 'WhatsApp is not configured') throw new Error(`WhatsApp to ${res.to}: ${res.error}`); }),
        ]),
    ]);
    for (const r of results) {
        if (r.status === 'rejected') console.error('[school-approval] approval notice failed:', r.reason);
    }
}
