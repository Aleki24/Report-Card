"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { ArrowRight, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { useSignInCodeVerification } from '@/hooks/useSignInCodeVerification';
import { extractInviteCode, INVITE_CODE_LENGTH } from '@/lib/activation-link';
import { ROLE_LABELS } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
    AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AUTH_PRIMARY_BUTTON, AUTH_SECONDARY_BUTTON,
    AuthDivider, AuthShell, GoogleIcon,
} from '@/components/auth/AuthShell';

const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

/** What /api/auth/activate says about a valid code (verify_only). */
interface InviteDetails {
    name: string;
    role: UserRole | null;
    username: string;
    /** The code resets an existing account's password rather than creating one. */
    reset: boolean;
}

interface VerifyResponse {
    error?: string;
    name?: string;
    role?: string;
    username?: string;
    reset?: boolean;
}

interface ActivateResponse {
    error?: string;
    ticket?: string | null;
}

type Stage = 'code' | 'details' | 'done';

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
}

function isUserRole(role: string | undefined): role is UserRole {
    return !!role && role in ROLE_LABELS;
}

/** Why the chosen username can't be used yet, or null. */
function usernameProblem(username: string): string | null {
    if (username.length < MIN_USERNAME_LENGTH) return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
    if (!USERNAME_PATTERN.test(username)) return 'Username can only contain letters, numbers, dots, dashes and underscores.';
    return null;
}

/**
 * Redeems an invite (or admin password-reset) code in one screen after the
 * code: confirm who you are, choose a username and password — or Google —
 * and land signed in. Links like /activate?code=A7X3K9 skip typing the code.
 */
