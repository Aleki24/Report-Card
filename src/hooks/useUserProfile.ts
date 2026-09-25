"use client";

import { useEffect, useState } from 'react';
import type { UserRow } from '@/hooks/useUsersPage';
import type { StaffProfileResponse, StudentProfileResponse, UserProfileDetail } from '@/types/user-profile';

export type UserProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: UserProfileDetail };

async function loadProfile(user: UserRow, signal: AbortSignal): Promise<UserProfileDetail> {
  // Students have their own record (class, guardian, results); every other
  // account is served by the staff endpoint, which reads straight off users.
  const isStudent = user.role === 'STUDENT';
  const url = isStudent ? `/api/school/students/${user.id}` : `/api/school/teachers/${user.id}`;
  const res = await fetch(url, { cache: 'no-store', signal });
  const json: unknown = await res.json();
  if (!res.ok) {
    const message = typeof json === 'object' && json !== null && 'error' in json && typeof json.error === 'string'
      ? json.error
      : 'Could not load this profile';
    throw new Error(message);
  }
  return isStudent
    ? { kind: 'student', data: json as StudentProfileResponse }
    : { kind: 'staff', data: json as StaffProfileResponse };
}

type SettledProfile =
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: UserProfileDetail };

/** Loads the full profile for the user shown in the profile dialog. */
export function useUserProfile(user: UserRow | null): UserProfileState {
  // Only settled results are stored, tagged with whose they are; "loading" is
  // simply "nothing settled yet for this user", so switching users never shows
  // the previous person's profile.
  const [settled, setSettled] = useState<{ userId: string; result: SettledProfile } | null>(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadProfile(user, controller.signal)
      .then(detail => setSettled({ userId: user.id, result: { status: 'ready', detail } }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Could not load this profile';
        setSettled({ userId: user.id, result: { status: 'error', message } });
      });
    return () => controller.abort();
  }, [user]);

  if (!user) return { status: 'idle' };
  return settled?.userId === user.id ? settled.result : { status: 'loading' };
}
