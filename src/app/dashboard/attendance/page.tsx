"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Save, CheckCircle, X, Undo2, Download, MessageSquare } from 'lucide-react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { Card, Input, Select, Button } from '@/components/ui';
import { toast } from 'sonner';

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

const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

/* Status colors come from the CVD-validated --viz-* theme tokens (same
   semantic mapping as the dashboard's attendance chart). */
const STATUS_META: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present: { label: 'P', color: 'var(--viz-good)', bg: 'color-mix(in srgb, var(--viz-good) 14%, transparent)' },
  absent:  { label: 'A', color: 'var(--viz-bad)', bg: 'color-mix(in srgb, var(--viz-bad) 14%, transparent)' },
  late:    { label: 'L', color: 'var(--viz-warn)', bg: 'color-mix(in srgb, var(--viz-warn) 14%, transparent)' },
  excused: { label: 'E', color: 'var(--viz-info)', bg: 'color-mix(in srgb, var(--viz-info) 14%, transparent)' },
};

const PDF_STYLES = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#1E293B' },
  subtitle: { fontSize: 10, color: '#64748B', marginBottom: 24 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { borderBottom: '2 solid #E2E8F0', padding: '6 8', fontWeight: 'bold', fontSize: 9, color: '#94A3B8', textAlign: 'left' as const },
  td: { borderBottom: '1 solid #F1F5F9', padding: '6 8', fontSize: 9, color: '#334155' },
  statusPresent: { color: '#059669', fontWeight: 'bold' },
  statusAbsent: { color: '#DC2626', fontWeight: 'bold' },
  statusLate: { color: '#D97706', fontWeight: 'bold' },
  statusExcused: { color: '#2563EB', fontWeight: 'bold' },
  statusNull: { color: '#CBD5E1' },
  summaryRow: { flexDirection: 'row', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1 solid #E2E8F0' },
  summaryItem: { fontSize: 9, color: '#64748B' },
  summaryValue: { fontSize: 11, fontWeight: 'bold', color: '#0F172A' },
});

function AttendancePdfDocument({
  students, date, className, presentCount, absentCount, lateCount, excusedCount,
}: {
  students: StudentAttendance[];
  date: string;
  className: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
}) {
  const fmtDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const statusStyle = (status: AttendanceStatus | null) => {
    switch (status) {
      case 'present': return PDF_STYLES.statusPresent;
      case 'absent': return PDF_STYLES.statusAbsent;
      case 'late': return PDF_STYLES.statusLate;
      case 'excused': return PDF_STYLES.statusExcused;
      default: return PDF_STYLES.statusNull;
    }
  };

  return (
    <Document>
      <Page size="A4" style={PDF_STYLES.page}>
        <Text style={PDF_STYLES.title}>Attendance Sheet</Text>
        <Text style={PDF_STYLES.subtitle}>{className} &mdash; {fmtDate}</Text>

        <View style={{ flexDirection: 'row', borderBottom: '2 solid #E2E8F0', paddingBottom: 4, marginBottom: 4 }}>
          <Text style={[PDF_STYLES.th, { width: '8%' }]}>#</Text>
          <Text style={[PDF_STYLES.th, { width: '38%' }]}>Student</Text>
          <Text style={[PDF_STYLES.th, { width: '26%' }]}>Adm No</Text>
          <Text style={[PDF_STYLES.th, { width: '28%', textAlign: 'center' }]}>Status</Text>
        </View>

        {students.map((s, i) => (
          <View key={s.id} style={{ flexDirection: 'row', paddingVertical: 3, borderBottom: '1 solid #F1F5F9' }}>
            <Text style={[PDF_STYLES.td, { width: '8%' }]}>{i + 1}</Text>
            <Text style={[PDF_STYLES.td, { width: '38%', fontWeight: 600 }]}>{s.name}</Text>
            <Text style={[PDF_STYLES.td, { width: '26%' }]}>{s.admission_number}</Text>
            <Text style={[PDF_STYLES.td, { width: '28%', textAlign: 'center', ...statusStyle(s.status) }]}>
              {s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : '\u2014'}
            </Text>
          </View>
        ))}

        <View style={PDF_STYLES.summaryRow}>
          <View><Text style={PDF_STYLES.summaryItem}>Present</Text><Text style={PDF_STYLES.summaryValue}>{presentCount}</Text></View>
          <View><Text style={PDF_STYLES.summaryItem}>Absent</Text><Text style={PDF_STYLES.summaryValue}>{absentCount}</Text></View>
          <View><Text style={PDF_STYLES.summaryItem}>Late</Text><Text style={PDF_STYLES.summaryValue}>{lateCount}</Text></View>
          <View><Text style={PDF_STYLES.summaryItem}>Excused</Text><Text style={PDF_STYLES.summaryValue}>{excusedCount}</Text></View>
          <View><Text style={PDF_STYLES.summaryItem}>Total</Text><Text style={PDF_STYLES.summaryValue}>{students.length}</Text></View>
        </View>
      </Page>
    </Document>
  );
}

