"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  Heart, Search, Phone, Mail, Users, GraduationCap,
  MoreHorizontal, Eye, Pencil, Link2, Trash2,
} from 'lucide-react';
import { TablePageSkeleton } from '@/components/dashboard/LoadingSkeleton';

interface ParentStudent {
  id: string;
  name: string;
  admission_number: string;
  class: string;
  status: string;
}

interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string;
  students: ParentStudent[];
}

export default function ParentsPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch parents from server API
  useEffect(() => {
    const fetchParents = async () => {
      try {
        const res = await fetch('/api/school/parents');
        if (!res.ok) {
          setError('Failed to load parent data');
          setLoading(false);
          return;
        }
        const json = await res.json();
        setParents(json.data || []);
      } catch (err) {
        console.error('Failed to fetch parents:', err);
        setError('Failed to load parent data');
      } finally {
        setLoading(false);
      }
    };
    fetchParents();
  }, []);

  const filtered = parents.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.students.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
  );

  const linkedStudents = new Set(parents.flatMap(p => p.students.map(s => s.id))).size;
  const withPhone = parents.filter(p => p.phone).length;
  const withEmail = parents.filter(p => p.email).length;

  const stats = [
    { label: 'Total Parents', value: parents.length.toString(), sub: 'Registered parent profiles', icon: <Users size={20} /> },
    { label: 'Linked Students', value: linkedStudents.toString(), sub: 'Connected to parents', icon: <GraduationCap size={20} /> },
    { label: 'Phone Contacts', value: withPhone.toString(), sub: 'Reachable by phone', icon: <Phone size={20} /> },
    { label: 'Email Contacts', value: withEmail.toString(), sub: 'Reachable by email', icon: <Mail size={20} /> },
  ];

  if (loading) {
    return <TablePageSkeleton statCards={4} columns={3} />;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
        <Heart style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Parents & Guardians</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>View parent profiles, contacts, and student relationships.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4" style={{ gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-header">
              <div className="stat-label">{s.label}</div>
              <div className="stat-icon">{s.icon}</div>
            </div>
            <div className="stat-value">{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Card Header */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 2 }}>Parent Directory</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>View and search parent contact details aggregated from student records.</p>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--color-text-muted)' }} />
            <input
              className="input-field"
              placeholder="Search parent, student, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
            <Heart style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No parents found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '0 var(--space-6) var(--space-6)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parent Name</th>
                  <th>Phone Number</th>
                  <th>Email Address</th>
                  <th>Linked Students</th>
                  <th>Class</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td data-label="Parent Name" style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--color-accent-glow)',
                          color: 'var(--color-accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        {p.name}
                      </div>
                    </td>
                    <td data-label="Phone Number">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone style={{ width: 14, height: 14, color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        {p.phone || '—'}
                      </div>
                    </td>
                    <td data-label="Email Address" style={{ color: p.email ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                      {p.email || '—'}
                    </td>
                    <td data-label="Linked Students">
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {p.students.map(s => (
                          <span key={s.id} style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '2px 8px', borderRadius: '6px', fontSize: 12, fontWeight: 500,
                            background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)',
                          }}>
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-label="Class" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {[...new Set(p.students.map(s => s.class))].join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
