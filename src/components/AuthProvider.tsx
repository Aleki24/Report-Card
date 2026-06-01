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
    role: UserRole | null;
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

async function fetchRoles(): Promise<UserRole[]> {
    try {
        const res = await fetch('/api/auth/available-roles');
        if (!res.ok) return DEFAULT_ROLES;
        const data = await res.json();
        if (!data.roles) return DEFAULT_ROLES;
        const valid = data.roles.filter((r: string) => DEFAULT_ROLES.includes(r as UserRole));
        return valid.length > 0 ? valid : DEFAULT_ROLES;
    } catch {
        return DEFAULT_ROLES;
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
    const [devRoleOverride, setDevRoleOverride] = useState<UserRole | null>(null);

    const { userId } = clerkAuth;

    useEffect(() => {
        if (!isUserLoaded) return;
        if (!userId) {
            setProfile(null);
            return;
        }

        const clerkEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';
        const clerkFirstName = clerkUser?.firstName || '';
        const clerkLastName = clerkUser?.lastName || '';
        const clerkRole = ((clerkUser?.publicMetadata as any)?.role as UserRole) || 'ADMIN';

        const fallback: UserProfile = {
            id: userId,
            first_name: clerkFirstName,
            last_name: clerkLastName,
            email: clerkEmail,
            role: clerkRole,
            is_active: true,
            school_id: (clerkUser?.publicMetadata as any)?.schoolId || null,
        };

        setProfile(fallback);

        fetch('/api/auth/me')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (data.error) return;
                const u = data.profile || data.user;
                if (u) {
                    setProfile({
                        id: u.id || userId,
                        first_name: u.first_name || clerkFirstName,
                        last_name: u.last_name || clerkLastName,
                        email: u.email || clerkEmail,
                        role: u.role || clerkRole,
                        is_active: u.is_active ?? true,
                        school_id: u.school_id || null,
                    });
                }
                if (data.schoolName) setSchoolName(data.schoolName);
                if (data.schoolOnboardingCompleted !== undefined) setSchoolOnboardingCompleted(data.schoolOnboardingCompleted);
            })
            .catch(() => {});
    }, [isUserLoaded, userId, clerkUser?.emailAddresses, clerkUser?.firstName, clerkUser?.lastName]);

    useEffect(() => {
        fetchRoles().then(setAvailableRoles);
    }, []);

    const value = useMemo<AuthContextType>(() => ({
        user: userId && clerkUser
            ? { id: userId, email: clerkUser.emailAddresses?.[0]?.emailAddress || '' }
            : null,
        profile,
        role: devRoleOverride || profile?.role || null,
        availableRoles,
        schoolName,
        schoolOnboardingCompleted,
        loading: !isUserLoaded,
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
    }), [userId, clerkUser, profile, devRoleOverride, isUserLoaded, clerkAuth.sessionId]);

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
