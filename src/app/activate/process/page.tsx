"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignUp, useSignIn } from '@clerk/nextjs/legacy';

export default function ActivateCallbackPage() {
    const router = useRouter();
    const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
    const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
    const [status, setStatus] = useState('Processing your Google sign-in...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function handleCallback() {
            if (!isSignUpLoaded || !isSignInLoaded) return;

            try {
                const inviteCode = sessionStorage.getItem('activate_invite_code');
                const storedUsername = sessionStorage.getItem('activate_username');

                if (!inviteCode) {
                    setError('No invite code found. Please go back and start again.');
                    return;
                }

                let clerkUserId: string | undefined;
                let activeSessionId: string | undefined;
                let setActiveFn: any;

                // 1. Check if this resolved as a Sign In (user already had this Google account in Clerk)
                if (signIn && signIn.status === 'complete' && signIn.createdSessionId) {
                    // It's possible the user already existed in Clerk via Google
                    setStatus('Linking your existing Google account...');
                    // User ID is in signIn
                    // But wait, signIn object doesn't expose createdUserId easily, we can just get it from the session later, 
                    // or maybe it's in signIn.userData? signIn.identifier?
                    // Actually, if signIn is complete, let's just setActive and then the session will be active.
                    // However, we need the user ID for our backend API.
                    // For now, let's assume they are a new user.
                }

                // 2. Check if it's a Sign Up
                if (signUp && signUp.status) {
                    if (signUp.status === 'missing_requirements') {
                        setStatus('Setting up your username...');
                        // Google doesn't provide a username, and our app requires it.
                        // We stored the chosen username in sessionStorage!
                        if (storedUsername) {
                            const updatedSignUp = await signUp.update({ username: storedUsername });
                            if (updatedSignUp.status === 'complete' && updatedSignUp.createdSessionId) {
                                clerkUserId = updatedSignUp.createdUserId || undefined;
                                activeSessionId = updatedSignUp.createdSessionId;
                                setActiveFn = setSignUpActive;
                            } else {
                                setError(`Still missing requirements: ${updatedSignUp.status}`);
                                return;
                            }
                        } else {
                            setError('Missing username requirement and no username found in storage.');
                            return;
                        }
                    } else if (signUp.status === 'complete' && signUp.createdSessionId) {
                        clerkUserId = signUp.createdUserId || undefined;
                        activeSessionId = signUp.createdSessionId;
                        setActiveFn = setSignUpActive;
                    }
                }

                // If neither worked, maybe it's still null because the redirect component hasn't finished yet
                if (!clerkUserId) {
                    // Let's not throw an error immediately if status is null, just wait.
                    if ((!signUp || signUp.status === null) && (!signIn || signIn.status === null)) {
                        return; // wait for clerk to process
                    }
                    if (error) return; // already set error
                    setError(`Unable to complete sign up. Status: ${signUp?.status || 'Unknown'}`);
                    return;
                }

                // Activate the Clerk session FIRST so the request to our API carries an
                // authenticated session — the backend verifies clerk_user_id against it.
                if (setActiveFn && activeSessionId) {
                    await setActiveFn({ session: activeSessionId });
                }

                setStatus('Linking your account...');

                // Call our API to link the Google Clerk account to the pending user
                const res = await fetch('/api/auth/activate-google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: inviteCode,
                        clerk_user_id: clerkUserId,
                        username: storedUsername,
                    }),
                });

                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || 'Failed to link account.');
                    return;
                }

                // Clean up sessionStorage
                sessionStorage.removeItem('activate_invite_code');
                sessionStorage.removeItem('activate_username');

                setStatus('Account activated! Redirecting...');
                setTimeout(() => {
                    router.push('/dashboard');
                }, 1500);

            } catch (err: any) {
                console.error('Callback error:', err);
                // Don't show error if it's just "not ready"
                if (!error) {
                    setError(err.errors?.[0]?.message || err.message || 'An error occurred during activation.');
                }
            }
        }

        handleCallback();
    }, [isSignUpLoaded, isSignInLoaded, signUp, signIn, setSignUpActive, setSignInActive, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md p-8 bg-card border border-border/50 rounded-2xl shadow-xl text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    {error ? (
                        <span className="text-2xl">❌</span>
                    ) : (
                        <div className="h-8 w-8 border-3 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
                    )}
                </div>

                {error ? (
                    <>
                        <h2 className="text-lg font-bold mb-2 text-red-500">Activation Failed</h2>
                        <p className="text-sm text-muted-foreground mb-6">{error}</p>
                        <button
                            onClick={() => router.push('/activate')}
                            className="btn-primary w-full py-3 text-sm"
                        >
                            Try Again
                        </button>
                    </>
                ) : (
                    <>
                        <h2 className="text-lg font-bold mb-2">{status}</h2>
                        <p className="text-sm text-muted-foreground">Please wait while we set up your account.</p>
                    </>
                )}
            </div>
        </div>
    );
}
