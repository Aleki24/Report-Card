import crypto from 'crypto';
import { sendSMS } from './africastalking';
import { sendEmail } from './email';

/**
 * Generates a unique 10-character alphanumeric invite code.
 * Uses uppercase letters and digits, excluding confusing characters (0/O, 1/I/L).
 * Uses rejection sampling to avoid modulo bias.
 */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No 0,O,1,I,L
const CODE_LENGTH = 10;

export function generateInviteCode(): string {
  // Largest multiple of CHARSET.length that fits in a byte; bytes >= this
  // would bias the modulo, so we reject and redraw.
  const maxUnbiased = Math.floor(256 / CHARSET.length) * CHARSET.length;
  let code = '';
  while (code.length < CODE_LENGTH) {
    const byte = crypto.randomBytes(1)[0];
    if (byte >= maxUnbiased) continue; // reject to remove modulo bias
    code += CHARSET[byte % CHARSET.length];
  }
  return code;
}

/**
 * Creates an invite code record in the database.
 * Returns the generated code string.
 */
export async function createInviteCode(
  supabaseAdmin: any,
  userId: string,
  schoolId: string,
  role: string,
  expiresInDays: number = 30
): Promise<string> {
  const maxAttempts = 5;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { error } = await supabaseAdmin.from('invite_codes').insert({
      code,
      user_id: userId,
      school_id: schoolId,
      role,
      is_used: false,
      expires_at: expiresAt.toISOString(),
    });

    if (!error) {
      return code;
    }

    // If unique constraint violation, retry with a new code
    if (error.code === '23505') {
      continue;
    }

    throw new Error(`Failed to create invite code: ${error.message}`);
  }

  throw new Error('Failed to generate a unique invite code after multiple attempts');
}

export interface InviteNotifyResult {
  sms: boolean;
  email: boolean;
}

/**
 * Best-effort delivery of a freshly generated invite code by SMS and/or
 * email. Never throws — a missing provider credential or a failed send
 * just leaves the corresponding flag false, since the code is always
 * still shown to the admin in the UI as a fallback.
 */
export async function notifyInviteCode(params: {
  phone?: string | null;
  email?: string | null;
  firstName: string;
  schoolName: string;
  code: string;
}): Promise<InviteNotifyResult> {
  const { phone, email, firstName, schoolName, code } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const result: InviteNotifyResult = { sms: false, email: false };

  if (phone) {
    try {
      const message = `Hi ${firstName}, your Skulbase invite code for ${schoolName} is ${code}. Activate your account at ${appUrl}/activate`;
      const smsRes = await sendSMS(phone, message);
      result.sms = smsRes.success;
      if (!smsRes.success) console.error('[invite] SMS send failed:', smsRes.error);
    } catch (err) {
      console.error('[invite] SMS send threw:', err);
    }
  }

  if (email) {
    try {
      await sendEmail({
        to: email,
        subject: `Your Skulbase invite code for ${schoolName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">You're invited to ${schoolName}</h1>
            <p>Hi ${firstName},</p>
            <p>Your invite code is:</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</p>
            <p>Activate your account at <a href="${appUrl}/activate">${appUrl}/activate</a>.</p>
          </div>
        `,
      });
      result.email = true;
    } catch (err) {
      console.error('[invite] Email send threw:', err);
    }
  }

  return result;
}
