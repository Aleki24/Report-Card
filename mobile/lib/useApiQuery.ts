import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from './api';
import { errorMessage } from './format';

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
 * Loads `path` and unwraps it with `select`. Most list endpoints answer
 * `{ data: T }`, which is the default; endpoints that answer with the payload
 * itself pass `raw`. A null path skips the request (for dependent queries).
 */
export function useApiQuery<T>(path: string | null, opts?: { raw?: boolean }): ApiQuery<T> {
    const api = useApi();
    const raw = opts?.raw ?? false;
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(path !== null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Ignore responses for a path the screen has already moved away from.
    const latest = useRef(path);
    latest.current = path;
    // The path `data` belongs to: reloading the same path refreshes in place
    // instead of blanking the screen behind a spinner.
    const dataPath = useRef<string | null>(null);

    const load = useCallback(
        async (silent: boolean) => {
            if (path === null) {
                setData(null);
                dataPath.current = null;
                setLoading(false);
                return;
            }
            if (silent || dataPath.current === path) setRefreshing(true);
            else setLoading(true);
            setError(null);
            try {
                const json = await api.get<T | { data: T }>(path);
                if (latest.current === path) {
                    setData(raw ? (json as T) : (json as { data: T }).data);
                    dataPath.current = path;
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
        [api, path, raw],
    );

    useEffect(() => {
        void load(false);
    }, [load]);

    return {
        data,
        loading,
        refreshing,
        error,
        refresh: () => void load(true),
        reload: () => void load(false),
    };
}
