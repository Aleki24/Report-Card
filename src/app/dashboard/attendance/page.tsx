"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { CalendarCheck, Save, CheckCircle, Users } from 'lucide-react';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, Input, Select, Button, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge } from '@/components/ui';

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
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
      <PageHeader 
        title="Attendance" 
        description={today} 
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-5 flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Class / Stream</label>
            <Select
              className="w-full text-sm h-10"
              value={selectedStreamId}
              onChange={e => setSelectedStreamId(e.target.value)}
              disabled={loadingStreams}
            >
              <option value="">-- Select Class --</option>
              {gradeStreams.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </Select>
          </div>
          <div className="md:min-w-[200px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
            <Input
              type="date"
              className="w-full text-sm h-10"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedStreamId && !loading && students.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Present" value={presentCount.toString()} sub="Students" icon={Users} iconClassName="bg-primary/15 text-primary" />
          <StatCard label="Absent" value={absentCount.toString()} sub="Students" icon={Users} iconClassName="bg-destructive/15 text-destructive" />
          <StatCard label="Late" value={lateCount.toString()} sub="Students" icon={Users} iconClassName="bg-amber-500/15 text-amber-500" />
          <StatCard label="Excused" value={excusedCount.toString()} sub="Students" icon={Users} iconClassName="bg-blue-500/15 text-blue-500" />
          <StatCard label="Attendance" value={`${percentage}%`} sub="Today's rate" icon={CalendarCheck} iconClassName={percentage >= 80 ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-500'} />
        </div>
      )}

      {/* Table */}
      {!selectedStreamId ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">Select a class to view and mark attendance.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="p-6">
            <InlineLoadingSkeleton rows={6} />
          </CardContent>
        </Card>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No active students found in this class.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4 p-4 sm:p-0">
              <span className="text-sm text-muted-foreground font-medium">{students.length} students</span>
              <Button variant="secondary" size="sm" onClick={markAllPresent}>
                <CheckCircle className="w-4 h-4 mr-1.5" /> Mark All Present
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Adm No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(s => {
                    const st = s.status ? statusColors[s.status] : null;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold text-sm">{s.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{s.admission_number}</TableCell>
                        <TableCell>
                          {st ? (
                            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not marked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 flex-wrap">
                            {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map(status => {
                              const sc = statusColors[status];
                              const isActive = s.status === status;
                              return (
                                <button
                                  key={status}
                                  onClick={() => updateStatus(s.id, status)}
                                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${isActive ? '' : 'hover:bg-[var(--color-surface-hover)]'}`}
                                  style={{
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center gap-4 flex-wrap p-4 sm:p-0">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || students.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving…' : 'Save Attendance'}
              </Button>
              {saveMsg && (
                <div
                  className={`px-4 py-2 rounded-md text-sm font-medium border ${saveMsg.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}
                >
                  {saveMsg.text}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
