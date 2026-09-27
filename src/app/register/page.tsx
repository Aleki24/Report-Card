import { redirect } from 'next/navigation';

/**
 * Old invitation links pointed here, to a form backed by a `pending_invites`
 * table that nothing writes to any more. Accounts are now activated with a
 * school invite code on /activate, so send those links there, code and all.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const invite = Array.isArray(code) ? code[0] : code;
  redirect(invite ? `/activate?code=${encodeURIComponent(invite)}` : '/activate');
}
