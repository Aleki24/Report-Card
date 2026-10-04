import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';

/**
 * The last answer for each request, so a screen opens on what it showed last
 * time while fresh data loads behind it, even after the app was closed.
 * Keys carry the signed-in user's id, so one account never sees another's
 * data; everything is wiped when nobody is signed in.
 */
const PREFIX = 'skulbase.q.';
const memory = new Map<string, unknown>();
/** Bump when a stored shape changes so old entries are ignored. */
const VERSION = 1;

interface Stored { v: number; at: number; data: unknown }

/** Older than this, a stored answer is not worth showing. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function cacheKey(userId: string | null | undefined, path: string): string | null {
    return userId ? `${PREFIX}${userId}:${path}` : null;
}

/** Synchronous: what this session already loaded. */
export function readMemory<T>(key: string | null): T | undefined {
    return key ? (memory.get(key) as T | undefined) : undefined;
}

/** From the phone's storage, after a restart. */
export async function readStored<T>(key: string | null): Promise<T | undefined> {
    if (!key) return undefined;
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return undefined;
        const stored = JSON.parse(raw) as Stored;
        if (stored.v !== VERSION || Date.now() - stored.at > MAX_AGE_MS) return undefined;
        memory.set(key, stored.data);
        return stored.data as T;
    } catch {
        return undefined;
    }
}

export function writeCache(key: string | null, data: unknown): void {
    if (!key) return;
    memory.set(key, data);
    const stored: Stored = { v: VERSION, at: Date.now(), data };
    AsyncStorage.setItem(key, JSON.stringify(stored)).catch(() => undefined);
}

/** On sign-out: nothing of the last account stays on the phone. */
export async function clearCache(): Promise<void> {
    memory.clear();
    try {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
        if (keys.length) await AsyncStorage.multiRemove(keys);
    } catch {
        // Storage unavailable: memory is already clear.
    }
}

/** The cache key for a request by the signed-in user (null path: nothing to cache). */
export function useCacheKey(path: string | null): string | null {
    const { userId } = useAuth();
    return path === null ? null : cacheKey(userId, path);
}
