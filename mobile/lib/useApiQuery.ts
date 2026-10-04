import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useApi } from './api';
import { cacheKey, readMemory, readStored, writeCache } from './queryCache';
import { errorMessage } from './format';
import { useRegisterScreenRefresh } from './screenRefresh';

export interface ApiQuery<T> {
    data: T | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    /** Reload in place, keeping current data visible (pull-to-refresh). */
    refresh: () => void;
    /** Reload; keeps current data visible when it is for the same path. */
    reload: () => void;
}

/**
 * Loads `path` and unwraps it. The last answer for the same path (this
 * session, or stored from an earlier one) shows at once while the fresh one
 * loads behind it, so screens open instantly instead of on a loader. Most list endpoints answer
 * `{ data: T }`, which is the default; endpoints that answer with the payload
 * itself pass `raw`. A null path skips the request (for dependent queries).
 */
export function useApiQuery<T>(path: string | null, opts?: { raw?: boolean }): ApiQuery<T> {
    const api = useApi();
    const { userId } = useAuth();
    const raw = opts?.raw ?? false;
    const key = path === null ? null : cacheKey(userId, path);
    const cached = readMemory<T>(key);
    const [data, setData] = useState<T | null>(cached ?? null);
    const [loading, setLoading] = useState(path !== null && cached === undefined);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Ignore responses for a path the screen has already moved away from.
    const latest = useRef(path);
    latest.current = path;
    // The path `data` belongs to: reloading the same path refreshes in place
    // instead of blanking the screen behind a spinner.
    const dataPath = useRef<string | null>(cached !== undefined ? path : null);

    const load = useCallback(
        async (silent: boolean) => {
            if (path === null) {
                setData(null);
                dataPath.current = null;
                setLoading(false);
                return;
            }
            if (silent || dataPath.current === path) setRefreshing(true);
            else {
                // Show what this screen held last time, then refresh it quietly.
                const saved = readMemory<T>(key) ?? (await readStored<T>(key));
                if (latest.current !== path) return;
                if (saved !== undefined) {
                    setData(saved);
                    dataPath.current = path;
                    setLoading(false);
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }
            }
            setError(null);
            try {
                const json = await api.get<T | { data: T }>(path);
                if (latest.current === path) {
                    const next = raw ? (json as T) : (json as { data: T }).data;
                    setData(next);
                    dataPath.current = path;
                    writeCache(key, next);
                }
            } catch (err) {
                if (latest.current === path) setError(errorMessage(err, 'Failed to load'));
            } finally {
                if (latest.current === path) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [api, path, raw, key],
    );

    useEffect(() => {
        void load(false);
    }, [load]);

    // Pull-to-refresh on the enclosing screen reloads this query in place.
    useRegisterScreenRefresh(() => load(true));

    return {
        data,
        loading,
        refreshing,
        error,
        refresh: () => void load(true),
        reload: () => void load(false),
    };
}
