/**
 * The operations API (`/api/ops/*`) from the phone: the same record lists,
 * pickers and actions the web's module pages use, with the Clerk token
 * attached. Mirrors the web's `useOpsList` / `useLookup` hooks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResourceName } from '@shared/ops/registry';
import type { LookupOption, LookupType } from '@shared/ops/lookups';
import { useToast } from '@/components/Toast';
import { useApi, withQuery, type Api } from './api';
import { errorMessage } from './format';

export type QueryParams = Record<string, string | undefined | null>;

export const opsPath = (resource: ResourceName, params?: QueryParams) => withQuery(`/api/ops/${resource}`, params ?? {});

/** Unwraps the `{ data }` every ops route answers with. */
export async function opsGet<T>(api: Api, path: string): Promise<T> {
    return (await api.get<{ data: T }>(path)).data;
}

type Mutation = () => Promise<unknown>;

/**
 * Rows of one operations resource, with create/update/remove that refresh
 * the list and report the outcome. `params` become equality filters.
 */
export function useOpsList<T extends { id: string }>(resource: ResourceName, params: QueryParams = {}, opts: { enabled?: boolean } = {}) {
    const api = useApi();
    const toast = useToast();
    const enabled = opts.enabled ?? true;
    const key = JSON.stringify(params);
    const path = useMemo(() => opsPath(resource, JSON.parse(key) as QueryParams), [resource, key]);
    const [rows, setRows] = useState<T[]>([]);
    const [loading, setLoading] = useState(enabled);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const latest = useRef(path);
    latest.current = path;

    const load = useCallback(async (silent: boolean) => {
        if (!enabled) { setLoading(false); return; }
        if (silent) setRefreshing(true); else setLoading(true);
        try {
            const data = await opsGet<T[]>(api, path);
            if (latest.current === path) { setRows(data); setError(null); }
        } catch (err) {
            if (latest.current === path) setError(errorMessage(err, 'Failed to load'));
        } finally {
            if (latest.current === path) { setLoading(false); setRefreshing(false); }
        }
    }, [api, path, enabled]);

    useEffect(() => { void load(false); }, [load]);

    const reload = useCallback(() => load(true), [load]);

    const mutate = useCallback(async (run: Mutation, success: string): Promise<boolean> => {
        try {
            await run();
            toast.success(success);
            await load(true);
            return true;
        } catch (err) {
            toast.error(errorMessage(err, 'Something went wrong'));
            return false;
        }
    }, [load, toast]);

    const create = useCallback((values: Record<string, unknown>, success = 'Saved.') =>
        mutate(() => api.post(`/api/ops/${resource}`, values), success), [api, mutate, resource]);
    const update = useCallback((id: string, values: Record<string, unknown>, success = 'Updated.') =>
        mutate(() => api.patch(`/api/ops/${resource}/${id}`, values), success), [api, mutate, resource]);
    const remove = useCallback((id: string, success = 'Deleted.') =>
        mutate(() => api.del(`/api/ops/${resource}/${id}`), success), [api, mutate, resource]);

    return { rows, loading, refreshing, error, reload, create, update, remove, mutate };
}

/**
 * Loads any `{ data }` endpoint (a module's own route, not a resource list):
 * `data` stays null until the first answer.
 */
export function useOpsData<T>(path: string | null) {
    const api = useApi();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(path !== null);
    const [error, setError] = useState<string | null>(null);
    const latest = useRef(path);
    latest.current = path;

    const reload = useCallback(async () => {
        if (path === null) { setData(null); setLoading(false); return; }
        setLoading(true);
        try {
            const next = await opsGet<T>(api, path);
            if (latest.current === path) { setData(next); setError(null); }
        } catch (err) {
            if (latest.current === path) setError(errorMessage(err, 'Failed to load'));
        } finally {
            if (latest.current === path) setLoading(false);
        }
    }, [api, path]);

    useEffect(() => { void reload(); }, [reload]);
    return { data, loading, error, reload };
}

/* Lists change rarely within a visit and many forms on a screen share them. */
const lookupCache = new Map<string, Promise<LookupOption[]>>();

export const lookupPath = (type: LookupType, params?: Record<string, string | undefined>) => withQuery('/api/ops/lookups', { type, ...params });

export function loadLookup(api: Api, type: LookupType, params?: Record<string, string | undefined>): Promise<LookupOption[]> {
    const path = lookupPath(type, params);
    let pending = lookupCache.get(path);
    if (!pending) {
        pending = opsGet<LookupOption[]>(api, path).catch((err: unknown) => {
            lookupCache.delete(path);
            throw err;
        });
        lookupCache.set(path, pending);
    }
    return pending;
}

/** Picker options; an empty list while loading or when the request fails. */
export function useLookup(type: LookupType, params?: Record<string, string | undefined>) {
    const api = useApi();
    const key = `${type}|${JSON.stringify(params ?? {})}`;
    const [state, setState] = useState<{ key: string; options: LookupOption[] } | null>(null);
    useEffect(() => {
        let live = true;
        loadLookup(api, type, JSON.parse(key.slice(key.indexOf('|') + 1)) as Record<string, string | undefined>)
            .then((options) => { if (live) setState({ key, options }); })
            .catch(() => { if (live) setState({ key, options: [] }); });
        return () => { live = false; };
    }, [api, type, key]);
    const ready = state?.key === key;
    return { options: ready ? state.options : [], loading: !ready };
}

/** Runs one API action with the outcome reported, for buttons on a row. */
export function useAction() {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const run = useCallback(async (action: Mutation, success: string, after?: () => void | Promise<void>): Promise<boolean> => {
        setBusy(true);
        try {
            await action();
            toast.success(success);
            await after?.();
            return true;
        } catch (err) {
            toast.error(errorMessage(err, 'Something went wrong'));
            return false;
        } finally {
            setBusy(false);
        }
    }, [toast]);
    return { busy, run };
}
