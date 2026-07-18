import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from './api';

export function useApiQuery<T>(path: string) {
    const api = useApi();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(true);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (opts?.silent) setRefreshing(true); else setLoading(true);
        setError(null);
        try {
            const json = await api.get<{ data: T }>(path);
            if (mounted.current) setData(json.data);
        } catch (err) {
            if (mounted.current) setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            if (mounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
        // path is the only real dependency we key requests on
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    useEffect(() => {
        mounted.current = true;
        load();
        return () => {
            mounted.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    return { data, loading, refreshing, error, refresh: () => load({ silent: true }), reload: load };
}
