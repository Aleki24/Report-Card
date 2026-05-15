"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CalendarCheck, Save, CheckCircle } from 'lucide-react';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface StudentAttendance {
  id: string;
  name: string;
  admission_number: string;
  status: AttendanceStatus | null;
  notes: string | null;
}

interface GradeStreamOption {
  id: string;
  full_name: string;
}

const statusColors: Record<AttendanceStatus, { bg: string; color: string; label: string }> = {
  present: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', label: 'Present' },
  absent: { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', label: 'Absent' },
  late: { bg: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', label: 'Late' },
  excused: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', label: 'Excused' },
};

export default function AttendancePage() {
  const { role } = useAuth();
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Fetch grade streams
  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const res = await fetch('/api/school/data?type=grade_streams');
        if (res.ok) {
          const json = await res.json();
          setGradeStreams(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch streams:', err);
      } finally {
        setLoadingStreams(false);
      }
    };
    fetchStreams();
  }, []);

  // Fetch attendance for selected stream + date
  const fetchAttendance = useCallback(async () => {
    if (!selectedStreamId) { setStudents([]); return; }
    setLoading(true);
    setSaveMsg(null);

    try {
      const params = new URLSearchParams({
        stream_id: selectedStreamId,
        date: selectedDate,
      });
      const res = await fetch(`/api/school/attendance?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setStudents(json.data || []);
      } else {
        const json = await res.json();
        console.error('Failed to fetch attendance:', json.error);
        setStudents([]);
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStreamId, selectedDate]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // Update a student's local status
  const updateStatus = (id: string, status: AttendanceStatus) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    setSaveMsg(null);
  };

  // Mark all as present
  const markAllPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, status: 'present' as AttendanceStatus })));
    setSaveMsg(null);
  };

  // Save attendance
  const handleSave = async () => {
    if (!selectedStreamId || students.length === 0) return;

    // Ensure all students have a status
    const unmarked = students.filter(s => !s.status);
    if (unmarked.length > 0) {
      setSaveMsg({ type: 'error', text: `${unmarked.length} student(s) not yet marked. Please mark all students.` });
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch('/api/school/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          stream_id: selectedStreamId,
          records: students.map(s => ({
            student_id: s.id,
            status: s.status,
            notes: s.notes,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setSaveMsg({ type: 'error', text: `Failed: ${json.error || 'Unknown error'}` });
      } else {
        setSaveMsg({ type: 'success', text: `Attendance saved for ${json.count} students.` });
      }
    } catch (err) {
      setSaveMsg({ type: 'error', text: `Failed: ${err instanceof Error ? err.message : 'Network error'}` });
    } finally {
      setSaving(false);
    }
  };

  // Computed stats
  const markedStudents = students.filter(s => s.status);
  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const lateCount = students.filter(s => s.status === 'late').length;
  const excusedCount = students.filter(s => s.status === 'excused').length;
  const percentage = markedStudents.length > 0 ? Math.round((presentCount / markedStudents.length) * 100) : 0;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Attendance</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{today}</p>
      </div>

      {/* Filters */}
      <div className="card flex flex-col md:flex-row md:items-end" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div className="flex-1">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Class / Stream</label>
          <select
            className="input-field w-full"
            value={selectedStreamId}
            onChange={e => setSelectedStreamId(e.target.value)}
            disabled={loadingStreams}
          >
            <option value="">-- Select Class --</option>
            {gradeStreams.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: '180px' }}>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Date</label>
          <input
            type="date"
            className="input-field w-full"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      {selectedStreamId && !loading && students.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          {[
            { label: 'Present', value: presentCount.toString(), sub: 'Students', color: '#10B981' },
            { label: 'Absent', value: absentCount.toString(), sub: 'Students', color: '#EF4444' },
            { label: 'Late', value: lateCount.toString(), sub: 'Students', color: '#F59E0B' },
            { label: 'Excused', value: excusedCount.toString(), sub: 'Students', color: '#3B82F6' },
            { label: 'Attendance', value: `${percentage}%`, sub: "Today's rate", color: percentage >= 80 ? '#10B981' : '#F59E0B' },
          ].map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!selectedStreamId ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
          <CalendarCheck style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>Select a class to view and mark attendance.</p>
        </div>
      ) : loading ? (
        <div className="card">
          <InlineLoadingSkeleton rows={6} />
        </div>
      ) : students.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
          <CalendarCheck style={{ width: 48, height: 48, margin: '0 auto var(--space-4)', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>No active students found in this class.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{students.length} students</span>
            <button className="btn-secondary text-sm" onClick={markAllPresent} style={{ marginLeft: 'auto' }}>
              <CheckCircle style={{ width: 14, height: 14 }} /> Mark All Present
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Student</th><th>Adm No.</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {students.map(s => {
                  const st = s.status ? statusColors[s.status] : null;
                  return (
                    <tr key={s.id}>
                      <td data-label="Student" style={{ fontWeight: 600 }}>{s.name}</td>
                      <td data-label="Adm No." style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.admission_number}</td>
                      <td data-label="Status">
                        {st ? (
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Not marked</span>
                        )}
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

          {/* Save Button */}
          <div style={{ marginTop: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button
              className="btn-primary disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || students.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save style={{ width: 16, height: 16 }} />
              {saving ? 'Saving…' : 'Save Attendance'}
            </button>
            {saveMsg && (
              <div
                className={`p-3 rounded-md text-sm ${saveMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}
              >
                {saveMsg.text}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
