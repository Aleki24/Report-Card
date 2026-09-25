"use client";

import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '@/lib/api-error-message';
import type { UserRow } from '@/hooks/useUsersPage';
import type { StaffProfileResponse, StudentProfileResponse, UserProfileDetail } from '@/types/user-profile';

export type UserProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: UserProfileDetail };

async function loadProfile(user: Pick<UserRow, 'id' | 'role'>, signal: AbortSignal): Promise<UserProfileDetail> {
  // Students have their own record (class, guardian, results); every other
  // account is served by the staff endpoint, which reads straight off users.
  const isStudent = user.role === 'STUDENT';
  const url = isStudent ? `/api/school/students/${user.id}` : `/api/school/teachers/${user.id}`;
  const res = await fetch(url, { cache: 'no-store', signal });
  const json: unknown = await res.json();
  if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load this profile'));
  return isStudent
    ? { kind: 'student', data: json as StudentProfileResponse }
    : { kind: 'staff', data: json as StaffProfileResponse };
}

type SettledProfile =
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: UserProfileDetail };

export interface UserProfileHandle {
  state: UserProfileState;
  /** Refetch after an edit; the current profile stays on screen until the new one arrives. */
  reload: () => void;
}

/** Loads the full profile for the user shown in the profile dialog. */
export function useUserProfile(user: UserRow | null): UserProfileHandle {
  // Only settled results are stored, tagged with whose they are; "loading" is
  // simply "nothing settled yet for this user", so switching users never shows
  // the previous person's profile.
  const [settled, setSettled] = useState<{ userId: string; result: SettledProfile } | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);

  // Keyed on id and role, not the row object: refreshing the users list hands
  // back new objects for the same person, which should not refetch by itself.
  const userId = user?.id ?? null;
  const role = user?.role ?? null;

  useEffect(() => {
    if (!userId || !role) return;
    const controller = new AbortController();
    loadProfile({ id: userId, role }, controller.signal)
      .then(detail => setSettled({ userId, result: { status: 'ready', detail } }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Could not load this profile';
        setSettled({ userId, result: { status: 'error', message } });
      });
    return () => controller.abort();
  }, [userId, role, version]);

  if (!user) return { state: { status: 'idle' }, reload };
  return { state: settled?.userId === user.id ? settled.result : { status: 'loading' }, reload };
}
