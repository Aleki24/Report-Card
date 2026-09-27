"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { ArrowLeft, Loader2, LogOut } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { AUTH_PRIMARY_BUTTON, AUTH_SECONDARY_BUTTON, AuthShell } from '@/components/auth/AuthShell';

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('') || '?';

/**
 * Sign-out confirmation, in the same frame as sign-in, sign-up and activation.
 * It used to draw its own backdrop and card with hard-coded colours and a red
 * badge in place of the logo, so it looked like a different app.
 */
export default function LogoutPage() {
  const router = useRouter();
  const { signOut, user } = useClerk();
  const [loading, setLoading] = useState(false);

  const name = user?.fullName?.trim() || user?.username || '';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
    } finally {
      window.location.href = '/login';
    }
  }

  // Back to where they came from; a direct visit has nowhere to go back to.
  const cancel = () => {
    if (window.history.length > 1) router.back();
    else router.push('/dashboard');
  };

  return (
    <AuthShell
      title="Sign out"
      subtitle={<>Are you sure you want to sign out of <Wordmark />?</>}
      footer={<span>You&apos;ll return to the sign-in page.</span>}
    >
      <div className="flex flex-col gap-4">
        {(name || email) && (
          <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
            {user?.hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- Clerk-hosted avatar
              <img src={user.imageUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">
                {initialsOf(name || email)}
              </span>
            )}
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Signed in as</p>
              {name && <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>}
              {email && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>}
            </div>
          </div>
        )}

        <button type="button" onClick={() => void handleSignOut()} disabled={loading} className={AUTH_PRIMARY_BUTTON}>
          {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
          {loading ? 'Signing out…' : 'Sign out'}
        </button>

        <button type="button" onClick={cancel} disabled={loading} className={AUTH_SECONDARY_BUTTON}>
          <ArrowLeft className="size-4" aria-hidden />
          Cancel
        </button>
      </div>
    </AuthShell>
  );
}
