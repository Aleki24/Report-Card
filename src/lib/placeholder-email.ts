/**
 * Teachers and students invited without an email are given a placeholder
 * address (`<username>@<school>.school.local`, `<name>@student.local`) because
 * Clerk requires one. `.local` is reserved and never routes to an inbox, so
 * nothing Clerk emails there — a new-device sign-in code included — arrives.
 *
 * Safe to import on the client: it only inspects strings.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith('.local');
}

/** Placeholder address for an account created without a real email. */
export function placeholderEmailFor(username: string, schoolName: string | null | undefined): string {
  const schoolSlug = (schoolName || 'school').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${username}@${schoolSlug}.school.local`;
}
