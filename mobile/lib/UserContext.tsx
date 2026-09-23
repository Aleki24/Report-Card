import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, useApi } from './api';
import { errorMessage } from './format';
import { resolveEffectiveRole, type UserRole } from './roles';
import type { CurrentUserProfile, MeResponse } from './types';

interface UserContextValue {
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
    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        api.get<MeResponse>('/api/auth/me')
            .then((res) => {
                setMe(res);
                setDeactivated(false);
            })
            .catch((err: unknown) => {
                setDeactivated(err instanceof ApiError && err.code === 'ACCOUNT_DEACTIVATED');
                setError(errorMessage(err, 'Failed to load your account'));
            })
            .finally(() => setLoading(false));
    }, [api]);

    useEffect(() => {
        load();
    }, [load]);

    const baseRole = me?.profile.role ?? null;
    const value: UserContextValue = {
        loading,
        error,
        deactivated,
        profile: me?.profile ?? null,
        role: resolveEffectiveRole(baseRole, me?.activeRole),
        baseRole,
        schoolName: me?.schoolName ?? null,
        reload: load,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): UserContextValue {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error('useCurrentUser must be used within a UserProvider');
    return ctx;
}
