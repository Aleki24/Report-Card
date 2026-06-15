"use client";

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function ActivateCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card border border-border/50 rounded-2xl shadow-xl text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="h-8 w-8 border-3 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
        </div>
        <h2 className="text-lg font-bold mb-2">Authenticating...</h2>
        <p className="text-sm text-muted-foreground">Please wait while we confirm your Google sign-in.</p>
        
        {/* This component handles the OAuth callback URL parameters and then redirects */}
        <AuthenticateWithRedirectCallback
          signUpFallbackRedirectUrl="/activate/process"
          signInFallbackRedirectUrl="/activate/process"
        />
      </div>
    </div>
  );
}
