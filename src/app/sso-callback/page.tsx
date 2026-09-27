"use client";

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { AuthShell, AuthStatus } from '@/components/auth/AuthShell';

/** Google hands back here after sign-in or sign-up; Clerk finishes and redirects. */
export default function SSOCallbackPage() {
  return (
    <AuthShell title="Signing you in" subtitle="This only takes a moment.">
      <AuthStatus tone="working" message="Checking your Google sign-in…" />
      <AuthenticateWithRedirectCallback
        signInUrl="/login"
        signUpUrl="/signup"
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard/onboarding"
      />
    </AuthShell>
  );
}
