"use client";

import React from 'react';
import {
  AtSign, CalendarDays, Hash, KeyRound, LayoutGrid, List, Pencil, Phone, Search, SearchX, UserPlus, X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Pagination from '@/components/dashboard/Pagination';
import type { RoleCounts, UserRow } from '@/hooks/useUsersPage';
import { RoleBadge, StatusBadge, UserAvatar } from './UserBadges';
import {
  ROLE_FILTERS, describeUser, formatDate, fullName,
  type DirectoryView, type RoleFilter, type StatusFilter, type UserSort,
} from './userMeta';

interface UsersDirectoryProps {
  loading: boolean;
  totalUsers: number;
  paginatedUsers: UserRow[];
  filteredCount: number;
  roleCounts: RoleCounts;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  usersPerPage: number;
  roleFilter: RoleFilter;
  setRoleFilter: (val: RoleFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (val: StatusFilter) => void;
  sortBy: UserSort;
  setSortBy: (val: UserSort) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  view: DirectoryView;
  setView: (view: DirectoryView) => void;
  resettingPasswordId: string | null;
  onView: (user: UserRow) => void;
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
  onAddUser: () => void;
}

/** The identifier an admin looks users up by: admission number for learners, username for everyone else. */
function identifierOf(u: UserRow): { icon: LucideIcon; label: string; value: string } {
  return u.role === 'STUDENT'
    ? { icon: Hash, label: 'Admission no.', value: u.admission_number || '—' }
    : { icon: AtSign, label: 'Username', value: u.username || '—' };
}

interface RowActionsProps {
  user: UserRow;
  resetting: boolean;
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
  className?: string;
}

function RowActions({ user, resetting, onEdit, onResetPassword, className }: RowActionsProps) {
  const name = fullName(user);
  // Sit above the card's stretched "view profile" button and never trigger it.
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const buttonClass = 'inline-flex size-9 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
  return (
    <div className={cn('relative z-10 flex items-center gap-1.5', className)} onClick={stop}>
      <button type="button" onClick={() => onEdit(user)} className={buttonClass} title="Edit user" aria-label={`Edit ${name}`}>
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onResetPassword(user)} disabled={resetting} className={buttonClass} title="Reset password" aria-label={`Reset password for ${name}`}>
        <KeyRound className={cn('size-4', resetting && 'animate-pulse')} aria-hidden="true" />
      </button>
    </div>
  );
}

type ItemProps = Pick<UsersDirectoryProps, 'onView' | 'onEdit' | 'onResetPassword'> & { user: UserRow; resetting: boolean };

function UserCard({ user, resetting, onView, onEdit, onResetPassword }: ItemProps) {
  const name = fullName(user);
  const id = identifierOf(user);
  return (
    <article className="group relative flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      {/* Stretched button: the whole card opens the profile, the action buttons sit above it. */}
      <button
        type="button"
        onClick={() => onView(user)}
        className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`View profile of ${name}`}
      />
      <div className="flex items-start gap-3">
        <div className="relative">
          <UserAvatar firstName={user.first_name} lastName={user.last_name} role={user.role} imageUrl={user.avatar_url} size="md" />
          <span
            className={cn('absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-card', user.is_active ? 'bg-emerald-500' : 'bg-amber-500')}
            title={user.is_active ? 'Active' : 'Inactive'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight group-hover:text-primary">{name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{describeUser(user)}</p>
          <RoleBadge role={user.role} className="mt-2" />
        </div>
      </div>

      <dl className="mt-4 grid gap-1.5 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <id.icon className="size-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{id.label}</dt>
          <dd className="truncate font-mono text-foreground/80">{id.value}</dd>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Phone</dt>
          <dd className="truncate">{user.phone || 'No phone'}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Joined {formatDate(user.created_at)}
        </span>
        <RowActions user={user} resetting={resetting} onEdit={onEdit} onResetPassword={onResetPassword} />
      </div>
    </article>
  );
}

function UserListRow({ user, resetting, onView, onEdit, onResetPassword }: ItemProps) {
  const name = fullName(user);
  const id = identifierOf(user);
  return (
    <tr onClick={() => onView(user)} className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.04]">
      <td className="py-3 pr-3 pl-4">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar firstName={user.first_name} lastName={user.last_name} role={user.role} imageUrl={user.avatar_url} />
          <div className="min-w-0">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onView(user); }}
              className="block max-w-full truncate text-left font-semibold group-hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {name}
            </button>
            <p className="truncate text-xs text-muted-foreground">{describeUser(user)}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-3 sm:table-cell"><RoleBadge role={user.role} /></td>
      <td className="hidden px-3 py-3 md:table-cell">
        <span className="block text-[11px] text-muted-foreground">{id.label}</span>
        <span className="font-mono text-xs">{id.value}</span>
      </td>
      <td className="hidden px-3 py-3 text-sm text-muted-foreground lg:table-cell">{user.phone || '—'}</td>
      <td className="hidden px-3 py-3 text-sm whitespace-nowrap text-muted-foreground xl:table-cell">{formatDate(user.created_at)}</td>
      <td className="hidden px-3 py-3 md:table-cell"><StatusBadge active={user.is_active} /></td>
      <td className="py-3 pr-4 pl-3">
        <RowActions user={user} resetting={resetting} onEdit={onEdit} onResetPassword={onResetPassword} className="justify-end" />
      </td>
    </tr>
  );
}

