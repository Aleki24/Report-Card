"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Heart, Search, Plus, Phone, Mail } from 'lucide-react';

// TODO: Connect to Supabase API — replace mock data with real queries
const mockParents = [
  { id: '1', name: 'John Muthoni', phone: '+254 722 100 001', email: 'john.muthoni@email.com', relationship: 'Father', students: ['Alice Muthoni'], status: 'Active' },
  { id: '2', name: 'Sarah Kiprop', phone: '+254 733 200 002', email: 'sarah.kiprop@email.com', relationship: 'Mother', students: ['Brian Kiprop'], status: 'Active' },
  { id: '3', name: 'Michael Adhiambo', phone: '+254 722 300 003', email: '', relationship: 'Father', students: ['Caroline Adhiambo'], status: 'Active' },
  { id: '4', name: 'Jane Wafula', phone: '+254 711 400 004', email: 'jane.wafula@email.com', relationship: 'Mother', students: ['Dennis Wafula', 'Kevin Wafula'], status: 'Active' },
  { id: '5', name: 'Peter Njeri', phone: '+254 700 500 005', email: 'peter.njeri@email.com', relationship: 'Guardian', students: ['Esther Njeri'], status: 'Active' },
];

export default function ParentsPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState('');

  const filtered = mockParents.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search) ||
    p.students.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  const linkedStudents = new Set(mockParents.flatMap(p => p.students)).size;
  const withPhone = mockParents.filter(p => p.phone).length;
  const withEmail = mockParents.filter(p => p.email).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>Parents & Guardians</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Manage parent profiles and link them to students.</p>
        </div>
        {role === 'ADMIN' && (
          <button className="btn-primary" style={{ gap: '8px' }}>
            <Plus style={{ width: 16, height: 16 }} /> Add Parent
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Total Parents', value: mockParents.length.toString(), sub: 'Registered' },
          { label: 'Linked Students', value: linkedStudents.toString(), sub: 'Connected' },
          { label: 'Phone Contacts', value: withPhone.toString(), sub: 'Reachable by phone' },
          { label: 'Email Contacts', value: withEmail.toString(), sub: 'Reachable by email' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Search + Table */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--color-text-muted)' }} />
            <input className="input-field" placeholder="Search parents or students..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-text-muted)' }}>
            <Heart style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No parents found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Relationship</th><th>Linked Students</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td data-label="Name" style={{ fontWeight: 600 }}>{p.name}</td>
                    <td data-label="Phone"><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone style={{ width: 14, height: 14, color: 'var(--color-text-muted)' }} />{p.phone}</div></td>
                    <td data-label="Email" style={{ color: p.email ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>{p.email || '—'}</td>
                    <td data-label="Relationship"><span className="badge badge-info">{p.relationship}</span></td>
                    <td data-label="Students" style={{ fontSize: 13 }}>{p.students.join(', ')}</td>
                    <td data-label="Status"><span className="badge badge-success">{p.status}</span></td>
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
