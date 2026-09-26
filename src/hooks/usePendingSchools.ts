"use client";

import { useCallback, useEffect, useState } from 'react';
import { PENDING_SCHOOLS_URL, type PendingSchool } from '@/lib/pending-schools';

type State =
  | { status: 'loading' }
  | { status: 'ready'; schools: PendingSchool[] }
  /** Not the platform owner: nothing to show, not an error. */
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

/** Schools awaiting the platform owner's decision; `forbidden` for everyone else. */
export function usePendingSchools(enabled = true) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch(PENDING_SCHOOLS_URL, { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setState({ status: 'forbidden' }); return; }
      const json = (await res.json().catch(() => null)) as { data?: PendingSchool[]; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Could not load pending schools.');
      setState({ status: 'ready', schools: json?.data ?? [] });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load pending schools.' });
    }
  }, []);

  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  return { state, reload: load };
}
