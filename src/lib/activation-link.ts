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

/**
 * The invite code (and chosen username) kept while Google signs the person in
 * during activation. Kept in localStorage as well as the tab's session, since
 * phones often finish the Google round-trip in a new tab; read back once by
 * /activate/process, or by onboarding if the person lands there instead.
 */
const PENDING_CODE_KEY = 'activate_invite_code';
const PENDING_USERNAME_KEY = 'activate_username';

function storages(): Storage[] {
  try { return [window.sessionStorage, window.localStorage]; } catch { return []; }
}

export function savePendingActivation(code: string, username: string): void {
  for (const s of storages()) {
    try { s.setItem(PENDING_CODE_KEY, code); s.setItem(PENDING_USERNAME_KEY, username); } catch { /* storage blocked */ }
  }
}

export function readPendingActivation(): { code: string | null; username: string | null } {
  for (const s of storages()) {
    try {
      const code = s.getItem(PENDING_CODE_KEY);
      if (code) return { code, username: s.getItem(PENDING_USERNAME_KEY) };
    } catch { /* storage blocked */ }
  }
  return { code: null, username: null };
}

export function clearPendingActivation(): void {
  for (const s of storages()) {
    try { s.removeItem(PENDING_CODE_KEY); s.removeItem(PENDING_USERNAME_KEY); } catch { /* storage blocked */ }
  }
}
