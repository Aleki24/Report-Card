"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  Heart, Search, Plus, Phone, Mail, Users, GraduationCap,
  MoreHorizontal, Eye, Pencil, Link2, Trash2,
} from 'lucide-react';

// TODO: Connect to Supabase API — replace mock data with real queries
const mockParents = [
  { id: '1', name: 'Mary Wanjiku', phone: '+254 712 345 678', email: 'mary.wanjiku@gmail.com', relationship: 'Mother', students: ['Brian Otieno'], status: 'Active' },
  { id: '2', name: 'Peter Kamau', phone: '+254 723 456 789', email: 'peter.kamau@gmail.com', relationship: 'Father', students: ['Grace Kamau'], status: 'Active' },
  { id: '3', name: 'Michael Adhiambo', phone: '+254 734 567 890', email: '', relationship: 'Father', students: ['Caroline Adhiambo'], status: 'Inactive' },
  { id: '4', name: 'Jane Wafula', phone: '+254 711 678 901', email: 'jane.wafula@gmail.com', relationship: 'Mother', students: ['Dennis Wafula', 'Kevin Wafula'], status: 'Active' },
  { id: '5', name: 'Peter Njeri', phone: '+254 700 789 012', email: 'peter.njeri@gmail.com', relationship: 'Guardian', students: ['Esther Njeri'], status: 'Active' },
];

export default function ParentsPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = mockParents.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.students.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const linkedStudents = new Set(mockParents.flatMap(p => p.students)).size;
  const withPhone = mockParents.filter(p => p.phone).length;
  const withEmail = mockParents.filter(p => p.email).length;

  const stats = [
    { label: 'Total Parents', value: mockParents.length.toString(), sub: 'Registered parent profiles', icon: <Users size={20} /> },
    { label: 'Linked Students', value: linkedStudents.toString(), sub: 'Connected to parents', icon: <GraduationCap size={20} /> },
    { label: 'Phone Contacts', value: withPhone.toString(), sub: 'Reachable by phone', icon: <Phone size={20} /> },
    { label: 'Email Contacts', value: withEmail.toString(), sub: 'Reachable by email', icon: <Mail size={20} /> },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 30, marginBottom: 'var(--space-1)', letterSpacing: '-0.025em' }}>Parents & Guardians</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Manage parent profiles, contacts, and student relationships.</p>
        </div>
        {role === 'ADMIN' && (
          <button className="btn-primary" style={{ gap: '8px', borderRadius: 'var(--radius-md)' }}>
            <Plus style={{ width: 16, height: 16 }} /> Add Parent
          </button>
        )}
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
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>View, search, and manage parent contact details.</p>
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
                  <th>Relationship</th>
                  <th>Linked Student</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
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
                        {p.phone}
                      </div>
                    </td>
                    <td data-label="Email Address" style={{ color: p.email ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                      {p.email || '—'}
                    </td>
                    <td data-label="Relationship">
                      <span className="badge badge-info">{p.relationship}</span>
                    </td>
                    <td data-label="Linked Student">
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {p.students.map(s => (
                          <span key={s} style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '2px 8px', borderRadius: '6px', fontSize: 12, fontWeight: 500,
                            background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)',
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${p.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'right', position: 'relative' }}>
                      <button
                        onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                        style={{
                          background: 'none', border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)', padding: '6px',
                          cursor: 'pointer', color: 'var(--color-text-secondary)',
                          display: 'inline-flex', alignItems: 'center',
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {openMenu === p.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 20,
                          minWidth: 160, borderRadius: 'var(--radius-md)',
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '4px',
                          marginTop: 4,
                        }}>
                          {[
                            { label: 'View', icon: <Eye size={14} /> },
                            { label: 'Edit', icon: <Pencil size={14} /> },
                            { label: 'Link Student', icon: <Link2 size={14} /> },
                          ].map(action => (
                            <button
                              key={action.label}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                width: '100%', padding: '8px 12px', borderRadius: '6px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: 13, color: 'var(--color-text-secondary)',
                                textAlign: 'left',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                              onClick={() => setOpenMenu(null)}
                            >
                              {action.icon} {action.label}
                            </button>
                          ))}
                          <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px 0' }} />
                          <button
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              width: '100%', padding: '8px 12px', borderRadius: '6px',
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: 13, color: 'var(--color-danger)',
                              textAlign: 'left',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            onClick={() => setOpenMenu(null)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
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
