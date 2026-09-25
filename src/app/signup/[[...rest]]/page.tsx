"use client";

import { useState } from 'react';
import { useSignUp, useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { ChevronRight, KeyRound, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useSignInCodeVerification } from '@/hooks/useSignInCodeVerification';
import { VerificationCodeStep } from '@/components/auth/VerificationCodeStep';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AUTH_PRIMARY_BUTTON, AUTH_SECONDARY_BUTTON,
  AuthDivider, AuthShell, GoogleIcon,
} from '@/components/auth/AuthShell';

/** New accounts start PENDING; onboarding is where they join or set up a school. */
const POST_SIGNUP_DESTINATION = '/dashboard';

export default function SignupPage() {
  const router = useRouter();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const verification = useSignInCodeVerification();
  const isLoaded = isSignUpLoaded && isSignInLoaded;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          first_name: firstName, 
          last_name: lastName 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create account.');
        return;
      }

      if (!isLoaded || !signIn) {
        // Account was created successfully on the backend, but we can't auto-login.
        // Redirect them to the login page to complete the process.
        router.push('/login?created=1');
        return;
      }

      const result = await signIn.create({
        identifier: email,
        password,
      });

      // The account was created server-side, so this browser is a new device
      // to Clerk and Client Trust usually asks for an emailed code here. Finish
      // that on this page — bouncing to /login would drop the pending attempt.
      const outcome = await verification.continueSignIn(result);
      if (outcome === 'complete') {
        router.push(POST_SIGNUP_DESTINATION);
      } else if (outcome === 'unsupported') {
        router.push('/login?created=1');
      }
    } catch (err) {
      const message = isClerkAPIResponseError(err)
        ? err.errors[0]?.longMessage || err.errors[0]?.message
        : err instanceof Error ? err.message : undefined;
      toast.error(message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
    if (!isLoaded || !signUp) return;
    setGoogleLoading(true);
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard/onboarding',
      });
    } catch {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle={<>Get started with <Wordmark /> today</>}
      footer={
        <>
          <span>Already have an account? <Link href="/login" className={AUTH_LINK}>Sign in</Link></span>
          <span className="mt-4">Setting up a new school? Create your account here, then register the school.</span>
        </>
      }
    >
      {verification.pending ? (
        <VerificationCodeStep
          pending={verification.pending}
          cooldown={verification.cooldown}
          onVerify={verification.verifyCode}
          onResend={verification.resendCode}
          onVerified={() => router.push(POST_SIGNUP_DESTINATION)}
          onBack={() => {
            // The account already exists; finishing later happens on /login.
            verification.reset();
            router.push('/login?created=1');
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Teachers and students already have an account waiting for them;
              signing up here would only lead to a second code at onboarding. */}
          <Link
            href="/activate"
            className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm no-underline transition-colors hover:bg-indigo-500/10 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:hover:bg-indigo-400/15"
          >
            <KeyRound className="size-5 shrink-0 text-indigo-500 dark:text-indigo-300" aria-hidden />
            <span className="flex-1 leading-snug text-slate-600 dark:text-slate-300">
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Teacher or student?</span>
              Got an invite code or link from your school? Activate your account instead.
            </span>
            <ChevronRight className="size-4 shrink-0 text-indigo-500 dark:text-indigo-300" aria-hidden />
          </Link>

          <div className="grid grid-cols-1 gap-5 min-[380px]:grid-cols-2 min-[380px]:gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="first-name" className={AUTH_LABEL}>First Name</label>
              <input id="first-name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" autoComplete="given-name" required className={AUTH_INPUT} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="last-name" className={AUTH_LABEL}>Last Name</label>
              <input id="last-name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" autoComplete="family-name" required className={AUTH_INPUT} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className={AUTH_LABEL}>Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@school.com" autoComplete="email" required className={AUTH_INPUT} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className={AUTH_LABEL}>Password</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON}>
            {loading ? <Loader2 className="size-5 animate-spin" aria-label="Creating account" /> : <><UserPlus className="size-4" aria-hidden />Create Account</>}
          </button>

          <AuthDivider />

          <button type="button" onClick={signUpWithGoogle} disabled={!isLoaded || googleLoading} className={AUTH_SECONDARY_BUTTON}>
            {googleLoading ? <Loader2 className="size-5 animate-spin" aria-label="Redirecting to Google" /> : <GoogleIcon />}
            Sign up with Google
          </button>
        </form>
      )}
    </AuthShell>
  );
}
