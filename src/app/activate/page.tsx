"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs/legacy';

export default function ActivatePage() {
    const router = useRouter();
    const { isLoaded, signUp, setActive } = useSignUp();
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [suggestedUsername, setSuggestedUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [verified, setVerified] = useState(false);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    // Step 1: Verify the invite code
    const handleVerifyCode = async () => {
        setError(null);
        if (!code.trim() || code.trim().length < 6) {
            setError('Please enter a valid 6-character invite code.');
            return;
        }

        setVerifying(true);
        try {
            const res = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim(), verify_only: true }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Invalid invite code.');
            }

            setSuggestedUsername(data.username || '');
            setUsername(data.username || '');
            setUserName(data.name || '');
            setUserRole(data.role || '');
            setVerified(true);
        } catch (err: any) {
            setError(err.message || 'Failed to verify code.');
        } finally {
            setVerifying(false);
        }
    };

    // Activate with Google
    const handleGoogleActivation = async () => {
        if (!isLoaded || !signUp) return;
        setError(null);
        setGoogleLoading(true);

        try {
            // Store the invite code in sessionStorage so we can use it after Google redirect
            sessionStorage.setItem('activate_invite_code', code.trim());
            sessionStorage.setItem('activate_username', username.trim() || suggestedUsername);

            await signUp.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: '/activate/callback',
                redirectUrlComplete: '/activate/callback',
            });
        } catch (err: any) {
            console.error('Google activation error:', err);
            setError(err?.errors?.[0]?.longMessage || 'Failed to start Google sign-in.');
            setGoogleLoading(false);
        }
    };

    // Activate with password
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username.trim()) {
            setError('Username is required.');
            return;
        }

        if (username.trim().length < 3) {
            setError('Username must be at least 3 characters.');
            return;
        }

        if (/[^a-zA-Z0-9._-]/.test(username.trim())) {
            setError('Username can only contain letters, numbers, dots, dashes, and underscores.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code.trim(),
                    email: email.trim() || undefined,
                    username: username.trim(),
                    password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Activation failed');
            }

            setSuccess('Account activated successfully! Redirecting to login...');
            
            setTimeout(() => {
                router.push('/login');
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'An error occurred during activation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />

            <div 
                className="w-full max-w-md p-8 bg-card border border-border/50 rounded-2xl shadow-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-primary">🔐</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Activate Account</h1>
                    <p className="text-muted-foreground text-sm">
                        {!verified 
                            ? 'Enter your invite code to get started.' 
                            : `Welcome, ${userName}! Choose how to set up your account.`}
                    </p>
                </div>

                {error && (
                    <div className="p-3 mb-6 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-3 mb-6 text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-md text-center font-medium">
                        {success}
                    </div>
                )}

                {/* Step 1: Enter invite code */}
                {!verified && !success && (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-foreground">Invite Code <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                className="input-field w-full font-mono uppercase tracking-widest text-center text-lg"
                                placeholder="A7X3K9"
                                maxLength={6}
                                required
                                disabled={verifying}
                            />
                            <p className="text-xs text-muted-foreground mt-1 text-center">The 6-character code given by your admin</p>
                        </div>

                        <button
                            type="button"
                            onClick={handleVerifyCode}
                            disabled={verifying || code.trim().length < 6}
                            className="btn-primary w-full py-3 text-sm font-semibold tracking-wide"
                        >
                            {verifying ? 'Verifying...' : 'Verify Code'}
                        </button>
                    </div>
                )}

                {/* Step 2: Choose activation method */}
                {verified && !success && !showPasswordForm && (
                    <div className="space-y-4">
                        <div className="p-3 mb-2 text-sm bg-primary/5 border border-primary/10 rounded-md text-center">
                            <span className="text-muted-foreground">Invite code:</span>{' '}
                            <span className="font-mono font-bold tracking-widest uppercase text-primary">{code}</span>
                            <span className="text-muted-foreground ml-2">·</span>
                            <span className="text-muted-foreground ml-2 capitalize text-xs">{userRole.toLowerCase().replace('_', ' ')}</span>
                        </div>

                        {/* Google activation */}
                        <button
                            type="button"
                            onClick={handleGoogleActivation}
                            disabled={!isLoaded || googleLoading}
                            className="flex h-[46px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl border text-[14px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 bg-card hover:bg-muted/50 border-border"
                        >
                            {googleLoading ? (
                                <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                            ) : (
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            )}
                            Continue with Google
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs text-muted-foreground">or</span>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        {/* Password option */}
                        <button
                            type="button"
                            onClick={() => setShowPasswordForm(true)}
                            className="btn-primary w-full py-3 text-sm font-semibold tracking-wide"
                        >
                            Set Up with Username & Password
                        </button>

                        <button
                            type="button"
                            onClick={() => { setVerified(false); setCode(''); setError(null); }}
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            ← Use a different code
                        </button>
                    </div>
                )}

                {/* Step 2b: Password form */}
                {verified && !success && showPasswordForm && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="p-3 mb-2 text-sm bg-primary/5 border border-primary/10 rounded-md text-center">
                            <span className="text-muted-foreground">Invite code:</span>{' '}
                            <span className="font-mono font-bold tracking-widest uppercase text-primary">{code}</span>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-foreground">Username <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                className="input-field w-full"
                                placeholder="Choose a username"
                                required
                                disabled={loading}
                                minLength={3}
                            />
                            {suggestedUsername && username !== suggestedUsername && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Suggested: <button type="button" className="text-primary font-mono hover:underline" onClick={() => setUsername(suggestedUsername)}>{suggestedUsername}</button>
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">This is what you&apos;ll use to log in</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-foreground">Email Address (Optional)</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field w-full"
                                placeholder="your.email@example.com"
                                disabled={loading}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Add an email to help recover your account later</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-foreground">New Password <span className="text-red-500">*</span></label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field w-full"
                                placeholder="Min. 8 characters"
                                required
                                disabled={loading}
                                minLength={8}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-foreground">Confirm Password <span className="text-red-500">*</span></label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="input-field w-full"
                                placeholder="Repeat your password"
                                required
                                disabled={loading}
                                minLength={8}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 mt-2 text-sm font-semibold tracking-wide"
                        >
                            {loading ? 'Activating...' : 'Activate Account'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowPasswordForm(false)}
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                            disabled={loading}
                        >
                            ← Back to options
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => router.push('/login')}
                        className="text-sm text-primary hover:text-primary/80 transition-colors"
                        disabled={loading}
                    >
                        Already have an account? Log in
                    </button>
                </div>
            </div>
        </div>
    );
}
