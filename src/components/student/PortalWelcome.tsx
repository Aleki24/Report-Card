"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { Eye, EyeOff, Loader2, LogIn, ArrowRight, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/components/ThemeProvider';
import { PortalShell, PortalCard, PortalLogo, PortalField } from './PortalShell';

interface PortalWelcomeProps {
    token: string;
    firstName: string;
    fullName: string;
    schoolName: string;
    admissionNumber: string;
    suggestedUsername: string;
    /** True when a Clerk account already exists — start on the sign-in form. */
    isClaimed: boolean;
}

/**
 * What a learner sees after scanning the QR code on their report card:
 * a greeting by name, then either a sign-up form (first scan) or a sign-in
 * form (they already have an account).
 */
export function PortalWelcome({
    token, firstName, fullName, schoolName, admissionNumber, suggestedUsername, isClaimed,
}: PortalWelcomeProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const router = useRouter();
    const { isSignedIn } = useAuth();
    const { isLoaded, signIn, setActive } = useSignIn();

    const [mode, setMode] = useState<'signup' | 'signin'>(isClaimed ? 'signin' : 'signup');
    const [username, setUsername] = useState(suggestedUsername);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    /**
     * Establish the Clerk session and land on the student dashboard. Shared by
     * both flows — sign-up finishes by signing the learner straight in.
     */
    async function startSession(identifier: string, secret: string) {
        if (!isLoaded || !signIn) {
            // Clerk hasn't booted; the account exists, so let them log in normally.
            router.push('/login?created=1');
            return;
        }

        // Teachers and students are created with a generated username, which
        // may not be an enabled Clerk sign-in identifier. Resolve anything
        // that isn't an email to the account's email first — same reason as
        // on /login.
        let loginIdentifier = identifier;
        if (!loginIdentifier.includes('@')) {
            try {
                const res = await fetch('/api/auth/resolve-identifier', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: loginIdentifier }),
                });
                if (res.ok) {
                    const { email: resolved } = await res.json();
                    if (resolved) loginIdentifier = resolved;
                }
            } catch {
                /* fall back to the raw identifier */
            }
        }

        const result = await signIn.create({ identifier: loginIdentifier, password: secret });

        if (result.status === 'complete') {
            await setActive({ session: result.createdSessionId });
            router.push('/student/dashboard');
        } else {
            // Second factor or similar — the full login page can handle it.
            router.push('/login?created=1');
        }
    }

    async function handleSignUp(e: React.FormEvent) {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/portal-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    username: username.trim(),
                    email: email.trim() || undefined,
                    password,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                // The account was claimed since this page loaded — flip the
                // form over rather than leaving them on a dead end.
                if (data.alreadyClaimed) setMode('signin');
                toast.error(data.error || 'Could not create your portal account.');
                return;
            }

            toast.success(`Welcome, ${firstName}! Your portal is ready.`);
            await startSession(data.email || username.trim(), password);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSignIn(e: React.FormEvent) {
        e.preventDefault();
        if (!isLoaded || !signIn) return;

        setLoading(true);
        try {
            await startSession(username.trim(), password);
        } catch (err) {
            const apiError = isClerkAPIResponseError(err) ? err.errors[0] : undefined;
            const msg =
                apiError?.code === 'form_password_incorrect'
                    ? 'Incorrect password.'
                    : apiError?.code === 'form_identifier_not_found'
                        ? 'No account found for that username.'
                        : apiError?.longMessage || 'Could not sign you in. Please try again.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    const subtleText = { color: isDark ? '#94a3b8' : '#64748b' };

    return (
        <PortalShell>
            {/* ── Greeting ── */}
            <div className="mb-8 text-center">
                <PortalLogo />
                <h1 className="mb-2 text-[28px] font-extrabold leading-tight tracking-tighter"
                    style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                    Welcome {firstName}, to your portal
                </h1>
                <p className="text-[15px] leading-relaxed" style={subtleText}>
                    {mode === 'signup'
                        ? <>Set up your login and you&apos;ll see your results, attendance and fees from {schoolName}.</>
                        : <>Sign in to pick up where you left off at {schoolName}.</>}
                </p>
            </div>

            {/* ── Who we think you are ── */}
            <div className="mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3"
                style={{
                    background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                    borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
                }}>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8B5CF6)' }}>
                    <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold"
                        style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {fullName}
                    </div>
                    <div className="truncate text-xs" style={subtleText}>
                        Adm. {admissionNumber} · {schoolName}
                    </div>
                </div>
            </div>

            <PortalCard>
                {isSignedIn ? (
                    /* Scanned from a phone that is already logged in. */
                    <div className="flex flex-col items-center gap-4 text-center">
                        <p className="text-sm leading-relaxed" style={subtleText}>
                            You&apos;re already signed in on this device.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push('/student/dashboard')}
                            className="flex h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-none text-[15px] font-semibold text-white transition-all duration-200"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #8B5CF6)',
                                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                            }}>
                            Continue to your portal
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} className="flex flex-col gap-5">
                        <PortalField
                            label="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            required
                            minLength={3}
                            autoCapitalize="none"
                            autoCorrect="off"
                            hint={mode === 'signup' && suggestedUsername
                                ? 'Your school suggested this one. You can change it.'
                                : undefined}
                        />

                        {mode === 'signup' && (
                            <PortalField
                                label="Email (optional)"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoCapitalize="none"
                                hint="Add one so you can reset your own password later."
                            />
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                                    required
                                    minLength={mode === 'signup' ? 8 : undefined}
                                    className="input-field h-[46px] w-full rounded-xl px-4 text-sm transition-all duration-200"
                                    style={{
                                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                                        color: isDark ? '#f1f5f9' : '#0f172a',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                                    onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-1"
                                    style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {mode === 'signup' && (
                            <PortalField
                                label="Confirm password"
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Type it again"
                                required
                                minLength={8}
                            />
                        )}

                        <button
                            type="submit"
                            disabled={loading || !isLoaded}
                            className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border-none text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #8B5CF6)',
                                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                            }}>
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : mode === 'signup' ? (
                                <>Create my portal <ArrowRight className="h-4 w-4" /></>
                            ) : (
                                <><LogIn className="h-4 w-4" /> Sign in</>
                            )}
                        </button>
                    </form>
                )}
            </PortalCard>

            {/* ── Flip between sign-up and sign-in ── */}
            {!isSignedIn && (
                <div className="mt-6 text-center text-xs leading-relaxed"
                    style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                    {mode === 'signup' ? (
                        <>
                            Already set up your portal?{' '}
                            <button type="button" onClick={() => setMode('signin')}
                                className="cursor-pointer border-none bg-transparent p-0 font-semibold underline"
                                style={{ color: '#6366f1' }}>
                                Sign in instead
                            </button>
                        </>
                    ) : (
                        <>
                            Haven&apos;t set up your portal yet?{' '}
                            <button type="button" onClick={() => setMode('signup')}
                                className="cursor-pointer border-none bg-transparent p-0 font-semibold underline"
                                style={{ color: '#6366f1' }}>
                                Create it now
                            </button>
                        </>
                    )}
                    <br />
                    <span style={{ opacity: 0.8 }}>
                        Not {firstName}? Don&apos;t use this code — it belongs to their report card.
                    </span>
                </div>
            )}
        </PortalShell>
    );
}
