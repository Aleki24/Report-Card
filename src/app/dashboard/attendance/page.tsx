"use client";

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CalendarCheck, ChevronDown } from 'lucide-react';

// TODO: Connect to Supabase API — replace mock data with real queries
const mockStudents = [
  { id: '1', name: 'Alice Muthoni', admNo: 'ADM001', status: 'present' },
  { id: '2', name: 'Brian Kiprop', admNo: 'ADM002', status: 'present' },
  { id: '3', name: 'Caroline Adhiambo', admNo: 'ADM003', status: 'absent' },
  { id: '4', name: 'Dennis Wafula', admNo: 'ADM004', status: 'late' },
  { id: '5', name: 'Esther Njeri', admNo: 'ADM005', status: 'present' },
  { id: '6', name: 'Felix Otieno', admNo: 'ADM006', status: 'present' },
  { id: '7', name: 'Grace Chebet', admNo: 'ADM007', status: 'excused' },
  { id: '8', name: 'Hassan Omar', admNo: 'ADM008', status: 'present' },
];

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const statusColors: Record<AttendanceStatus, { bg: string; color: string; label: string }> = {
  present: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', label: 'Present' },
  absent: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', label: 'Absent' },
  late: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', label: 'Late' },
  excused: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', label: 'Excused' },
};

export default function AttendancePage() {
  const { role } = useAuth();
  const [students, setStudents] = useState(mockStudents);
  const [classFilter, setClassFilter] = useState('Form 2 North');

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const lateCount = students.filter(s => s.status === 'late').length;
  const percentage = Math.round((presentCount / students.length) * 100);

  const updateStatus = (id: string, status: AttendanceStatus) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>Attendance</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>{today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Present', value: presentCount.toString(), sub: 'Students', color: '#10B981' },
          { label: 'Absent', value: absentCount.toString(), sub: 'Students', color: '#EF4444' },
          { label: 'Late', value: lateCount.toString(), sub: 'Students', color: '#F59E0B' },
          { label: 'Attendance', value: `${percentage}%`, sub: 'Today\'s rate', color: percentage >= 80 ? '#10B981' : '#F59E0B' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          <select className="input-field" value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ width: 'auto', minWidth: '180px' }}>
            <option>Form 2 North</option>
            <option>Form 2 South</option>
            <option>Form 1 East</option>
            <option>Form 3 South</option>
          </select>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{students.length} students</span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Student</th><th>Adm No.</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {students.map(s => {
                const st = statusColors[s.status as AttendanceStatus];
                return (
                  <tr key={s.id}>
                    <td data-label="Student" style={{ fontWeight: 600 }}>{s.name}</td>
                    <td data-label="Adm No." style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.admNo}</td>
                    <td data-label="Status">
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(status => {
                          const sc = statusColors[status];
                          const isActive = s.status === status;
                          return (
                            <button
                              key={status}
                              onClick={() => updateStatus(s.id, status)}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                                background: isActive ? sc.bg : 'var(--color-surface-raised)',
                                color: isActive ? sc.color : 'var(--color-text-muted)',
                                outline: isActive ? `1px solid ${sc.color}` : '1px solid transparent',
                              }}
                            >
                              {sc.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
