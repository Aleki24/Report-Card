/**
 * The page an invite code is redeemed on, with the code already filled in —
 * opening it checks the code straight away, so nobody has to retype it.
 * Client-safe; pass the site origin to get an absolute URL for SMS/email.
 */
export function activationUrl(code: string, origin = ''): string {
  return `${origin}/activate?code=${encodeURIComponent(code)}`;
}

export const INVITE_CODE_LENGTH = 6;

/**
 * The invite code in whatever the user typed or pasted: the bare code in any
 * case, with stray spaces or dashes, or a whole activation link.
 */
export function extractInviteCode(raw: string): string {
  const fromLink = raw.match(/[?&]code=([^&#\s]+)/i)?.[1];
  const candidate = fromLink ? decodeURIComponent(fromLink) : raw;
  return candidate.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, INVITE_CODE_LENGTH);
}
