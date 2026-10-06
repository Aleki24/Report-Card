import { useCallback, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { clearCache } from './queryCache';

/** Long enough for a slow network, short enough that nobody stares at a spinner. */
const SIGN_OUT_WAIT_MS = 6000;

/**
 * Signing out from anywhere (a home, onboarding, a locked account): wipe this
 * account's cached data, end the session, and land on sign-in even if the
 * network is slow or the screen has no navigator of its own.
 */
export function useSignOut() {
    const { signOut } = useAuth();
    const router = useRouter();
    const [signingOut, setSigningOut] = useState(false);

    const run = useCallback(async () => {
        setSigningOut(true);
        try {
            await clearCache();
            await Promise.race([signOut(), new Promise((resolve) => setTimeout(resolve, SIGN_OUT_WAIT_MS))]);
        } catch {
            // The session is dropped on this phone either way; carry on to sign-in.
        } finally {
            setSigningOut(false);
            try { router.replace('/(auth)/sign-in'); } catch { /* The auth stack mounts on its own once signed out. */ }
        }
    }, [router, signOut]);

    return { signOut: run, signingOut };
}
