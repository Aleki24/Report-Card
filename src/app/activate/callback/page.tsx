"use client";

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { AuthShell, AuthStatus } from '@/components/auth/AuthShell';

/**
 * Google hands back here during activation; Clerk finishes the handshake and
 * moves on to /activate/process. Every outcome goes there (not back to
 * /activate, which a signed-in person is bounced away from, ending up on
 * onboarding asked for the invite code a second time).
 */
export default function ActivateCallbackPage() {
  return (
    <AuthShell title="Confirming your Google account" subtitle="This only takes a moment.">
      <AuthStatus tone="working" message="Checking your Google sign-in…" />
      <AuthenticateWithRedirectCallback
        signInUrl="/activate/process"
        signUpUrl="/activate/process"
        signUpFallbackRedirectUrl="/activate/process"
        signInFallbackRedirectUrl="/activate/process"
      />
    </AuthShell>
  );
}
