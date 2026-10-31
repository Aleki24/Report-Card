import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import { useToast } from '@/components/Toast';

/** Checking more often than this only spends data: updates are published a few times a day at most. */
const CHECK_EVERY_MS = 15 * 60 * 1000;
/** Away at least this long, nobody is mid-task: a waiting update is applied as they come back. */
const RESTART_AFTER_AWAY_MS = 5 * 60 * 1000;

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
 * Keeps the app on the latest published update without a new install.
 *
 * Expo checks once at launch and applies what it found on the launch after,
 * so a phone that stays open for days ran last week's app. Here:
 *   - it also checks whenever the app comes back to the foreground;
 *   - an update downloaded while the app is in use is offered with a
 *     "Restart now" toast, and otherwise applies at the next start;
 *   - an update waiting when someone returns after a while away is applied
 *     straight away, since they are not in the middle of anything. Mark
 *     entry keeps its drafts on the device, so typed marks survive.
 */
export function useLiveUpdates(): void {
    const toast = useToast();
    const { isUpdatePending } = Updates.useUpdates();
    const lastCheck = useRef(Date.now());
    const leftAt = useRef<number | null>(null);
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
            if (state === 'background') {
                leftAt.current = Date.now();
                return;
            }
            if (state !== 'active') return;
            const awayFor = leftAt.current === null ? 0 : Date.now() - leftAt.current;
            leftAt.current = null;
            if (isUpdatePending && awayFor >= RESTART_AFTER_AWAY_MS) {
                void Updates.reloadAsync().catch(() => undefined);
                return;
            }
            if (Date.now() - lastCheck.current >= CHECK_EVERY_MS) {
                lastCheck.current = Date.now();
                void downloadIfNew();
            }
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => sub.remove();
    }, [isUpdatePending]);
}
