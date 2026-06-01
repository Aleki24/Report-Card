"use client";

import React from 'react';
import { type UserRole } from '@/components/AuthProvider';
import { type UserRow } from '@/hooks/useUsersPage';

const roleBadgeClasses: Record<UserRole, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
  CLASS_TEACHER: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  SUBJECT_TEACHER: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/30' },
  STUDENT: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
};

interface UsersTableProps {
  loading: boolean;
  users: UserRow[];
  paginatedUsers: UserRow[];
  filteredUsers: UserRow[];
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number | ((p: number) => number)) => void;
  usersPerPage: number;
  roleFilter: 'ALL' | UserRole;
  setRoleFilter: (val: 'ALL' | UserRole) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  resettingPasswordId: string | null;
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
}

export function UsersTable({
  loading, users, paginatedUsers, filteredUsers, totalPages, currentPage, setCurrentPage, usersPerPage,
  roleFilter, setRoleFilter, searchQuery, setSearchQuery, resettingPasswordId, onEdit, onResetPassword,
}: UsersTableProps) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">👥</span>
          <h3 className="font-bold text-base font-sans">Active Users ({filteredUsers.length})</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center input-field overflow-hidden px-0 w-full sm:w-64">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-3 shrink-0 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" className="flex-1 border-none outline-none bg-transparent py-1.5 px-2 text-sm" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="mr-2 shrink-0 text-muted-foreground hover:text-foreground text-lg leading-none">×</button>}
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 mb-4 -mx-2 px-2 gap-1">
        {(['ALL', 'ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'] as const).map((role) => (
          <button key={role} onClick={() => setRoleFilter(role)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${roleFilter === role ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {role === 'ALL' ? 'All' : role.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          <img src="https://em-content.zobj.net/source/apple/354/bust-in-silhouette_1f464.png" alt="User" className="w-12 h-12 object-contain mb-4 mx-auto" />
          <p>No users yet. Click &quot;Add User&quot; to add your first team member.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full sm:whitespace-nowrap">
            <thead><tr><th>Name</th><th>Email</th><th>Username</th><th>Password</th><th>Role</th><th>Joined</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {paginatedUsers.map(u => {
                const roleStyle = roleBadgeClasses[u.role];
                return (
                <tr key={u.id}>
                  <td data-label="Name" className="font-medium">{u.first_name} {u.last_name}</td>
                  <td data-label="Email" className="text-muted-foreground text-sm">{u.email || '—'}</td>
                  <td data-label="Username" className="text-muted-foreground text-sm">{u.username || '—'}</td>
                  <td data-label="Password" className="text-muted-foreground text-sm font-mono">{u.plain_password || '—'}</td>
                  <td data-label="Role">
                    <span className={`badge ${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td data-label="Joined" className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td data-label="Status">
                    <span className={`badge ${u.is_active ? 'badge-success' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(u)} className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition" title="Edit User">✏️</button>
                      <button onClick={() => onResetPassword(u)} disabled={resettingPasswordId === u.id} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition disabled:opacity-50" title="Reset Password">
                        {resettingPasswordId === u.id ? '...' : '🔑'}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * usersPerPage + 1} to {Math.min(currentPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-popover text-muted-foreground transition disabled:opacity-50 hover:bg-muted">← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 text-sm rounded-lg border transition ${currentPage === page ? 'bg-primary text-primary-foreground border-primary font-bold' : 'border-border bg-popover text-muted-foreground hover:bg-muted'}`}>{page}</button>
                ))}
                <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-popover text-muted-foreground transition disabled:opacity-50 hover:bg-muted">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
