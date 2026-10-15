"use client";

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AUTH_PRIMARY_BUTTON, AUTH_SECONDARY_BUTTON, AuthShell, AuthStatus } from '@/components/auth/AuthShell';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { resolveLoginIdentifier } from '@/lib/login-identifier';
import { isPlaceholderEmail } from '@/lib/placeholder-email';
import { cn } from '@/lib/utils';

const CODE_LENGTH = 6;
const MIN_PASSWORD = 8;

/** 'no-email': the account has only a placeholder address, so no code can reach it. */
type Step = 'request' | 'reset' | 'no-email';

function clerkMessage(err: unknown, known: Record<string, string>, fallback: string): string {
  const apiError = isClerkAPIResponseError(err) ? err.errors[0] : undefined;
  return (apiError?.code && known[apiError.code]) || apiError?.longMessage || fallback;
}

/**
 * Lets a Google-first account (no password yet), or anyone who forgot theirs,
 * set a password with an emailed code. Clerk links accounts by verified email,
 * so the password is added to the same account and either method then works.
 *
 * It used to draw its own backdrop and card with inline colours chosen in
 * JavaScript, so it flashed the wrong theme and drifted from sign-in; it now
 * uses the same frame, fields and buttons as every other auth screen.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  /** Where the code went: the typed email, or the one a username resolved to. */
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError(null);
    try {
      // Learners and teachers sign in with a username: it resolves to the
      // account's email, as on the sign-in page.
      const identifier = await resolveLoginIdentifier(email);
      if (isPlaceholderEmail(identifier)) {
        setStep('no-email');
        return;
      }
      await signIn.create({ strategy: 'reset_password_email_code', identifier });
      setSentTo(identifier);
      setStep('reset');
      toast.success(`We've emailed a ${CODE_LENGTH}-digit code to ${identifier}.`);
    } catch (err) {
      const notFound = 'No account uses this email address or username.';
      setError(clerkMessage(err, { form_identifier_not_found: notFound, form_identifier_invalid: notFound }, 'We couldn’t send a code. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError(null);
    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code });
      const result = attempt.status === 'needs_new_password'
        ? await signIn.resetPassword({ password, signOutOfOtherSessions: true })
        : attempt;
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        toast.success('Password saved. You can sign in with it or with Google.');
        router.push('/dashboard');
        return;
      }
      setError('We couldn’t finish resetting your password. Request a new code and try again.');
    } catch (err) {
      setError(clerkMessage(err, {
        form_code_incorrect: 'That code is wrong or has expired.',
        form_password_pwned: 'This password has appeared in a data breach. Choose a different one.',
        form_password_length_too_short: `Use at least ${MIN_PASSWORD} characters.`,
      }, 'We couldn’t reset your password. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  const backToRequest = () => {
    setStep('request');
    setCode('');
    setPassword('');
    setError(null);
  };

  if (step === 'no-email') {
    return (
      <AuthShell title="Ask your school for a reset code">
        <AuthStatus
          tone="waiting"
          message="Your account has no email address, so a code can’t be sent to you. Your school administrator can give you a password reset code: enter it on the activation page to choose a new password."
        >
          <Link href="/activate" className={`${AUTH_PRIMARY_BUTTON} no-underline`}>I have a reset code</Link>
          <button type="button" onClick={backToRequest} className={AUTH_SECONDARY_BUTTON}>Try a different account</button>
        </AuthStatus>
      </AuthShell>
    );
  }

  const errorLine = error && (
    <p id="reset-error" role="alert" className="text-xs font-medium text-destructive">{error}</p>
  );

  return (
    <AuthShell
      title={step === 'request' ? 'Reset your password' : 'Choose a new password'}
      subtitle={step === 'request'
        ? 'We’ll email you a code. This also works if you’ve only ever signed in with Google.'
        : <>Enter the code sent to <span className="font-semibold break-all text-slate-700 dark:text-slate-200">{sentTo}</span> and your new password.</>}
      footer={<span>Remembered it? <Link href="/login" className={AUTH_LINK}>Back to sign in</Link></span>}
    >
      {step === 'request' ? (
        <form onSubmit={handleRequestCode} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-email" className={AUTH_LABEL}>Email or username</label>
            <input
              id="reset-email"
              type="text"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@school.com or your username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              aria-invalid={error !== null}
              aria-describedby={error ? 'reset-error' : undefined}
              className={AUTH_INPUT}
            />
            {errorLine}
          </div>
          <button type="submit" disabled={!isLoaded || loading || !email.trim()} className={AUTH_PRIMARY_BUTTON}>
            {loading ? <Loader2 className="size-5 animate-spin" aria-label="Sending code" /> : <><KeyRound className="size-4" aria-hidden />Send reset code</>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-code" className={AUTH_LABEL}>Verification code</label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              placeholder="••••••"
              autoFocus
              required
              className={cn(AUTH_INPUT, 'text-center font-mono text-lg tracking-[0.5em] sm:text-lg')}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">It can take a minute to arrive. Check your spam folder too.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-password" className={AUTH_LABEL}>New password</label>
            <PasswordInput
              id="reset-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD} characters`}
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              required
              aria-invalid={error !== null}
              aria-describedby={error ? 'reset-error' : undefined}
            />
            {errorLine}
          </div>
          <button
            type="submit"
            disabled={!isLoaded || loading || code.length !== CODE_LENGTH || password.length < MIN_PASSWORD}
            className={AUTH_PRIMARY_BUTTON}
          >
            {loading ? <Loader2 className="size-5 animate-spin" aria-label="Saving password" /> : 'Save new password'}
          </button>
          <button
            type="button"
            onClick={backToRequest}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="size-4" aria-hidden /> Use a different email
          </button>
        </form>
      )}
    </AuthShell>
  );
}
