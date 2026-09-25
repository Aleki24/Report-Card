"use client";

import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '@/lib/api-error-message';

/** One empty array, so `rows` keeps its identity while loading. */
const NO_ROWS: never[] = [];

type ListState<T> =
  | { status: 'loading' }
  | { status: 'ready'; rows: T[] }
  | { status: 'error'; message: string };

/**
 * GETs a `{ data: T[] }` list. The first load shows as `loading`; `reload()`
 * afterwards keeps the current rows on screen while it fetches, so saving a
 * change doesn't flash the whole list back to a skeleton.
 */
export function useJsonList<T>(url: string | null, errorFallback: string) {
  const [state, setState] = useState<ListState<T>>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!url) return;
    setRefreshing(true);
    try {
      const res = await fetch(url, { cache: 'no-store', signal });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, errorFallback));
      setState({ status: 'ready', rows: ((json as { data?: T[] } | null)?.data) ?? [] });
    } catch (err) {
      if (signal?.aborted) return;
      setState(prev => (prev.status === 'ready' ? prev : { status: 'error', message: err instanceof Error ? err.message : errorFallback }));
      throw err;
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [url, errorFallback]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => { /* shown through state */ });
    return () => controller.abort();
  }, [load]);

  /** Refetches in place. Resolves false if that failed while rows were showing (they stay). */
  const reload = useCallback(() => load().then(() => true, () => false), [load]);
  /** Starts over from the loading state, e.g. "Try again" after an error. */
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    load().catch(() => { /* shown through state */ });
  }, [load]);

  return {
    rows: state.status === 'ready' ? state.rows : (NO_ROWS as T[]),
    loading: state.status === 'loading',
    error: state.status === 'error' ? state.message : null,
    refreshing,
    reload,
    retry,
  };
}
