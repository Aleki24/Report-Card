import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (resendInstance) return resendInstance;
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  resendInstance = new Resend(resendApiKey);
  return resendInstance;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, from, replyTo }: SendEmailParams) {
  const resend = getResend();
  return resend.emails.send({
    from: from || 'Skulbase <noreply@skulbase.app>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo,
  });
}

export async function sendInviteEmail(email: string, inviteCode: string, schoolName: string) {
  const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register?code=${inviteCode}`;
  return sendEmail({
    to: email,
    subject: `You've been invited to ${schoolName} on Skulbase`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">You're Invited!</h1>
        <p>You have been invited to join <strong>${schoolName}</strong> on Skulbase.</p>
        <p>Click the button below to set up your account:</p>
        <div style="margin: 24px 0;">
          <a href="${registerUrl}"
             style="background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">Your invite code: <code style="background: #f0f0f0; padding: 2px 6px;">${inviteCode}</code></p>
      </div>
    `,
  });
}

/* ── School sign-up approval ───────────────────────────────────────────────
 * A self-service school sign-up is held until the platform owner approves it.
 * These are the three messages that workflow sends.
 */

/** Escape untrusted text before dropping it into an email body. */
function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface SchoolApprovalRequest {
  schoolId: string;
  schoolName: string;
  schoolEmail?: string | null;
  schoolPhone?: string | null;
  schoolAddress?: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  approvalToken: string;
}

/**
 * Tell the platform owner a new school is waiting, with one-click approve and
 * reject links. The links carry a single-use token so the owner can act
 * straight from their inbox without a separate console login.
 */
export async function sendSchoolApprovalRequestEmail(ownerEmail: string, req: SchoolApprovalRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const decide = (action: 'approve' | 'reject') =>
    `${base}/api/platform/schools/${req.schoolId}/decision?action=${action}&token=${encodeURIComponent(req.approvalToken)}`;

  const row = (label: string, value?: string | null) =>
    value ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">${esc(label)}</td><td style="padding:4px 0;"><strong>${esc(value)}</strong></td></tr>` : '';

  return sendEmail({
    to: ownerEmail,
    subject: `Approval needed: "${req.schoolName}" wants to join Skulbase`,
    replyTo: req.requesterEmail || undefined,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e; font-size: 20px;">A new school is requesting access</h1>
        <p>Someone signed up and asked to create a school. They <strong>cannot use the system
        until you approve</strong> — their account stays pending until then.</p>
        <table style="font-size: 14px; margin: 20px 0; border-collapse: collapse;">
          ${row('School', req.schoolName)}
          ${row('Contact email', req.schoolEmail)}
          ${row('Phone', req.schoolPhone)}
          ${row('Address', req.schoolAddress)}
          ${row('Requested by', req.requesterName)}
          ${row('Account email', req.requesterEmail)}
        </table>
        <div style="margin: 24px 0;">
          <a href="${decide('approve')}"
             style="background: #059669; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-right: 8px;">
            Approve
          </a>
          <a href="${decide('reject')}"
             style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            Reject
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">These links work once. If neither is used the school stays pending indefinitely.</p>
      </div>
    `,
  });
}

/** Let the requester know their school is live and they can sign in. */
export async function sendSchoolApprovedEmail(email: string, firstName: string | null, schoolName: string) {
  return sendEmail({
    to: email,
    subject: `${schoolName} is approved — you're live on Skulbase`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">You're approved!</h1>
        <p>Hi ${esc(firstName || 'there')},</p>
        <p><strong>${esc(schoolName)}</strong> has been approved. Your administrator account is
        now active and you can start adding teachers, students and exams.</p>
        <div style="margin: 24px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
             style="background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            Go to Dashboard
          </a>
        </div>
      </div>
    `,
  });
}

/** Let the requester know the sign-up was declined. */
export async function sendSchoolRejectedEmail(email: string, firstName: string | null, schoolName: string, note?: string | null) {
  return sendEmail({
    to: email,
    subject: `About your Skulbase request for ${schoolName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e; font-size: 20px;">Your request wasn't approved</h1>
        <p>Hi ${esc(firstName || 'there')},</p>
        <p>We couldn't approve the request to set up <strong>${esc(schoolName)}</strong> on Skulbase at this time.</p>
        ${note ? `<p style="background:#f6f6f6;padding:12px;border-radius:6px;">${esc(note)}</p>` : ''}
        <p>If you think this was a mistake, just reply to this email and we'll take another look.</p>
      </div>
    `,
  });
}

/**
 * Acknowledge a school request to the person who made it.
 *
 * Before approval existed this moment sent a welcome email saying the account
 * was ready — no longer true, since the school is held until the platform
 * owner approves. This says what actually happened instead, so a requester
 * isn't left wondering whether the form worked.
 */
export async function sendSchoolRequestReceivedEmail(email: string, firstName: string | null, schoolName: string) {
  return sendEmail({
    to: email,
    subject: `We received your request for ${schoolName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e; font-size: 20px;">Request received</h1>
        <p>Hi ${esc(firstName || 'there')},</p>
        <p>Thanks for setting up <strong>${esc(schoolName)}</strong> on Skulbase. Your request is
        with our team for review.</p>
        <p><strong>What happens next:</strong> we'll email you as soon as it's approved, and your
        administrator account unlocks at that point. You don't need to do anything in the meantime.</p>
        <p style="color: #666; font-size: 14px;">Were you trying to join a school that already uses
        Skulbase? You don't need this request — ask your administrator for an invite code instead.</p>
      </div>
    `,
  });
}
