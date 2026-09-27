"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { errorText, opsFetch, opsUrl } from '@/lib/ops/client';
import type { ResourceName } from '@/lib/ops/registry';

export type QueryParams = Record<string, string | undefined | null>;

/**
 * Rows of one operations resource, with create/update/remove that refresh
 * the list and toast the outcome. `params` become equality filters.
 */
export function useOpsList<T extends { id: string }>(resource: ResourceName, params: QueryParams = {}, opts: { enabled?: boolean } = {}) {
    const enabled = opts.enabled ?? true;
    const [rows, setRows] = useState<T[]>([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);
    const key = JSON.stringify(params);
    const url = useMemo(() => opsUrl(resource, JSON.parse(key) as QueryParams), [resource, key]);

    const reload = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        try {
            setRows(await opsFetch<T[]>(url));
            setError(null);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [url, enabled]);

    useEffect(() => { void reload(); }, [reload]);

    const mutate = useCallback(async (run: () => Promise<unknown>, success: string): Promise<boolean> => {
        try {
            await run();
            toast.success(success);
            await reload();
            return true;
        } catch (err) {
            toast.error(errorText(err));
            return false;
        }
    }, [reload]);

    const create = useCallback((values: Record<string, unknown>, success = 'Saved.') =>
        mutate(() => opsFetch(`/api/ops/${resource}`, { method: 'POST', json: values }), success), [mutate, resource]);
    const update = useCallback((id: string, values: Record<string, unknown>, success = 'Updated.') =>
        mutate(() => opsFetch(`/api/ops/${resource}/${id}`, { method: 'PATCH', json: values }), success), [mutate, resource]);
    const remove = useCallback((id: string, success = 'Deleted.') =>
        mutate(() => opsFetch(`/api/ops/${resource}/${id}`, { method: 'DELETE' }), success), [mutate, resource]);

    return { rows, loading, error, reload, create, update, remove, mutate };
}
