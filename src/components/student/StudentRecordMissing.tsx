"use client";

import React from 'react';
import { UserX } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

/**
 * Shown in place of every student page while the account has no class
 * record: each page would otherwise fail on its own with a refused request.
 */
export function StudentRecordMissing() {
  const { signOut } = useAuth();

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center sm:py-24">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400" aria-hidden>
        <UserX className="size-6" />
      </span>
      <h1 className="text-lg font-semibold sm:text-xl">Student record not set up</h1>
      <p className="text-sm text-muted-foreground">
        Your account is not linked to a class yet. Ask your school admin to enrol you, then sign in again.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-2 rounded-xl border border-destructive/40 px-5 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        Sign out
      </button>
    </section>
  );
}
