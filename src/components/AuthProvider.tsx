"use client";

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useSession, signOut as nextAuthSignOut, SessionProvider } from 'next-auth/react';
import type { UserRole } from '@/types';

interface UserProfile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
    is_active: boolean;
    school_id: string | null;
}

export type { UserRole };

interface AuthContextType {
    user: { id: string; email: string } | null;
    profile: UserProfile | null;
    role: UserRole | null;
    availableRoles: UserRole[];
    schoolName: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
    switchRole: (role: UserRole) => Promise<void>;
    devRoleOverride: UserRole | null;
    setDevRoleOverride: (role: UserRole | null) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    role: null,
    availableRoles: [],
    schoolName: null,
    loading: true,
    signOut: async () => { },
    switchRole: async () => { },
    devRoleOverride: null,
    setDevRoleOverride: () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

function AuthProviderInner({ children }: { children: React.ReactNode }) {
    const { data: session, status, update } = useSession();
    const [devRoleOverride, setDevRoleOverride] = useState<UserRole | null>(null);
    const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);

    const sessionUser = session?.user as any;

    // Build user and profile entirely from the JWT session — no Supabase client-side queries
    const user = useMemo(() => {
        if (!sessionUser?.id) return null;
        return { id: sessionUser.id, email: sessionUser.email || '' };
    }, [sessionUser?.id, sessionUser?.email]);

    const profile: UserProfile | null = useMemo(() => {
        if (!sessionUser?.id) return null;
        return {
            id: sessionUser.id,
            first_name: sessionUser.firstName || '',
            last_name: sessionUser.lastName || '',
            email: sessionUser.email || '',
            role: sessionUser.role || 'ADMIN',
            is_active: true,
            school_id: sessionUser.schoolId || null,
        };
    }, [sessionUser?.id, sessionUser?.firstName, sessionUser?.lastName, sessionUser?.email, sessionUser?.role, sessionUser?.schoolId]);

    const schoolName: string | null = sessionUser?.schoolName || null;

    useEffect(() => {
        // Fetch available roles if user is a teacher
        if (profile && (profile.role === 'CLASS_TEACHER' || profile.role === 'SUBJECT_TEACHER')) {
            const fetchRoles = async () => {
                try {
                    const res = await fetch('/api/auth/available-roles');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.roles && Array.isArray(data.roles)) {
                            // Ensure current role is included even if not returned properly
                            const roles = new Set(data.roles as UserRole[]);
                            roles.add(profile.role);
                            setAvailableRoles(Array.from(roles));
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch available roles', e);
                }
            };
            fetchRoles();
        } else if (profile?.role) {
            setAvailableRoles([profile.role]);
        }
    }, [profile?.id]); // Only re-fetch if exactly user ID changes, don't re-fetch on role change loop

    const signOut = useCallback(async () => {
        await nextAuthSignOut({ callbackUrl: '/login' });
    }, []);

    const switchRole = useCallback(async (newRole: UserRole) => {
        if (availableRoles.includes(newRole)) {
            await update({ role: newRole });
            window.location.reload(); // Reload to refresh all components and data bounds
        }
    }, [availableRoles, update]);

    const getEffectiveRole = (): UserRole | null => {
        if (process.env.NODE_ENV === 'development' && devRoleOverride) {
            return devRoleOverride;
        }
        return profile?.role ?? null;
    };

    const getEffectiveProfile = (): UserProfile | null => {
        if (process.env.NODE_ENV === 'development' && devRoleOverride) {
            return {
                id: profile?.id || 'dev-id',
                first_name: 'Dev',
                last_name: devRoleOverride.replace('_', ' '),
                email: 'dev@localhost',
                role: devRoleOverride,
                is_active: true,
                school_id: profile?.school_id || null,
            };
        }
        return profile;
    };

    const loading = status === 'loading';
    const effectiveRole = getEffectiveRole();
    const effectiveProfile = getEffectiveProfile();

    const value = useMemo(() => ({
        user,
        profile: effectiveProfile,
        role: effectiveRole,
        availableRoles,
        schoolName,
        loading,
        signOut,
        switchRole,
        devRoleOverride,
        setDevRoleOverride,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [user, effectiveProfile, effectiveRole, availableRoles, schoolName, loading, devRoleOverride, signOut, switchRole]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AuthProviderInner>{children}</AuthProviderInner>
        </SessionProvider>
    );
}
