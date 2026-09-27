"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSignUp, useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { AUTH_PRIMARY_BUTTON, AUTH_SECONDARY_BUTTON, AuthShell, AuthStatus } from '@/components/auth/AuthShell';

const INVITE_KEY = 'activate_invite_code';
const USERNAME_KEY = 'activate_username';

interface ActivateResponse { error?: string; role?: string }

type View =
  | { kind: 'working'; message: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string; existingAccount?: boolean };

function describe(err: unknown): string {
  if (isClerkAPIResponseError(err)) return err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Google sign-in failed.';
  return err instanceof Error ? err.message : 'Something went wrong while activating your account.';
}

/**
 * After Google hands back during activation: finish the Clerk sign-up (adding
 * the username the learner or teacher chose), activate the session, then link
 * it to the account their school created, using the invite code saved before
 * they left for Google.
 */
export default function ActivateProcessPage() {
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const [view, setView] = useState<View>({ kind: 'working', message: 'Checking your Google sign-in…' });
  // Clerk objects change identity as they load; link the account only once.
  const started = useRef(false);

  useEffect(() => {
    if (!signUpLoaded || !signInLoaded || started.current) return;
    // Clerk is still finishing the redirect; wait for the next update.
    if (!signUp?.status && !signIn?.status) return;
    started.current = true;

    void (async () => {
      const inviteCode = sessionStorage.getItem(INVITE_KEY);
      const username = sessionStorage.getItem(USERNAME_KEY);
      if (!inviteCode) {
        setView({ kind: 'error', message: 'We couldn’t find your invite code. It is only kept in this browser tab, so start activation again here.' });
        return;
      }

      try {
        // This Google account already has a Skulbase login. Linking it would
        // take over whatever account it belongs to, so stop here.
        if (signIn?.status === 'complete') {
          setView({ kind: 'error', existingAccount: true, message: 'This Google account is already linked to a Skulbase account. Sign in with it, or activate your invite with a different Google account.' });
          return;
        }

        let result = signUp;
        if (result?.status === 'missing_requirements') {
          if (!username) {
            setView({ kind: 'error', message: 'Your chosen username was lost on the way back from Google. Start activation again.' });
            return;
          }
          setView({ kind: 'working', message: 'Saving your username…' });
          result = await result.update({ username });
        }
        if (result?.status !== 'complete' || !result.createdSessionId || !result.createdUserId) {
          setView({ kind: 'error', message: 'Google sign-up didn’t finish. Start activation again.' });
          return;
        }

        // The session must be active first: the API checks that the account
        // being linked belongs to the signed-in user.
        await setActive?.({ session: result.createdSessionId });

        setView({ kind: 'working', message: 'Linking your account to your school…' });
        const res = await fetch('/api/auth/activate-google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: inviteCode, clerk_user_id: result.createdUserId, username }),
        });
        const data = (await res.json().catch(() => ({}))) as ActivateResponse;
        if (!res.ok) {
          setView({ kind: 'error', message: data.error ?? 'We couldn’t link your account. Ask your school administrator for a new invite code.' });
          return;
        }

        sessionStorage.removeItem(INVITE_KEY);
        sessionStorage.removeItem(USERNAME_KEY);
        setView({ kind: 'done' });
        // A full navigation, not router.push: the app may have cached this
        // account as PENDING while it was being linked, which would send the
        // user back through onboarding asking for the invite code again.
        setTimeout(() => { window.location.href = data.role === 'STUDENT' ? '/student/dashboard' : '/dashboard'; }, 1200);
      } catch (err) {
        setView({ kind: 'error', message: describe(err) });
      }
    })();
  }, [signUpLoaded, signInLoaded, signUp, signIn, setActive]);

  if (view.kind === 'error') {
    return (
      <AuthShell title="Activation didn’t finish">
        <AuthStatus tone="error" message={view.message}>
          <Link href="/activate" className={`${AUTH_PRIMARY_BUTTON} no-underline`}>Start activation again</Link>
          {view.existingAccount && <Link href="/login" className={`${AUTH_SECONDARY_BUTTON} no-underline`}>Sign in instead</Link>}
        </AuthStatus>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={view.kind === 'done' ? 'You’re all set' : 'Activating your account'}>
      <AuthStatus
        tone={view.kind === 'done' ? 'success' : 'working'}
        message={view.kind === 'done' ? 'Your account is active. Taking you to your dashboard…' : view.message}
      />
    </AuthShell>
  );
}
