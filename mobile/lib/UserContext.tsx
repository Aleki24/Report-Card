import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useApi } from './api';

export type UserRole = 'ADMIN' | 'CLASS_TEACHER' | 'SUBJECT_TEACHER' | 'STUDENT' | 'PENDING';

export interface CurrentUserProfile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
    school_id: string | null;
    is_active: boolean;
}

interface MeResponse {
    profile: CurrentUserProfile;
    schoolName: string | null;
    schoolOnboardingCompleted: boolean;
}

interface UserContextValue {
    loading: boolean;
    error: string | null;
    profile: CurrentUserProfile | null;
    role: UserRole | null;
    schoolName: string | null;
    reload: () => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const api = useApi();
    const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
    const [schoolName, setSchoolName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        api
            .get<MeResponse>('/api/auth/me')
            .then((res) => {
                setProfile(res.profile);
                setSchoolName(res.schoolName);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your account'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <UserContext.Provider value={{ loading, error, profile, role: profile?.role ?? null, schoolName, reload: load }}>
            {children}
        </UserContext.Provider>
    );
}

export function useCurrentUser(): UserContextValue {
    const ctx = useContext(UserContext);
    if (!ctx) throw new Error('useCurrentUser must be used within a UserProvider');
    return ctx;
}