export default function ActivatePage() {
    const router = useRouter();
    const { isLoaded, signUp } = useSignUp();
    const { signInWithTicket } = useSignInCodeVerification();

    const [stage, setStage] = useState<Stage>('code');
    const [code, setCode] = useState('');
    const [invite, setInvite] = useState<InviteDetails | null>(null);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [doneMessage, setDoneMessage] = useState('');
    const [signedIn, setSignedIn] = useState(false);

    async function verifyCode(value: string) {
        if (value.length !== INVITE_CODE_LENGTH || verifying) return;
        setError(null);
        setVerifying(true);
        try {
            const res = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: value, verify_only: true }),
            });
            const data: VerifyResponse = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'That invite code wasn’t recognised.');

            setInvite({
                name: data.name?.trim() || '',
                role: isUserRole(data.role) ? data.role : null,
                username: data.username || '',
                reset: !!data.reset,
            });
            setUsername(data.username || '');
            setStage('details');
        } catch (err) {
            setError(errorMessage(err, 'Could not check that code. Please try again.'));
        } finally {
            setVerifying(false);
        }
    }

    // An activation link fills the code in and checks it on arrival.
    const linkChecked = useRef(false);
    useEffect(() => {
        if (linkChecked.current) return;
        linkChecked.current = true;
        const fromLink = extractInviteCode(new URLSearchParams(window.location.search).get('code') ?? '');
        if (fromLink.length !== INVITE_CODE_LENGTH) return;
        setCode(fromLink);
        void verifyCode(fromLink);
        // Runs once on arrival; verifyCode is recreated every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleCodeChange(raw: string) {
        const next = extractInviteCode(raw);
        setCode(next);
        setError(null);
        // Typing or pasting the last character checks it — no extra tap needed.
        if (next.length === INVITE_CODE_LENGTH && next !== code) void verifyCode(next);
    }

    function startOver() {
        setStage('code');
        setInvite(null);
        setCode('');
        setPassword('');
        setEmail('');
        setError(null);
    }

    async function handleGoogle() {
        if (!isLoaded || !signUp) return;
        setError(null);
        setGoogleLoading(true);
        try {
            // Read back by /activate/callback once Google redirects home.
            sessionStorage.setItem('activate_invite_code', code);
            sessionStorage.setItem('activate_username', username || invite?.username || '');
            await signUp.authenticateWithRedirect({
                strategy: 'oauth_google',
                redirectUrl: '/activate/callback',
                redirectUrlComplete: '/activate/callback',
            });
        } catch (err) {
            console.error('Google activation error:', err);
            setError((isClerkAPIResponseError(err) && err.errors[0]?.longMessage) || 'Could not start Google sign-in.');
            setGoogleLoading(false);
        }
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const problem = usernameProblem(username)
            ?? (password.length < MIN_PASSWORD_LENGTH ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` : null);
        if (problem) {
            setError(problem);
            return;
        }

        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, username, password, email: email.trim() || undefined }),
            });
            const data: ActivateResponse = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Activation failed. Please try again.');

            // The server issues a one-time ticket, so there's no second login
            // and no code sent to an inbox the user may not have.
            const ok = !!data.ticket && await signInWithTicket(data.ticket).catch(() => false);
            setSignedIn(ok);
            setDoneMessage(invite?.reset ? 'Your password has been updated.' : 'Your account is ready.');
            setStage('done');
            if (ok) router.replace('/dashboard');
        } catch (err) {
            setError(errorMessage(err, 'Activation failed. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    }

    const firstName = invite?.name.split(' ')[0] || '';
    const heading = stage === 'code'
        ? 'Activate your account'
        : stage === 'done'
            ? 'You’re all set'
            : invite?.reset
                ? 'Reset your password'
                : firstName ? `Welcome, ${firstName}!` : 'Welcome!';
    const subheading = stage === 'code'
        ? 'Enter the invite code from your school to get started.'
        : stage === 'done'
            ? doneMessage
            : invite?.reset
                ? 'Choose a new password for your account.'
                : 'Choose how you’ll sign in. It takes less than a minute.';

    return (
        <AuthShell
            title={heading}
            subtitle={subheading}
            footer={stage !== 'done' && (
                <>
                    <span>Already activated? <Link href="/login" className={AUTH_LINK}>Sign in</Link></span>
                    {!invite?.reset && (
                        <span>Setting up a new school? <Link href="/signup" className={AUTH_LINK}>Create an account</Link></span>
                    )}
                </>
            )}
        >
            {error && (
                <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm leading-relaxed text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                </div>
            )}

            {stage === 'code' && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void verifyCode(code); }}
                    className="flex flex-col gap-5"
                >
                    <div className="flex flex-col gap-2">
                        <label htmlFor="invite-code" className={AUTH_LABEL}>Invite code</label>
                        <input
                            id="invite-code"
                            value={code}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            placeholder="A7X3K9"
                            autoComplete="one-time-code"
                            autoCapitalize="characters"
                            spellCheck={false}
                            autoFocus
                            disabled={verifying}
                            aria-invalid={error !== null}
                            aria-describedby="invite-code-help"
                            className={cn(AUTH_INPUT, 'h-14 text-center font-mono text-2xl uppercase tracking-[0.4em] sm:text-2xl placeholder:tracking-[0.4em]')}
                        />
                        <p id="invite-code-help" className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            6 letters and numbers from your school. You can also paste the link you were sent.
                        </p>
                    </div>

                    <button type="submit" disabled={verifying || code.length !== INVITE_CODE_LENGTH} className={AUTH_PRIMARY_BUTTON}>
                        {verifying
                            ? <><Loader2 className="size-5 animate-spin" aria-hidden />Checking your code…</>
                            : <>Continue<ArrowRight className="size-4" aria-hidden /></>}
                    </button>

                    <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        No code yet? Ask your school administrator. They can send it to you as a link.
                    </p>
                </form>
            )}

            {stage === 'details' && invite && (
                <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-3 rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-3 dark:border-indigo-400/20 dark:bg-indigo-400/10">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white" aria-hidden>
                            {invite.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || <KeyRound className="size-5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{invite.name || 'Your account'}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                {invite.role && <span className="whitespace-nowrap">{ROLE_LABELS[invite.role]}</span>}
                                <span className="whitespace-nowrap rounded-md bg-white/70 px-1.5 py-0.5 font-mono tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                    <span className="sr-only">Invite code </span>{code}
                                </span>
                            </p>
                        </div>
                        <button type="button" onClick={startOver} className={cn(AUTH_LINK, 'shrink-0 text-xs')}>
                            Not you?
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="username" className={AUTH_LABEL}>Username</label>
                            <input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                placeholder="Choose a username"
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                disabled={submitting}
                                className={AUTH_INPUT}
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                You’ll use this to sign in.
                                {invite.username && username !== invite.username && (
                                    <> Suggested: <button type="button" className={cn(AUTH_LINK, 'font-mono')} onClick={() => setUsername(invite.username)}>{invite.username}</button></>
                                )}
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="new-password" className={AUTH_LABEL}>{invite.reset ? 'New password' : 'Password'}</label>
                            <PasswordInput
                                id="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                autoComplete="new-password"
                                disabled={submitting}
                                aria-describedby="password-help"
                            />
                            <p
                                id="password-help"
                                className={cn(
                                    'flex items-center gap-1.5 text-xs transition-colors',
                                    password.length >= MIN_PASSWORD_LENGTH ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
                                )}
                            >
                                {password.length >= MIN_PASSWORD_LENGTH && <CheckCircle2 className="size-3.5" aria-hidden />}
                                At least {MIN_PASSWORD_LENGTH} characters
                            </p>
                        </div>

                        {!invite.reset && (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="email" className={AUTH_LABEL}>
                                    Email <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    disabled={submitting}
                                    className={AUTH_INPUT}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">Lets you reset your password yourself if you forget it.</p>
                            </div>
                        )}

                        <button type="submit" disabled={submitting || googleLoading} className={AUTH_PRIMARY_BUTTON}>
                            {submitting
                                ? <><Loader2 className="size-5 animate-spin" aria-hidden />{invite.reset ? 'Updating…' : 'Activating…'}</>
                                : invite.reset ? 'Update password & sign in' : 'Activate & sign in'}
                        </button>
                    </form>

                    {!invite.reset && (
                        <>
                            <AuthDivider label="or" />
                            <button type="button" onClick={handleGoogle} disabled={!isLoaded || googleLoading || submitting} className={AUTH_SECONDARY_BUTTON}>
                                {googleLoading ? <Loader2 className="size-5 animate-spin" aria-label="Redirecting to Google" /> : <GoogleIcon />}
                                Continue with Google
                            </button>
                        </>
                    )}
                </div>
            )}

            {stage === 'done' && (
                <div className="flex flex-col items-center gap-4 py-2 text-center" role="status">
                    <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
                        <CheckCircle2 className="size-7" aria-hidden />
                    </span>
                    {signedIn ? (
                        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            Signing you in…
                        </p>
                    ) : (
                        <>
                            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                Sign in with your username <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{username}</span> and the password you just chose.
                            </p>
                            <Link href="/login" className={cn(AUTH_PRIMARY_BUTTON, 'no-underline')}>
                                Go to sign in<ArrowRight className="size-4" aria-hidden />
                            </Link>
                        </>
                    )}
                </div>
            )}
        </AuthShell>
    );
}
