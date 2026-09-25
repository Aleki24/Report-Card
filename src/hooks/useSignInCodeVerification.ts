"use client";

import { useCallback, useEffect, useState } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import type { SignInResource, SignInSecondFactor } from '@clerk/nextjs/types';
import { isPlaceholderEmail } from '@/lib/placeholder-email';

/** Second-factor strategies where Clerk delivers a one-time code we can collect. */
export type CodeStrategy = 'email_code' | 'phone_code';

type CodeFactor = Extract<SignInSecondFactor, { strategy: CodeStrategy }>;

export interface PendingCodeVerification {
  strategy: CodeStrategy;
  /** Masked destination Clerk sent the code to, e.g. "j***@school.com". */
  safeIdentifier: string;
}

/**
 * What the page should do after handing a sign-in attempt to `continueSignIn`:
 * - `complete` — the session is active; navigate on.
 * - `verify`   — a code has been sent; render the code step.
 * - `unsupported` — Clerk wants something this UI can't collect.
 */
export type SignInOutcome = 'complete' | 'verify' | 'unsupported';

/** The password the user just typed, for accounts that can't receive a code. */
export interface PasswordCredentials {
  identifier: string;
  password: string;
}

/** Seconds a user waits before another code can be requested. */
const RESEND_COOLDOWN_SECONDS = 30;

function isCodeFactor(factor: SignInSecondFactor): factor is CodeFactor {
  return factor.strategy === 'email_code' || factor.strategy === 'phone_code';
}

/** Prefer the primary email, then any email, then a phone number. */
function pickCodeFactor(factors: SignInSecondFactor[] | null): CodeFactor | null {
  const codeFactors = (factors ?? []).filter(isCodeFactor);
  return (
    codeFactors.find((f) => f.strategy === 'email_code' && f.primary) ??
    codeFactors.find((f) => f.strategy === 'email_code') ??
    codeFactors.find((f) => f.strategy === 'phone_code') ??
    null
  );
}

/**
 * Asks the server for a sign-in ticket for an account with no inbox or phone,
 * after it re-checks the password. Null when the account can receive a code
 * after all (or the server refuses), so the caller falls back to sending one.
 */
async function fetchPasswordTicket(credentials: PasswordCredentials): Promise<string | null> {
  const res = await fetch('/api/auth/password-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data: { ticket?: string } = await res.json().catch(() => ({}));
  return res.ok && data.ticket ? data.ticket : null;
}

function prepareCode(signIn: SignInResource, factor: CodeFactor): Promise<SignInResource> {
  return factor.strategy === 'email_code'
    ? signIn.prepareSecondFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId })
    : signIn.prepareSecondFactor({ strategy: 'phone_code', phoneNumberId: factor.phoneNumberId });
}

/** Friendly copy for the Clerk errors a code attempt realistically hits. */
export function describeCodeError(err: unknown): string {
  const apiError = isClerkAPIResponseError(err) ? err.errors[0] : undefined;
  switch (apiError?.code) {
    case 'form_code_incorrect':
      return 'That code is incorrect. Check it and try again.';
    case 'verification_expired':
      return 'That code has expired. Request a new one.';
    case 'verification_failed':
      return 'Too many incorrect attempts. Request a new code.';
    case 'too_many_requests':
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return apiError?.longMessage || apiError?.message || 'Verification failed. Please try again.';
  }
}

/**
 * Carries a Clerk sign-in past the verification-code step.
 *
 * Clerk asks for an emailed/texted code in two cases: the account has MFA
 * (`needs_second_factor`), or Client Trust flags a password sign-in from a
 * device it hasn't seen (`needs_client_trust`) — which is every first sign-in
 * straight after /signup, since that account is created server-side. Both
 * are satisfied through the second-factor API, so they share this flow.
 *
 * Client Trust's code goes to the account's email, which for teachers and
 * students invited without one is a `.local` placeholder that never receives
 * mail. Given the credentials just typed, `continueSignIn` swaps that dead end
 * for a server-issued sign-in ticket instead.
 */
export function useSignInCodeVerification() {
  const { signIn, setActive } = useSignIn();
  const [pending, setPending] = useState<PendingCodeVerification | null>(null);
  const [factor, setFactor] = useState<CodeFactor | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = useCallback(async (resource: SignInResource, target: CodeFactor) => {
    await prepareCode(resource, target);
    setFactor(target);
    setPending({ strategy: target.strategy, safeIdentifier: target.safeIdentifier });
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, []);

  /** Activates the session once Clerk reports the sign-in finished. */
  const activateIfComplete = useCallback(async (result: SignInResource): Promise<boolean> => {
    if (result.status !== 'complete') return false;
    await setActive?.({ session: result.createdSessionId });
    return true;
  }, [setActive]);

  const continueSignIn = useCallback(async (
    result: SignInResource,
    credentials?: PasswordCredentials,
  ): Promise<SignInOutcome> => {
    if (await activateIfComplete(result)) return 'complete';
    if (result.status === 'needs_second_factor' || result.status === 'needs_client_trust') {
      const target = pickCodeFactor(result.supportedSecondFactors);
      const unreachable = !target || (target.strategy === 'email_code' && isPlaceholderEmail(target.safeIdentifier));
      // Only the new-device check is skipped this way — real MFA always needs its code.
      if (result.status === 'needs_client_trust' && unreachable && credentials) {
        const ticket = await fetchPasswordTicket(credentials);
        if (ticket && await activateIfComplete(await result.create({ strategy: 'ticket', ticket }))) {
          return 'complete';
        }
      }
      if (!target) return 'unsupported';
      await sendCode(result, target);
      return 'verify';
    }
    return 'unsupported';
  }, [activateIfComplete, sendCode]);

  /** Starts a session from a server-issued ticket (invite activation, sign-up). */
  const signInWithTicket = useCallback(async (ticket: string): Promise<boolean> => {
    if (!signIn) return false;
    return activateIfComplete(await signIn.create({ strategy: 'ticket', ticket }));
  }, [signIn, activateIfComplete]);

  /** Submits the code; resolves true once the session is active. Throws Clerk errors. */
  const verifyCode = useCallback(async (code: string): Promise<boolean> => {
    if (!signIn || !pending) return false;
    return activateIfComplete(await signIn.attemptSecondFactor({ strategy: pending.strategy, code: code.trim() }));
  }, [signIn, pending, activateIfComplete]);

  const resendCode = useCallback(async () => {
    if (!signIn || !factor || cooldown > 0) return;
    await sendCode(signIn, factor);
  }, [signIn, factor, cooldown, sendCode]);

  const reset = useCallback(() => {
    setPending(null);
    setFactor(null);
    setCooldown(0);
  }, []);

  return { pending, cooldown, continueSignIn, signInWithTicket, verifyCode, resendCode, reset };
}
