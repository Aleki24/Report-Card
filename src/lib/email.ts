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

export async function sendWelcomeEmail(email: string, firstName: string, schoolName: string) {
  return sendEmail({
    to: email,
    subject: `Welcome to Skulbase — ${schoolName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Welcome to Skulbase!</h1>
        <p>Hi ${firstName},</p>
        <p>Your account for <strong>${schoolName}</strong> has been created successfully.</p>
        <p>You can now log in to manage report cards, exams, attendance, and more.</p>
        <div style="margin: 24px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/login"
             style="background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
            Go to Dashboard
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">If you did not create this account, please ignore this email.</p>
      </div>
    `,
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
