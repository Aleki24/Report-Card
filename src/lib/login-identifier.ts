/**
 * The address Clerk can sign someone in (or send a reset code) with.
 *
 * Teachers and learners are given a generated username, which may not be an
 * enabled Clerk identifier, so a non-email identifier is resolved to the
 * account's email first (POST /api/auth/resolve-identifier). Emails, unknown
 * usernames and any resolver failure fall back to what was typed, and Clerk
 * gives the usual "not found". Client-only: it calls the app's own API.
 */
export async function resolveLoginIdentifier(typed: string): Promise<string> {
  const identifier = typed.trim();
  if (!identifier || identifier.includes('@')) return identifier;
  try {
    const res = await fetch('/api/auth/resolve-identifier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    if (!res.ok) return identifier;
    const { email } = (await res.json()) as { email?: string | null };
    return email || identifier;
  } catch {
    return identifier;
  }
}
