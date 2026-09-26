"use client";

import { useEffect, useState } from 'react';
import { opsFetch } from '@/lib/ops/client';
import type { LookupOption, LookupType } from '@/lib/ops/lookups';

/* Lists change rarely within a visit and many forms on a page share them. */
const cache = new Map<string, Promise<LookupOption[]>>();

export function lookupUrl(type: LookupType, params?: Record<string, string | undefined>) {
    const q = new URLSearchParams({ type });
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v) q.set(k, v); });
    return `/api/ops/lookups?${q}`;
}

export function loadLookup(type: LookupType, params?: Record<string, string | undefined>): Promise<LookupOption[]> {
    const url = lookupUrl(type, params);
    let pending = cache.get(url);
    if (!pending) {
        pending = opsFetch<LookupOption[]>(url).catch(err => {
            cache.delete(url);
            throw err;
        });
        cache.set(url, pending);
    }
    return pending;
}

/** Picker options; an empty list while loading or when the request fails. */
export function useLookup(type: LookupType, params?: Record<string, string | undefined>) {
    const key = `${type}|${JSON.stringify(params ?? {})}`;
    const [state, setState] = useState<{ key: string; options: LookupOption[] } | null>(null);
    useEffect(() => {
        let live = true;
        loadLookup(type, JSON.parse(key.slice(key.indexOf('|') + 1)) as Record<string, string | undefined>)
            .then(options => { if (live) setState({ key, options }); })
            .catch(() => { if (live) setState({ key, options: [] }); });
        return () => { live = false; };
    }, [type, key]);
    const ready = state?.key === key;
    return { options: ready ? state.options : [], loading: !ready };
}
