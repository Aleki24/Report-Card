import crypto from 'crypto';

/**
 * Generates a unique 6-character alphanumeric invite code.
 * Uses uppercase letters and digits, excluding confusing characters (0/O, 1/I/L).
 */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // No 0,O,1,I,L

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
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
