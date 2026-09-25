"use client";

import React, { useId, useRef, useState } from 'react';
import { AlertCircle, KeyRound, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialogBehavior } from '@/hooks/useDialogBehavior';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { UserRow } from '@/hooks/useUsersPage';
import { RoleBadge, StatusBadge, UserAvatar } from './UserBadges';
import { ROLE_META, describeUser, fullName } from './userMeta';
import { ProfileSkeleton } from './profile/ProfileParts';
import { STUDENT_TABS, StudentProfileView, type StudentTab } from './profile/StudentProfileView';
import { StaffProfileView, staffTabsFor, type StaffTab } from './profile/StaffProfileView';

type ProfileTab = StudentTab | StaffTab;

interface UserProfileDialogProps {
  /** The user to show; null keeps the dialog closed. */
  user: UserRow | null;
  onClose: () => void;
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
  resetting: boolean;
}

interface ProfileTabsProps {
  tabs: readonly { value: ProfileTab; label: string }[];
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  idPrefix: string;
}

function ProfileTabs({ tabs, active, onChange, idPrefix }: ProfileTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs, as the WAI-ARIA tabs pattern expects.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Profile sections" className="flex gap-1 overflow-x-auto border-b border-border/70 px-4 sm:px-6">
      {tabs.map((t, i) => {
        const selected = t.value === active;
        return (
          <button
            key={t.value}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.value}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              selected ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ProfileBody({ user, onEdit, onResetPassword, resetting, titleId }: Omit<UserProfileDialogProps, 'user' | 'onClose'> & { user: UserRow; titleId: string }) {
  const state = useUserProfile(user);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const idPrefix = useId();
  const tabs = user.role === 'STUDENT' ? STUDENT_TABS : staffTabsFor(user);
  const name = fullName(user);
  const detailAvatar = state.status === 'ready' ? state.detail.data.profile.avatar_url : null;

  const renderContent = () => {
    switch (state.status) {
      case 'idle':
      case 'loading':
        return <ProfileSkeleton />;
      case 'error':
        return (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{state.message}</p>
          </div>
        );
      case 'ready':
        return state.detail.kind === 'student'
          ? <StudentProfileView user={user} data={state.detail.data} tab={tab as StudentTab} />
          : <StaffProfileView user={user} data={state.detail.data} tab={tab as StaffTab} />;
    }
  };

  return (
    <>
      {/* Hero */}
      <div>
        <div className={cn('relative h-24 overflow-hidden bg-gradient-to-br sm:h-32', ROLE_META[user.role].gradient)} aria-hidden="true">
          <div className="absolute -top-16 -right-10 size-48 rounded-full bg-white/15" />
          <div className="absolute -bottom-20 left-1/3 size-40 rounded-full bg-white/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.18)_1px,transparent_0)] bg-[length:18px_18px]" />
        </div>
        <div className="relative px-4 pb-4 sm:px-6">
          <div className="-mt-12 flex flex-col items-center gap-4 sm:-mt-14 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-col items-center gap-3 text-center md:flex-row md:items-start md:gap-5 md:text-left">
              <UserAvatar
                firstName={user.first_name}
                lastName={user.last_name}
                role={user.role}
                imageUrl={detailAvatar ?? user.avatar_url}
                size="lg"
                className="shadow-lg ring-4 ring-card"
              />
              <div className="min-w-0 md:pt-16">
                <h2 id={titleId} className="font-display text-xl font-bold tracking-tight break-words sm:text-2xl">{name}</h2>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{describeUser(user)}</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  <RoleBadge role={user.role} />
                  <StatusBadge active={user.is_active} label={user.is_active ? 'Active account' : 'Inactive account'} />
                </div>
              </div>
            </div>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto md:pt-17">
              <button type="button" className="btn-secondary h-9 flex-1 text-xs sm:flex-none" onClick={() => onEdit(user)}>
                <Pencil className="size-3.5" aria-hidden="true" />Edit
              </button>
              <button type="button" className="btn-secondary h-9 flex-1 text-xs sm:flex-none" onClick={() => onResetPassword(user)} disabled={resetting}>
                <KeyRound className="size-3.5" aria-hidden="true" />{resetting ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {tabs.length > 1 && (
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <ProfileTabs tabs={tabs} active={tab} onChange={setTab} idPrefix={idPrefix} />
        </div>
      )}

      <div
        id={`${idPrefix}-panel`}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${idPrefix}-tab-${tab}` : undefined}
        className="bg-muted/20 p-4 sm:p-6"
      >
        {renderContent()}
      </div>
    </>
  );
}

/**
 * Everything the school knows about one user: photo, identity, contacts and,
 * for students, class, guardian, results and attendance; for teachers, their
 * classes, subjects and recent exams. A bottom sheet on phones, a centred
 * dialog from the `sm` breakpoint up.
 */
export function UserProfileDialog({ user, onClose, ...rest }: UserProfileDialogProps) {
  const { panelRef, backdropProps } = useDialogBehavior(user !== null, onClose);
  const titleId = useId();

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in sm:items-center sm:p-4" {...backdropProps}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-card text-card-foreground shadow-2xl outline-none animate-modal-in sm:max-h-[90vh] sm:max-w-3xl sm:rounded-3xl lg:max-w-4xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="absolute top-3 right-3 z-20 flex size-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition-colors hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <div className="overflow-y-auto overscroll-contain">
          {/* Keyed by user so the tab and loaded profile reset when a different user is opened. */}
          <ProfileBody key={user.id} user={user} titleId={titleId} {...rest} />
        </div>
      </div>
    </div>
  );
}
