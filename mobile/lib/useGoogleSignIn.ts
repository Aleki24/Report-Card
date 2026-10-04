import { useCallback, useState } from 'react';
import { isClerkAPIResponseError, useSSO } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import { NETWORK_ERROR_MESSAGE } from './api';

/**
 * Where Google sends the browser back to the app. A production Clerk instance
 * only completes native SSO for redirect URLs on its allowlist, so this must
 * match an entry there exactly (Clerk Dashboard → Native applications, or
 * POST /v1/redirect_urls). It resolves to the app route app/(auth)/sso-callback.
 */
export const SSO_REDIRECT_URL = AuthSession.makeRedirectUri({ scheme: 'skulbase', path: 'sso-callback' });

/** Network failures from Clerk or our API ("fetch failed: java.net…", "Network request failed"). */
function networkMessage(err: unknown): string | null {
    const text = err instanceof Error ? err.message : '';
    return /fetch failed|network request failed|java\.net|socket|timed? ?out|connection/i.test(text) ? NETWORK_ERROR_MESSAGE : null;
}

/** Turns a Clerk or network failure into the message the auth screens show. */
export function describeAuthError(err: unknown, fallback: string): string {
    if (isClerkAPIResponseError(err)) return err.errors[0]?.longMessage ?? err.errors[0]?.message ?? fallback;
    return networkMessage(err) ?? (err instanceof Error ? err.message : fallback);
}

/** A friendlier message for known Clerk error codes, else Clerk's own (as the web's clerkMessage). */
export function clerkMessage(err: unknown, byCode: Readonly<Record<string, string>>, fallback: string): string {
    if (isClerkAPIResponseError(err)) {
        const first = err.errors[0];
        return (first?.code && byCode[first.code]) || first?.longMessage || first?.message || fallback;
    }
    return networkMessage(err) ?? (err instanceof Error ? err.message : fallback);
}

/** "Continue with Google", shared by sign-in and sign-up: the same Clerk SSO flow the web uses. */
export function useGoogleSignIn() {
    const { startSSOFlow } = useSSO();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const start = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl: SSO_REDIRECT_URL });
            if (createdSessionId && setActive) await setActive({ session: createdSessionId });
        } catch (err) {
            setError(describeAuthError(err, 'Google sign-in failed.'));
        } finally {
            setLoading(false);
        }
    }, [startSSOFlow]);

    return { start, loading, error, clearError: () => setError(null) };
}
