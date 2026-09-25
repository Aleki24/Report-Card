import { useCallback, useEffect, useState } from 'react';
import { isClerkAPIResponseError, useSignIn } from '@clerk/clerk-expo';
import { publicPost } from '@/lib/api';

type SignInResource = NonNullable<ReturnType<typeof useSignIn>['signIn']>;
type SignInSecondFactor = NonNullable<SignInResource['supportedSecondFactors']>[number];

/** Second-factor strategies where Clerk delivers a one-time code we can collect. */
export type CodeStrategy = 'email_code' | 'phone_code';

type CodeFactor = Extract<SignInSecondFactor, { strategy: CodeStrategy }>;

export interface PendingCodeVerification {
    strategy: CodeStrategy;
    /** Masked destination Clerk sent the code to, e.g. "j***@school.com". */
    safeIdentifier: string;
}

/** `complete`: session active. `verify`: a code was sent. `unsupported`: nothing we can collect. */
export type SignInOutcome = 'complete' | 'verify' | 'unsupported';

/**
 * Statuses answered with an emailed/texted code through the second-factor
 * API. `needs_client_trust` (Clerk's new-device check) is missing from this
 * SDK version's SignInStatus type but is returned by the API all the same,
 * so the set is typed as plain strings.
 */
const CODE_REQUIRED_STATUSES: ReadonlySet<string> = new Set(['needs_second_factor', 'needs_client_trust']);

/** The password the user just typed, for accounts that can't receive a code. */
export interface PasswordCredentials {
    identifier: string;
    password: string;
}

/**
 * Teachers and students invited without an email get a `.local` placeholder
 * address, which never receives mail. Mirrors src/lib/placeholder-email.ts.
 */
function isPlaceholderEmail(email: string): boolean {
    return email.trim().toLowerCase().endsWith('.local');
}

/**
 * Asks the server for a sign-in ticket for an account with no inbox or phone,
 * after it re-checks the password. Null when it refuses (the account can
 * receive a code after all), so the caller sends the code instead.
 */
async function fetchPasswordTicket(credentials: PasswordCredentials): Promise<string | null> {
    try {
        const { ticket } = await publicPost<{ ticket?: string }>('/api/auth/password-ticket', credentials);
        return ticket ?? null;
    } catch {
        return null;
    }
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
 * Carries a Clerk sign-in past the verification-code step: MFA
 * (`needs_second_factor`) and Client Trust's new-device check
 * (`needs_client_trust`) — the latter hits every first sign-in on a phone.
 * Mirrors src/hooks/useSignInCodeVerification.ts on the web.
 */
export function useSignInCodeVerification() {
    const { signIn, setActive } = useSignIn();
    const [pending, setPending] = useState<PendingCodeVerification | null>(null);
    const [factor, setFactor] = useState<CodeFactor | null>(null);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
        return () => clearTimeout(timer);
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
        // Widened to string: this SDK's SignInStatus predates needs_client_trust.
        const status: string | null = result.status;
        if (status && CODE_REQUIRED_STATUSES.has(status)) {
            const target = pickCodeFactor(result.supportedSecondFactors);
            const unreachable = !target || (target.strategy === 'email_code' && isPlaceholderEmail(target.safeIdentifier));
            // Only the new-device check is skipped this way; real MFA always needs its code.
            if (status === 'needs_client_trust' && unreachable && credentials) {
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

    return { pending, cooldown, continueSignIn, verifyCode, resendCode, reset };
}
