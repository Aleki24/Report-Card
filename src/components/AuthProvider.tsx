"use client";

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useUser, useAuth as useClerkAuth, useSession } from '@clerk/nextjs';
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
    /** The effective role (active_role if switching, otherwise base role) */
    role: UserRole | null;
    /** The user's original/base role from the database (never changes on switch) */
    baseRole: UserRole | null;
    availableRoles: UserRole[];
    schoolName: string | null;
    schoolOnboardingCompleted: boolean | null;
    loading: boolean;
    signOut: () => Promise<void>;
    switchRole: (role: UserRole) => Promise<void>;
    devRoleOverride: UserRole | null;
    setDevRoleOverride: (role: UserRole | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_ROLES: UserRole[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'];

async function fetchRoles(): Promise<{ roles: UserRole[]; baseRole: UserRole | null }> {
    try {
        const res = await fetch('/api/auth/available-roles');
        if (!res.ok) return { roles: DEFAULT_ROLES, baseRole: null };
        const data = await res.json();
        if (!data.roles) return { roles: DEFAULT_ROLES, baseRole: null };
        const valid = data.roles.filter((r: string) => DEFAULT_ROLES.includes(r as UserRole));
        return {
            roles: valid.length > 0 ? valid : DEFAULT_ROLES,
            baseRole: data.baseRole || null,
        };
    } catch {
        return { roles: DEFAULT_ROLES, baseRole: null };
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
    const clerkAuth = useClerkAuth();
    const { session } = useSession();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [schoolName, setSchoolName] = useState<string | null>(null);
    const [schoolOnboardingCompleted, setSchoolOnboardingCompleted] = useState<boolean | null>(null);
    const [availableRoles, setAvailableRoles] = useState<UserRole[]>(DEFAULT_ROLES);
    const [baseRole, setBaseRole] = useState<UserRole | null>(null);
    const [devRoleOverride, setDevRoleOverride] = useState<UserRole | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);

    const { userId } = clerkAuth;

    useEffect(() => {
        if (!isUserLoaded) return;
        if (!userId) {
            setProfile(null);
            setIsProfileLoading(false);
            return;
        }

        const clerkEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
        const clerkFirstName = clerkUser?.firstName || '';
        const clerkLastName = clerkUser?.lastName || '';
        const metadata = (clerkUser?.publicMetadata as any) || {};
        // Base role from Clerk metadata (synced from DB)
        const clerkBaseRole = (metadata.role as UserRole) || 'ADMIN';
        // Active role from Clerk metadata (set by role switching)
        const clerkActiveRole = (metadata.active_role as UserRole) || null;
        // Effective role: active_role overrides base role when switching
        const effectiveRole = clerkActiveRole || clerkBaseRole;

        const fallback: UserProfile = {
            id: userId,
            first_name: clerkFirstName,
            last_name: clerkLastName,
            email: clerkEmail,
            role: effectiveRole,
            is_active: true,
            school_id: metadata.school_id || metadata.schoolId || null,
        };

        setProfile(fallback);
        setBaseRole(clerkBaseRole);

        fetch('/api/auth/me')
            .then(async res => {
                // Deactivated accounts are locked out: sign them out immediately.
                // ClerkProvider's afterSignOutUrl sends them back to /login.
                if (res.status === 403) {
                    const body = await res.json().catch(() => ({}));
                    if (body?.code === 'ACCOUNT_DEACTIVATED') {
                        await clerkAuth.signOut();
                        return null;
                    }
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (!data || data.error) return;
                const u = data.profile || data.user;
                if (u) {
                    // The DB role is the base role; effective role may differ if active_role is set
                    const dbBaseRole = u.role || clerkBaseRole;
                    const activeRole = data.activeRole || clerkActiveRole;
                    const effective = activeRole || dbBaseRole;

                    setProfile({
                        id: u.id || userId,
                        first_name: u.first_name || clerkFirstName,
                        last_name: u.last_name || clerkLastName,
                        email: u.email || clerkEmail,
                        role: effective,
                        is_active: u.is_active ?? true,
                        school_id: u.school_id || null,
                    });
                    setBaseRole(dbBaseRole);
                }
                if (data.schoolName) setSchoolName(data.schoolName);
                if (data.schoolOnboardingCompleted !== undefined) setSchoolOnboardingCompleted(data.schoolOnboardingCompleted);
            })
            .catch(() => {})
            .finally(() => {
                setIsProfileLoading(false);
            });
    }, [isUserLoaded, userId, clerkUser?.emailAddresses, clerkUser?.firstName, clerkUser?.lastName]);

    useEffect(() => {
        fetchRoles().then(({ roles, baseRole: br }) => {
            setAvailableRoles(roles);
            if (br) setBaseRole(br);
        });
    }, []);

    const value = useMemo<AuthContextType>(() => ({
        user: userId && clerkUser
            ? { id: userId, email: clerkUser.emailAddresses?.[0]?.emailAddress || '' }
            : null,
        profile,
        role: devRoleOverride || profile?.role || null,
        baseRole,
        availableRoles,
        schoolName,
        schoolOnboardingCompleted,
        loading: !isUserLoaded || (!!userId && isProfileLoading),
        signOut: () => clerkAuth.signOut(),
        switchRole: async (role: UserRole) => {
            if (!userId) return;
            const res = await fetch('/api/auth/switch-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, userId }),
            });
            if (res.ok) window.location.reload();
        },
        devRoleOverride,
        setDevRoleOverride,
    }), [userId, clerkUser, profile, baseRole, devRoleOverride, isUserLoaded, clerkAuth.sessionId, isProfileLoading, schoolName, schoolOnboardingCompleted, availableRoles]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
