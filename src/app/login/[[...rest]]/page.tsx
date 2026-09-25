"use client";

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { Loader2, LogIn, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSignInCodeVerification } from '@/hooks/useSignInCodeVerification';
import { VerificationCodeStep } from '@/components/auth/VerificationCodeStep';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AUTH_PRIMARY_BUTTON, AUTH_SECONDARY_BUTTON,
  AuthDivider, AuthShell, GoogleIcon,
} from '@/components/auth/AuthShell';

/** Human-readable label for a Clerk first-factor strategy, or null to hide it from the list. */
function describeStrategy(strategy: string): string | null {
  if (strategy.startsWith('oauth_')) {
    const provider = strategy.slice('oauth_'.length);
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
  switch (strategy) {
    case 'email_code': return 'an emailed code';
    case 'email_link': return 'an emailed link';
    case 'saml': return 'your school SSO';
    default: return null;
  }
}

function joinWithOr(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/**
 * Where to land after a successful sign-in.
 *
 * Honours ?redirect_url= — set by the middleware when it bounces an
 * unauthenticated request, and by the QR verification page's sign-in prompt.
 * Only same-site absolute paths are accepted; anything else (protocol-relative
 * "//evil.com", a full URL, a missing param) falls back to /dashboard, which
 * routes on to the student area for student accounts.
 */
function postLoginDestination(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const target = new URLSearchParams(window.location.search).get('redirect_url');
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/dashboard';
  return target;
}

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, signIn } = useSignIn();
  const verification = useSignInCodeVerification();
  const [showSuccess] = useState(typeof window !== 'undefined' && window.location.search.includes('created=1'));
  const [wasDeactivated] = useState(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('deactivated') === '1');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [wrongStrategy, setWrongStrategy] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setLoading(true);
    setWrongStrategy(false);
    setAvailableMethods([]);

    // The identifier actually handed to Clerk (a username is resolved to its
    // email below). Kept at function scope so the error-recovery paths reuse it.
    let loginIdentifier = identifier.trim();

    try {
      // Teachers/students sign in with a generated username. Username may not
      // be an enabled Clerk sign-in identifier (that yields
      // "identifier is invalid"), so resolve a non-email identifier to the
      // account's email first — email is always accepted. Email logins and
      // any resolver failure fall straight through to the raw identifier.
      if (!loginIdentifier.includes('@')) {
        try {
          const resolveRes = await fetch('/api/auth/resolve-identifier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: loginIdentifier }),
          });
          if (resolveRes.ok) {
            const { email } = await resolveRes.json();
            if (email) loginIdentifier = email;
          }
        } catch {
          /* fall back to the raw identifier */
        }
      }

      const result = await signIn.create({
        identifier: loginIdentifier,
        password,
      });

      const outcome = await verification.continueSignIn(result, { identifier: loginIdentifier, password });
      if (outcome === 'complete') {
        router.push(postLoginDestination());
      } else if (outcome === 'unsupported') {
        toast.error('This account needs a verification method this page doesn’t support yet. Please contact your school administrator.');
      }
    } catch (err) {
      const apiError = isClerkAPIResponseError(err) ? err.errors[0] : undefined;
      // This account was created via Google (or another method with no password
      // credential) — Clerk rejects a password attempt for it with this code.
      // Same underlying Clerk user either way; they just need to add a password.
      if (apiError?.code === 'strategy_for_user_invalid') {
        setWrongStrategy(true);
        // Ask Clerk what this account can actually sign in with, so the
        // message names the real method(s) instead of guessing "Google".
        try {
          const check = await signIn.create({ identifier: loginIdentifier });
          const methods = Array.from(new Set(
            (check.supportedFirstFactors ?? [])
              .map((f) => describeStrategy(f.strategy))
              .filter((s): s is string => s !== null)
          ));
          setAvailableMethods(methods);
        } catch {
          setAvailableMethods([]);
        }
      } else {
        const msg =
          apiError?.code === 'form_identifier_not_found'
            ? 'No account found with this email or username.'
            : apiError?.code === 'form_identifier_invalid'
              ? 'That username or email isn’t recognized. If you just activated your account, try your email address instead.'
              : apiError?.code === 'form_password_incorrect'
                ? 'Incorrect password.'
                : apiError?.longMessage || 'Invalid credentials.';
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!isLoaded || !signIn) return;
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: postLoginDestination(),
      });
    } catch {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={<>Sign in to your <Wordmark /> account to continue</>}
      footer={
        <>
          <span>Don&apos;t have an account? <Link href="/signup" className={AUTH_LINK}>Create one</Link></span>
          <span>First time? <Link href="/activate" className={AUTH_LINK}>Activate your account</Link></span>
          <span className="mt-4">Access is role-based · Admin · Class Teacher · Subject Teacher · Student</span>
        </>
      }
    >
      {verification.pending ? (
        <VerificationCodeStep
          pending={verification.pending}
          cooldown={verification.cooldown}
          onVerify={verification.verifyCode}
          onResend={verification.resendCode}
          onVerified={() => router.push(postLoginDestination())}
          onBack={verification.reset}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {showSuccess && (
            <div role="status" className="flex items-center gap-3 rounded-xl border border-green-500/15 bg-green-500/[0.08] px-4 py-3 text-sm font-medium text-green-600 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              Account created! Sign in with your credentials.
            </div>
          )}
          {wasDeactivated && (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium leading-relaxed text-destructive">
              Your account has been deactivated. Please contact your school administrator.
            </div>
          )}
          {wrongStrategy && (
            <div role="alert" className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.08] px-4 py-3 text-sm leading-relaxed text-amber-800 dark:border-yellow-500/20 dark:bg-yellow-500/10 dark:text-amber-200">
              {availableMethods.length > 0 ? (
                <>This account signs in with {joinWithOr(availableMethods)} — no password is set yet.</>
              ) : (
                <>This account doesn&apos;t have a password set yet.</>
              )}
              {' '}
              {availableMethods.length === 0 || availableMethods.includes('Google') ? (
                <>Use <button type="button" onClick={signInWithGoogle} className="font-semibold underline">Sign in with Google</button>,{' '}</>
              ) : null}
              or <Link href="/forgot-password" className="font-semibold text-inherit underline">set a password</Link> so both work next time.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="identifier" className={AUTH_LABEL}>Email or Username</label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Enter your email or username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className={AUTH_INPUT}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className={AUTH_LABEL}>Password</label>
                <Link href="/forgot-password" className={`text-xs ${AUTH_LINK}`}>Forgot password?</Link>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" disabled={!isLoaded || loading} className={AUTH_PRIMARY_BUTTON}>
              {loading ? <Loader2 className="size-5 animate-spin" aria-label="Signing in" /> : <><LogIn className="size-4" aria-hidden />Sign In</>}
            </button>

            <AuthDivider />

            <button type="button" onClick={signInWithGoogle} disabled={!isLoaded || googleLoading} className={AUTH_SECONDARY_BUTTON}>
              {googleLoading ? <Loader2 className="size-5 animate-spin" aria-label="Redirecting to Google" /> : <GoogleIcon />}
              Sign in with Google
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