function DirectorySkeleton({ view }: { view: DirectoryView }) {
  if (view === 'list') {
    return (
      <div className="space-y-3 p-4" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

const VIEW_OPTIONS: readonly { value: DirectoryView; label: string; icon: LucideIcon }[] = [
  { value: 'grid', label: 'Card view', icon: LayoutGrid },
  { value: 'list', label: 'List view', icon: List },
];

export function UsersDirectory(props: UsersDirectoryProps) {
  const {
    loading, totalUsers, paginatedUsers, filteredCount, roleCounts, totalPages, currentPage, setCurrentPage, usersPerPage,
    roleFilter, setRoleFilter, statusFilter, setStatusFilter, sortBy, setSortBy, searchQuery, setSearchQuery,
    view, setView, resettingPasswordId, onView, onEdit, onResetPassword, onAddUser,
  } = props;

  const hasFilters = roleFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery.trim() !== '';
  const clearFilters = () => { setRoleFilter('ALL'); setStatusFilter('ALL'); setSearchQuery(''); };
  const itemProps = (u: UserRow): ItemProps => ({ user: u, resetting: resettingPasswordId === u.id, onView, onEdit, onResetPassword });

  const renderBody = () => {
    if (loading) return <DirectorySkeleton view={view} />;
    if (totalUsers === 0) {
      return (
        <EmptyState
          icon={UserPlus}
          title="No users yet"
          body="Add your first teacher or student. They get a username and one-time password to sign in with."
          action={<button type="button" className="btn-primary" onClick={onAddUser}><UserPlus className="size-4" aria-hidden="true" />Add user</button>}
        />
      );
    }
    if (filteredCount === 0) {
      return (
        <EmptyState
          icon={SearchX}
          title="No matching users"
          body="Nobody matches these filters. Try another name, username or admission number."
          action={<button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>}
        />
      );
    }
    if (view === 'grid') {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedUsers.map(u => <UserCard key={u.id} {...itemProps(u)} />)}
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <table className="w-full table-fixed text-left">
          <thead className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="py-2.5 pr-3 pl-4">User</th>
              <th scope="col" className="hidden w-40 px-3 py-2.5 sm:table-cell">Role</th>
              <th scope="col" className="hidden w-40 px-3 py-2.5 md:table-cell">ID</th>
              <th scope="col" className="hidden w-36 px-3 py-2.5 lg:table-cell">Phone</th>
              <th scope="col" className="hidden w-32 px-3 py-2.5 xl:table-cell">Joined</th>
              <th scope="col" className="hidden w-28 px-3 py-2.5 md:table-cell">Status</th>
              <th scope="col" className="w-28 py-2.5 pr-4 pl-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map(u => <UserListRow key={u.id} {...itemProps(u)} />)}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section aria-label="User directory" className="rounded-3xl border border-border/70 bg-card/60 p-3 shadow-sm sm:p-5">
      {/* Toolbar: search + layout toggle on the first row and the two selects on the
          second on phones; one row from lg, with the toggle moved to the end. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            className="input-field input-icon-left input-icon-right"
            placeholder="Search name, username, phone, adm. no…"
            aria-label="Search users by name, username, phone, admission number or class"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div role="group" aria-label="Layout" className="flex h-11 items-center rounded-xl border border-input bg-background p-1 lg:order-last">
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              aria-pressed={view === value}
              title={label}
              className={cn('flex size-9 items-center justify-center rounded-lg transition-colors', view === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 lg:contents">
          <select className="input-field" aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="input-field" aria-label="Sort users" value={sortBy} onChange={e => setSortBy(e.target.value as UserSort)}>
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Role filter */}
      <div role="group" aria-label="Filter by role" className="-mx-3 mt-4 mb-5 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {ROLE_FILTERS.map(({ value, label, icon: Icon }) => {
          const selected = roleFilter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setRoleFilter(value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                selected ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
              <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', selected ? 'bg-primary-foreground/20' : 'bg-muted')}>
                {roleCounts[value]}
              </span>
            </button>
          );
        })}
      </div>

      {!loading && totalUsers > 0 && (
        <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
          {filteredCount === totalUsers ? `${totalUsers} users` : `${filteredCount} of ${totalUsers} users`}
          {hasFilters && filteredCount > 0 && (
            <button type="button" onClick={clearFilters} className="ml-2 font-medium text-primary hover:underline">Clear filters</button>
          )}
        </p>
      )}

      {renderBody()}

      {!loading && (
        <div className="-mx-3 mt-4 sm:-mx-5">
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredCount} pageSize={usersPerPage} onPageChange={setCurrentPage} />
        </div>
      )}
    </section>
  );
}
