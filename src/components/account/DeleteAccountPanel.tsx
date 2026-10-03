'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth, useClerk } from '@clerk/nextjs';
import { Check, Trash2, X } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import {
  ACCOUNT_DELETION_ENDPOINT,
  DELETED_DATA,
  DELETE_CONFIRMATION_WORD,
  RETAINED_DATA,
  isDeleteConfirmation,
  type DeleteAccountRequest,
} from '@/lib/account-deletion';
import { CONTACT_DETAILS } from '@/lib/contact';

function DataList({ items, kept }: { items: readonly string[]; kept?: boolean }) {
  const Icon = kept ? Check : X;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <Icon className={`mt-0.5 size-4 shrink-0 ${kept ? 'text-muted-foreground' : 'text-destructive'}`} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

type Status = { state: 'idle' } | { state: 'deleting' } | { state: 'error'; message: string } | { state: 'deleted' };

/**
 * The public account-deletion page Google Play links to. Signed in, it
 * deletes the account here; signed out, it says how (sign in, or email us).
 */
export function DeleteAccountPanel() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isDeleteConfirmation(confirm)) return;
    setStatus({ state: 'deleting' });
    const body: DeleteAccountRequest = { confirm: DELETE_CONFIRMATION_WORD };
    const res = await fetch(ACCOUNT_DELETION_ENDPOINT, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      const data: unknown = await res?.json().catch(() => null);
      const message = typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : 'Could not delete your account. Please try again.';
      setStatus({ state: 'error', message });
      return;
    }
    setStatus({ state: 'deleted' });
    await signOut().catch(() => undefined);
  }

  if (status.state === 'deleted') {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Check className="size-6" aria-hidden /></span>
        <h2 className="mt-4 font-heading text-xl font-semibold text-foreground">Your account has been deleted</h2>
        <p className="mt-2 text-sm text-muted-foreground">You have been signed out. Thank you for using Skulbase.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Deleted</h2>
          <DataList items={DELETED_DATA} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Kept by the school</h2>
          <DataList items={RETAINED_DATA} kept />
        </div>
      </div>

      <div className="rounded-3xl border border-destructive/30 bg-card p-5 shadow-sm sm:p-8">
        {!isLoaded ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : isSignedIn ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Delete my account</h2>
              <p className="mt-1 text-sm text-muted-foreground">This can’t be undone. Type <strong className="font-semibold text-foreground">{DELETE_CONFIRMATION_WORD}</strong> to confirm.</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              Confirmation
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={DELETE_CONFIRMATION_WORD} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            </label>
            {status.state === 'error' && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{status.message}</p>}
            <Button type="submit" variant="destructive" className="h-11 w-full sm:w-auto sm:self-start" disabled={!isDeleteConfirmation(confirm) || status.state === 'deleting'}>
              {status.state === 'deleting' ? <Spinner size="sm" /> : <Trash2 aria-hidden />}
              Delete my account permanently
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">How to delete your account</h2>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>In the Skulbase app, open <strong className="text-foreground">Profile → Delete account</strong>, or</li>
              <li><Link href="/login?redirect_url=/delete-account" className="text-primary underline-offset-4 hover:underline">Sign in</Link> and come back to this page, or</li>
              <li>
                Email <a href={`mailto:${CONTACT_DETAILS.email}?subject=Delete%20my%20Skulbase%20account`} className="text-primary underline-offset-4 hover:underline">{CONTACT_DETAILS.email}</a>{' '}
                from the address on your account. We delete it within 7 days.
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
