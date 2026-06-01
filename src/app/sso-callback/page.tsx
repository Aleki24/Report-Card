"use client";

import { HandleSSOCallback } from '@clerk/react';

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <HandleSSOCallback
        navigateToApp={() => window.location.assign('/dashboard')}
        navigateToSignIn={() => window.location.assign('/login')}
        navigateToSignUp={() => window.location.assign('/signup')}
      />
    </div>
  );
}