function SegmentedControl({
  value,
  onChange,
}: {
  value: AttendanceStatus | null;
  onChange: (v: AttendanceStatus) => void;
}) {
  return (
    <div style={{
      display: 'inline-flex',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      background: 'var(--background)',
    }}>
      {STATUS_ORDER.map((s) => {
        const active = value === s;
        const meta = STATUS_META[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            title={s.charAt(0).toUpperCase() + s.slice(1)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              border: 'none',
              borderRight: s !== 'excused' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              background: active ? meta.bg : 'transparent',
              color: active ? meta.color : 'var(--muted-foreground)',
              transition: 'all 0.1s',
              minWidth: 30,
              textAlign: 'center',
              letterSpacing: '0.02em',
            }}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) {
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>
        —
      </span>
    );
  }
  const meta = STATUS_META[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 700,
      background: meta.bg,
      color: meta.color,
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SummaryChip({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 8,
      background: `color-mix(in srgb, ${color} 9%, transparent)`,
      fontSize: 12,
      fontWeight: 600,
      color,
      whiteSpace: 'nowrap',
    }}>
      {icon}
      <span>{count}</span>
      <span style={{ fontWeight: 500, opacity: 0.8 }}>{label}</span>
    </div>
  );
}

export default function AttendancePage() {
  const [gradeStreams, setGradeStreams] = useState<GradeStreamOption[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [originalStudents, setOriginalStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const currentStreamName = gradeStreams.find(s => s.id === selectedStreamId)?.full_name || '';

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

  const fetchAttendance = useCallback(async () => {
    if (!selectedStreamId) { setStudents([]); setOriginalStudents([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ stream_id: selectedStreamId, date: selectedDate });
      const res = await fetch(`/api/school/attendance?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const data: StudentAttendance[] = json.data || [];
        setStudents(data);
        setOriginalStudents(data.map(s => ({ ...s })));
      } else {
        setStudents([]);
        setOriginalStudents([]);
      }
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      setStudents([]);
      setOriginalStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStreamId, selectedDate]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const updateStatus = (id: string, status: AttendanceStatus) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const revertStudent = (id: string) => {
    setStudents(prev => prev.map(s => {
      const orig = originalStudents.find(o => o.id === s.id);
      return s.id === id && orig ? { ...s, status: orig.status } : s;
    }));
  };

  const revertAll = () => {
    setStudents(prev => prev.map(s => {
      const orig = originalStudents.find(o => o.id === s.id);
      return orig ? { ...s, status: orig.status } : s;
    }));
    toast.success('All changes reverted');
  };

  const markAllPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, status: 'present' as AttendanceStatus })));
  };

  const pendingChanges = useMemo(() => {
    return students.filter(s => {
      const orig = originalStudents.find(o => o.id === s.id);
      return orig && orig.status !== s.status;
    });
  }, [students, originalStudents]);

  const hasPendingChanges = pendingChanges.length > 0;

  const handleSave = async () => {
    if (!selectedStreamId || students.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/school/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          stream_id: selectedStreamId,
          records: students.map(s => ({
            student_id: s.id,
            status: s.status || 'present',
            notes: s.notes,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      } else {
        toast.success(`Attendance saved for ${json.count} students.`);
        setOriginalStudents(students.map(s => ({ ...s })));
      }
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleNotifyGuardians = async () => {
    if (!selectedStreamId) return;
    setNotifying(true);
    try {
      const res = await fetch('/api/school/attendance/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, stream_id: selectedStreamId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
        return;
      }
      const { sent = 0, failed = 0, skipped = 0, alreadyNotified = 0 } = json;
      if (sent === 0 && failed === 0 && skipped === 0 && alreadyNotified === 0) {
        toast('No absent students to notify for this date.');
        return;
      }
      const parts: string[] = [];
      if (sent > 0) parts.push(`${sent} sent`);
      if (alreadyNotified > 0) parts.push(`${alreadyNotified} already notified`);
      if (skipped > 0) parts.push(`${skipped} skipped (no phone)`);
      if (failed > 0) parts.push(`${failed} failed`);
      const summary = `Guardian SMS: ${parts.join(', ')}`;
      if (failed > 0) toast.error(summary); else toast.success(summary);
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setNotifying(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (students.length === 0) return;
    setGeneratingPdf(true);
    try {
      const blob = await pdf(
        <AttendancePdfDocument
          students={students}
          date={selectedDate}
          className={currentStreamName}
          presentCount={presentCount}
          absentCount={absentCount}
          lateCount={lateCount}
          excusedCount={excusedCount}
        />
      ).toBlob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Attendance_${currentStreamName.replace(/\s+/g, '_')}_${selectedDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(`PDF failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      s => s.name.toLowerCase().includes(q) || s.admission_number.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const markedStudents = students.filter(s => s.status);
  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const lateCount = students.filter(s => s.status === 'late').length;
  const excusedCount = students.filter(s => s.status === 'excused').length;
  const unmarkedCount = students.filter(s => !s.status).length;
  const attendanceRate = markedStudents.length > 0
    ? Math.round((presentCount / markedStudents.length) * 100)
    : 0;

  return (
    <div className="pb-24 md:pb-20" style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 2px', letterSpacing: '-0.03em' }}>
          Attendance
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>{today}</p>
      </div>

      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Class / Stream
          </label>
          <Select
            className="w-full text-sm"
            style={{ height: 36, borderRadius: 8 }}
            value={selectedStreamId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedStreamId(e.target.value)}
            disabled={loadingStreams}
          >
            <option value="">Select class</option>
            {gradeStreams.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </Select>
        </div>
        <div style={{ minWidth: 180 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Date
          </label>
          <Input
            type="date"
            className="w-full text-sm"
            style={{ height: 36, borderRadius: 8 }}
            value={selectedDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Search
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <Input
              className="w-full text-sm"
              style={{ height: 36, borderRadius: 8, paddingLeft: 30 }}
              placeholder="Search student or adm no..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)',
                  padding: 2, display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!selectedStreamId || students.length === 0}
            onClick={markAllPresent}
            style={{ height: 36, borderRadius: 8, whiteSpace: 'nowrap' }}
          >
            <CheckCircle size={14} />
            Mark All Present
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedStreamId || students.length === 0 || generatingPdf}
            onClick={handleDownloadPdf}
            style={{ height: 36, borderRadius: 8, whiteSpace: 'nowrap' }}
          >
            <Download size={14} />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedStreamId || absentCount === 0 || hasPendingChanges || notifying}
            onClick={handleNotifyGuardians}
            title={hasPendingChanges ? 'Save changes before notifying guardians' : 'Text guardians of absent students'}
            style={{ height: 36, borderRadius: 8, whiteSpace: 'nowrap' }}
          >
            <MessageSquare size={14} />
            {notifying ? 'Notifying...' : 'Notify Guardians'}
          </Button>
        </div>
      </div>

      {!selectedStreamId ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted-foreground)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.3 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--foreground)' }}>Select a class to begin</p>
            <p style={{ fontSize: 13, margin: 0 }}>Choose a class and date to view and mark attendance.</p>
          </div>
        </Card>
      ) : loading ? (
        <Card><div style={{ padding: 20 }}><InlineLoadingSkeleton rows={6} /></div></Card>
      ) : students.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted-foreground)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.3 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--foreground)' }}>No students found</p>
            <p style={{ fontSize: 13, margin: 0 }}>This class has no active students assigned.</p>
          </div>
        </Card>
      ) : (
        <>
          {/* ── Summary Strip ─────────────────────────── */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
            padding: '10px 16px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            alignItems: 'center',
          }}>
            <SummaryChip label="Present" count={presentCount} color="var(--viz-good)" icon={<CheckCircle size={13} />} />
            <SummaryChip label="Absent" count={absentCount} color="var(--viz-bad)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
            <SummaryChip label="Late" count={lateCount} color="var(--viz-warn)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} />
            <SummaryChip label="Excused" count={excusedCount} color="var(--viz-info)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            {unmarkedCount > 0 && (
              <SummaryChip label="Unmarked" count={unmarkedCount} color="var(--muted-foreground)" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>} />
            )}
            <SummaryChip
              label="Rate"
              count={attendanceRate}
              color={attendanceRate >= 80 ? 'var(--viz-good)' : attendanceRate >= 60 ? 'var(--viz-warn)' : 'var(--viz-bad)'}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
            />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>
              {students.length} student{students.length !== 1 ? 's' : ''}
            </span>
            {/* Stacked status bar — same pattern as the dashboard attendance chart;
                order keeps green and red non-adjacent for CVD readability */}
            {students.length > 0 && (
              <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" style={{ flexBasis: '100%' }} role="img"
                aria-label={`${presentCount} present, ${lateCount} late, ${excusedCount} excused, ${absentCount} absent, ${unmarkedCount} unmarked`}>
                {presentCount > 0 && <div style={{ width: `${(presentCount / students.length) * 100}%`, background: 'var(--viz-good)' }} />}
                {lateCount > 0 && <div style={{ width: `${(lateCount / students.length) * 100}%`, background: 'var(--viz-warn)' }} />}
                {excusedCount > 0 && <div style={{ width: `${(excusedCount / students.length) * 100}%`, background: 'var(--viz-info)' }} />}
                {absentCount > 0 && <div style={{ width: `${(absentCount / students.length) * 100}%`, background: 'var(--viz-bad)' }} />}
                {unmarkedCount > 0 && <div style={{ width: `${(unmarkedCount / students.length) * 100}%`, background: 'var(--muted)' }} />}
              </div>
            )}
          </div>

          {/* ── Table ─────────────────────────────────── */}
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <div ref={tableRef} style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
              <table className="sm:min-w-[600px]" style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}>
                <thead>
                  <tr style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'var(--card)',
                    borderBottom: '2px solid var(--border)',
                  }}>
                    <th className="hidden sm:table-cell" style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 40 }}>
                      #
                    </th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Student
                    </th>
                    <th className="hidden sm:table-cell" style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Adm No
                    </th>
                    <th className="hidden md:table-cell" style={{ textAlign: 'center', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 100 }}>
                      Status
                    </th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 160 }}>
                      Mark
                    </th>
                    <th style={{ width: 36, padding: '12px 4px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => {
                    const isPending = pendingChanges.some(p => p.id === s.id);
                    return (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isPending ? 'color-mix(in oklch, var(--color-warning) 4%, transparent)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isPending) e.currentTarget.style.background = 'color-mix(in oklch, var(--foreground) 2%, transparent)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isPending) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td className="hidden sm:table-cell" style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontSize: 12 }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--foreground)' }}>
                          <div>{s.name}</div>
                          <div className="sm:hidden" style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 400, color: 'var(--muted-foreground)' }}>{s.admission_number}</div>
                        </td>
                        <td className="hidden sm:table-cell" style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: 12 }}>
                          {s.admission_number}
                        </td>
                        <td className="hidden md:table-cell" style={{ textAlign: 'center', padding: '10px 16px' }}>
                          <StatusBadge status={s.status} />
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <SegmentedControl
                              value={s.status}
                              onChange={(status) => updateStatus(s.id, status)}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => revertStudent(s.id)}
                              title="Revert"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-warning)',
                                padding: 4,
                                display: 'flex',
                                borderRadius: 4,
                              }}
                            >
                              <Undo2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredStudents.length === 0 && searchQuery && (
                <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                  No students match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Fixed Save Bar ─────────────────────────────
          Sits above the mobile bottom nav (which is also fixed to the
          viewport bottom) so the two don't stack on top of each other
          and swallow the space needed to reach nav items below. */}
      {selectedStreamId && students.length > 0 && (
        <div
          className="bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            zIndex: 40,
            background: 'var(--card)',
            borderTop: '1px solid var(--border)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: hasPendingChanges ? '0 -4px 20px rgba(0,0,0,0.08)' : 'none',
            transition: 'box-shadow 0.2s',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              {students.length} student{students.length !== 1 ? 's' : ''}
            </span>
            {hasPendingChanges && (
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-warning)',
                background: 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
                padding: '3px 10px',
                borderRadius: 6,
              }}>
                {pendingChanges.length} unsaved change{pendingChanges.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasPendingChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={revertAll}
                style={{ height: 36, borderRadius: 8 }}
              >
                <Undo2 size={14} />
                Revert All
              </Button>
            )}
            <Button
              variant={hasPendingChanges ? 'primary' : 'outline'}
              size="sm"
              onClick={handleSave}
              disabled={saving}
              style={{ height: 36, borderRadius: 8, paddingLeft: 16, paddingRight: 16 }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : hasPendingChanges ? 'Save Changes' : 'Saved'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
