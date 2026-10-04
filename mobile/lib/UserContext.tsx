import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { accessChecks, parseClientAccess, type AccessChecks, type ClientAccess } from '@shared/platform/client-access';
import { ApiError, useApi } from './api';
import { readStored, useCacheKey, writeCache } from './queryCache';
import { errorMessage } from './format';
import { resolveEffectiveRole, type UserRole, type Viewer } from './roles';
import type { CurrentUserProfile, MeResponse } from './types';

interface UserContextValue extends AccessChecks {
    loading: boolean;
    error: string | null;
    /** True when the backend locked this account out (ACCOUNT_DEACTIVATED). */
    deactivated: boolean;
    profile: CurrentUserProfile | null;
    /** The role this account acts as — a subject teacher may act as class teacher. */
    role: UserRole | null;
    /** The stored role, before any class-teacher switch. */
    baseRole: UserRole | null;
    schoolName: string | null;
    /** No school yet, or an admin whose school setup is unfinished — show onboarding (the web's /dashboard/onboarding). */
    needsOnboarding: boolean;
    /** Modules the school runs and what this person's role and duties allow (the web's `/api/auth/me` access). */
    access: ClientAccess;
    /** Role plus access checks, for `canAccessStaffScreen` and friends. */
    viewer: Viewer;
    reload: () => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const api = useApi();
    const [me, setMe] = useState<MeResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deactivated, setDeactivated] = useState(false);

    // /api/auth/me resolves the real role from the database rather than the
    // possibly-stale Clerk JWT claim, the same way the web's AuthProvider does.
    // Later reloads (after a module switch) refresh in place instead of
    // blanking the app behind a loading screen.
    // The account as last seen opens the app at once; the fresh answer replaces it.
    const loaded = useRef(false);
    const ck = useCacheKey('/api/auth/me');
    const load = useCallback(() => {
        if (!loaded.current) {
            setLoading(true);
            void readStored<MeResponse>(ck).then((saved) => {
                if (saved && !loaded.current) {
                    loaded.current = true;
                    setMe(saved);
                    setLoading(false);
                }
            });
        }
        setError(null);
        api.get<MeResponse>('/api/auth/me')
            .then((res) => {
                loaded.current = true;
                setMe(res);
                setDeactivated(false);
                writeCache(ck, res);
            })
            .catch((err: unknown) => {
                const locked = err instanceof ApiError && err.code === 'ACCOUNT_DEACTIVATED';
                setDeactivated(locked);
                // Offline with a stored account: keep working from it rather than blocking the app.
                if (locked || !loaded.current) setError(errorMessage(err, 'Failed to load your account'));
            })
            .finally(() => setLoading(false));
    }, [api, ck]);

    useEffect(() => {
        load();
    }, [load]);

    const baseRole = me?.profile.role ?? null;
    const role = resolveEffectiveRole(baseRole, me?.activeRole);
    const access = useMemo(() => parseClientAccess(me?.access), [me]);
    const checks = useMemo(() => accessChecks(access), [access]);
    const viewer = useMemo<Viewer>(() => ({ role, can: checks.can, hasModule: checks.hasModule }), [role, checks]);
    const value: UserContextValue = {
        loading,
        error,
        deactivated,
        profile: me?.profile ?? null,
        role,
        baseRole,
        schoolName: me?.schoolName ?? null,
        needsOnboarding: !!me && (baseRole === 'PENDING' || !me.profile.school_id || (baseRole === 'ADMIN' && !me.schoolOnboardingCompleted)),
        access,
        viewer,
        ...checks,
        reload: load,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/** The signed-in user, or null on screens that are also open signed out (help, verify). */
export function useOptionalCurrentUser(): UserContextValue | null {
    return useContext(UserContext) ?? null;
}

export function useCurrentUser(): UserContextValue {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error('useCurrentUser must be used within a UserProvider');
    return ctx;
}
