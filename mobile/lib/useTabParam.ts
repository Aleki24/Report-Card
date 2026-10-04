import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

/**
 * A screen's tab, opened from a link's `?tab=` (the dashboard's "Set grading"
 * opens Settings on Grading). Tab screens stay mounted, so a later link
 * switches the tab too.
 */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
    const { tab: param } = useLocalSearchParams<{ tab?: string }>();
    const parse = (value: string | undefined): T | null => (value && (tabs as readonly string[]).includes(value) ? (value as T) : null);
    const [tab, setTab] = useState<T>(parse(param) ?? fallback);
    useEffect(() => {
        const next = parse(param);
        if (next) setTab(next);
        // `tabs` is a constant list per screen.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [param]);
    return [tab, setTab];
}
