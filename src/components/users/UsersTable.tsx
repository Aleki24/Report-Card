"use client";

import React from 'react';
import { type UserRole } from '@/components/AuthProvider';
import { type UserRow } from '@/hooks/useUsersPage';

const roleBadgeColors: Record<UserRole, string> = {
  ADMIN: '#EF4444', CLASS_TEACHER: '#3B82F6', SUBJECT_TEACHER: '#8B5CF6', STUDENT: '#10B981',
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
          <h3 className="font-bold text-base font-[family-name:var(--font-display)]">Active Users ({filteredUsers.length})</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <input type="text" className="input-field w-full sm:w-64 pl-9" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">×</button>}
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 mb-4 -mx-2 px-2 gap-1">
        {(['ALL', 'ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT'] as const).map((role) => (
          <button key={role} onClick={() => setRoleFilter(role)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${roleFilter === role ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'}`}>
            {role === 'ALL' ? 'All' : role.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-[var(--color-text-muted)]">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center text-[var(--color-text-muted)]">
          <img src="https://em-content.zobj.net/source/apple/354/bust-in-silhouette_1f464.png" alt="User" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
          <p>No users yet. Click &quot;Add User&quot; to add your first team member.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full sm:whitespace-nowrap">
            <thead><tr><th>Name</th><th>Email</th><th>Username</th><th>Password</th><th>Role</th><th>Joined</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {paginatedUsers.map(u => (
                <tr key={u.id}>
                  <td data-label="Name" className="font-medium">{u.first_name} {u.last_name}</td>
                  <td data-label="Email" className="text-[var(--color-text-muted)] text-sm">{u.email || '—'}</td>
                  <td data-label="Username" className="text-[var(--color-text-muted)] text-sm">{u.username || '—'}</td>
                  <td data-label="Password" className="text-[var(--color-text-muted)] text-sm font-mono">{u.plain_password || '—'}</td>
                  <td data-label="Role">
                    <span className="badge" style={{ background: `${roleBadgeColors[u.role]}20`, color: roleBadgeColors[u.role], border: `1px solid ${roleBadgeColors[u.role]}40` }}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td data-label="Joined" className="text-[var(--color-text-muted)] text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td data-label="Status">
                    <span className={`badge ${u.is_active ? 'badge-success' : ''}`} style={!u.is_active ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' } : {}}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(u)} className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition" title="Edit User">✏️</button>
                      <button onClick={() => onResetPassword(u)} disabled={resettingPasswordId === u.id} className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition disabled:opacity-50" title="Reset Password">
                        {resettingPasswordId === u.id ? '...' : '🔑'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-[var(--color-border)]">
              <div className="text-sm text-[var(--color-text-muted)]">
                Showing {(currentPage - 1) * usersPerPage + 1} to {Math.min(currentPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-50" style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)} className="px-3 py-1.5 text-sm rounded-lg border transition" style={{ backgroundColor: currentPage === page ? 'var(--color-accent)' : 'var(--color-surface-raised)', borderColor: currentPage === page ? 'var(--color-accent)' : 'var(--color-border)', color: currentPage === page ? '#fff' : 'var(--color-text-secondary)' }}>{page}</button>
                ))}
                <button onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-50" style={{ backgroundColor: 'var(--color-surface-raised)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
