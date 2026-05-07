"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { GraduationCap, Search, Plus, BookOpen, Users as UsersIcon } from 'lucide-react';

// TODO: Connect to Supabase API — replace mock data with real queries
const mockTeachers = [
  { id: '1', name: 'James Ochieng', email: 'james.ochieng@school.ac.ke', role: 'CLASS_TEACHER', subjects: ['Mathematics', 'Physics'], classes: ['Form 2 North'], status: 'Active' },
  { id: '2', name: 'Mary Wanjiku', email: 'mary.wanjiku@school.ac.ke', role: 'SUBJECT_TEACHER', subjects: ['English', 'Literature'], classes: ['Form 1 East', 'Form 1 West'], status: 'Active' },
  { id: '3', name: 'Peter Kamau', email: 'peter.kamau@school.ac.ke', role: 'CLASS_TEACHER', subjects: ['Chemistry', 'Biology'], classes: ['Form 3 South'], status: 'Active' },
  { id: '4', name: 'Grace Akinyi', email: 'grace.akinyi@school.ac.ke', role: 'SUBJECT_TEACHER', subjects: ['Kiswahili'], classes: ['Form 1 East', 'Form 2 North', 'Form 3 South'], status: 'Active' },
  { id: '5', name: 'David Mutua', email: 'david.mutua@school.ac.ke', role: 'SUBJECT_TEACHER', subjects: ['History', 'CRE'], classes: ['Form 2 North', 'Form 2 South'], status: 'Active' },
];

const roleBadge = (role: string) => {
  const isClass = role === 'CLASS_TEACHER';
  return {
    label: isClass ? 'Class Teacher' : 'Subject Teacher',
    bg: isClass ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)',
    color: isClass ? '#3B82F6' : '#8B5CF6',
  };
};

export default function TeachersPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');

  const filtered = mockTeachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  const classTeachers = mockTeachers.filter(t => t.role === 'CLASS_TEACHER').length;
  const subjectTeachers = mockTeachers.filter(t => t.role === 'SUBJECT_TEACHER').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>Teacher Management</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Manage teacher profiles, subject assignments, and class allocations.</p>
        </div>
        {role === 'ADMIN' && (
          <button className="btn-primary" style={{ gap: '8px' }}>
            <Plus style={{ width: 16, height: 16 }} /> Add Teacher
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Total Teachers', value: mockTeachers.length.toString(), sub: 'Registered', icon: GraduationCap },
          { label: 'Class Teachers', value: classTeachers.toString(), sub: 'Homeroom assigned', icon: UsersIcon },
          { label: 'Subject Teachers', value: subjectTeachers.toString(), sub: 'Subject-only', icon: BookOpen },
          { label: 'Active', value: mockTeachers.filter(t => t.status === 'Active').length.toString(), sub: 'Currently active', icon: GraduationCap },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--color-text-muted)' }} />
            <input
              className="input-field"
              placeholder="Search teachers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-text-muted)' }}>
            <GraduationCap style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No teachers found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Subjects</th>
                  <th>Classes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const badge = roleBadge(t.role);
                  return (
                    <tr key={t.id}>
                      <td data-label="Name" style={{ fontWeight: 600 }}>{t.name}</td>
                      <td data-label="Email" style={{ color: 'var(--color-text-muted)' }}>{t.email}</td>
                      <td data-label="Role">
                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: 12, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </td>
                      <td data-label="Subjects" style={{ fontSize: 13 }}>{t.subjects.join(', ')}</td>
                      <td data-label="Classes" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{t.classes.join(', ')}</td>
                      <td data-label="Status"><span className="badge badge-success">{t.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
