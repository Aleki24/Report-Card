import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import { useToast } from '@/components/Toast';

/** Checking more often than this only spends data: updates are published a few times a day at most. */
const CHECK_EVERY_MS = 15 * 60 * 1000;

/** Updates work in release builds only; in development and Expo Go every call rejects. */
const live = !__DEV__ && Updates.isEnabled;

async function downloadIfNew(): Promise<void> {
    try {
        const found = await Updates.checkForUpdateAsync();
        if (found.isAvailable) await Updates.fetchUpdateAsync();
    } catch {
        // Offline or rate limited: the next foreground tries again.
    }
}

/**
 * Finds published updates without a new install, and leaves applying them to
 * the person: the app never restarts by itself.
 *
 * Expo checks once at launch and applies what it found on the launch after,
 * so a phone that stays open for days ran last week's app. Here:
 *   - it also checks whenever the app comes back to the foreground;
 *   - a downloaded update is offered with a "Restart now" toast, and
 *     otherwise opens at the next start. Profile → Check for updates still
 *     fetches one on demand.
 */
export function useLiveUpdates(): void {
    const toast = useToast();
    const { isUpdatePending } = Updates.useUpdates();
    const lastCheck = useRef(Date.now());
    const offered = useRef(false);

    useEffect(() => {
        if (!live || !isUpdatePending || offered.current) return;
        offered.current = true;
        toast.show('A new version of Skulbase is ready', 'info', 'It opens the next time you start the app.', {
            label: 'Restart now',
            onPress: () => void Updates.reloadAsync().catch(() => undefined),
        });
    }, [isUpdatePending, toast]);

    useEffect(() => {
        if (!live) return;
        const onChange = (state: AppStateStatus) => {
            // One waiting update is enough; the next start opens it.
            if (state !== 'active' || isUpdatePending) return;
            if (Date.now() - lastCheck.current >= CHECK_EVERY_MS) {
                lastCheck.current = Date.now();
                void downloadIfNew();
            }
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => sub.remove();
    }, [isUpdatePending]);
}
