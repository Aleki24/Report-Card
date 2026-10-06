import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

type Reload = () => Promise<void>;

interface ScreenRefreshRegistry {
    register: (reload: Reload) => () => void;
    reloadAll: () => Promise<void>;
}

const ScreenRefreshContext = createContext<ScreenRefreshRegistry | null>(null);

/**
 * Lets a whole screen refresh at once: every query rendered inside registers
 * its quiet reload here, and pulling the screen down runs them all. Screens
 * whose data lives in nested sections get pull-to-refresh without wiring
 * each section's reload up by hand.
 */
export function useScreenRefreshRegistry(): ScreenRefreshRegistry {
    const reloads = useRef(new Set<Reload>());
    const register = useCallback((reload: Reload) => {
        reloads.current.add(reload);
        return () => { reloads.current.delete(reload); };
    }, []);
    const reloadAll = useCallback(async () => {
        await Promise.allSettled([...reloads.current].map((reload) => reload()));
    }, []);
    return useMemo(() => ({ register, reloadAll }), [register, reloadAll]);
}

export function ScreenRefreshProvider({ registry, children }: { registry: ScreenRefreshRegistry; children: React.ReactNode }) {
    return <ScreenRefreshContext.Provider value={registry}>{children}</ScreenRefreshContext.Provider>;
}

/** Registers a query's reload with the screen it renders in, if any. */
export function useRegisterScreenRefresh(reload: Reload): void {
    const registry = useContext(ScreenRefreshContext);
    const latest = useRef(reload);
    latest.current = reload;
    useEffect(() => registry?.register(() => latest.current()), [registry]);
}
