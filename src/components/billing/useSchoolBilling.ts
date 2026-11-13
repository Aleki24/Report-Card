"use client";

import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '@/lib/api-error-message';
import { BILLING_URL, type SchoolBilling } from '@/lib/school-billing';

type Load = { state: 'loading' } | { state: 'ready'; data: SchoolBilling } | { state: 'error'; message: string };

/** The school's Skulbase subscription, reloadable after a change. */
export function useSchoolBilling(enabled = true) {
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const reload = useCallback(async () => {
        try {
            const { data } = await requestJson<{ data: SchoolBilling }>(BILLING_URL, { cache: 'no-store' });
            setLoad({ state: 'ready', data });
        } catch (err) {
            setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load the subscription.' });
        }
    }, []);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading on mount is the effect's purpose
    useEffect(() => { if (enabled) void reload(); }, [enabled, reload]);
    return { load, reload };
}
