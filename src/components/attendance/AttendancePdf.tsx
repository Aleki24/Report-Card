import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { ATTENDANCE_LABELS, countAttendance, type AttendanceRosterEntry, type AttendanceStatus } from '@/lib/attendance';
import { formatIsoDate } from '@/lib/dates';

/*
 * Kept in its own module and imported on demand: @react-pdf/renderer is large
 * and only needed when someone downloads a register.
 */

const STATUS_COLOURS: Record<AttendanceStatus, string> = {
  present: '#059669',
  absent: '#DC2626',
  late: '#D97706',
  excused: '#2563EB',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#1E293B' },
  subtitle: { fontSize: 10, color: '#64748B', marginBottom: 24 },
  headRow: { flexDirection: 'row', borderBottom: '2 solid #E2E8F0', paddingBottom: 4, marginBottom: 4 },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottom: '1 solid #F1F5F9' },
  th: { padding: '6 8', fontWeight: 'bold', fontSize: 9, color: '#94A3B8' },
  td: { padding: '6 8', fontSize: 9, color: '#334155' },
  summaryRow: { flexDirection: 'row', gap: 16, marginTop: 24, paddingTop: 16, borderTop: '1 solid #E2E8F0' },
  summaryLabel: { fontSize: 9, color: '#64748B' },
  summaryValue: { fontSize: 11, fontWeight: 'bold', color: '#0F172A' },
});

const COLUMNS = { index: '6%', name: '32%', adm: '16%', status: '14%', notes: '32%' } as const;

interface AttendancePdfProps {
  students: readonly AttendanceRosterEntry[];
  date: string;
  className: string;
}

function AttendancePdfDocument({ students, date, className }: AttendancePdfProps) {
  const counts = countAttendance(students.map(s => s.status));
  const summary: [string, number][] = [
    ['Present', counts.present], ['Absent', counts.absent], ['Late', counts.late],
    ['Excused', counts.excused], ['Unmarked', counts.unmarked], ['Total', counts.total],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Attendance Register</Text>
        <Text style={styles.subtitle}>
          {className} — {formatIsoDate(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>

        <View style={styles.headRow} fixed>
          <Text style={[styles.th, { width: COLUMNS.index }]}>#</Text>
          <Text style={[styles.th, { width: COLUMNS.name }]}>Student</Text>
          <Text style={[styles.th, { width: COLUMNS.adm }]}>Adm No</Text>
          <Text style={[styles.th, { width: COLUMNS.status }]}>Status</Text>
          <Text style={[styles.th, { width: COLUMNS.notes }]}>Notes</Text>
        </View>

        {students.map((s, i) => (
          <View key={s.id} style={styles.row} wrap={false}>
            <Text style={[styles.td, { width: COLUMNS.index }]}>{i + 1}</Text>
            <Text style={[styles.td, { width: COLUMNS.name, fontWeight: 'bold' }]}>{s.name}</Text>
            <Text style={[styles.td, { width: COLUMNS.adm }]}>{s.admission_number || '—'}</Text>
            <Text style={[styles.td, { width: COLUMNS.status, fontWeight: 'bold', color: s.status ? STATUS_COLOURS[s.status] : '#CBD5E1' }]}>
              {s.status ? ATTENDANCE_LABELS[s.status] : '—'}
            </Text>
            <Text style={[styles.td, { width: COLUMNS.notes, color: '#64748B' }]}>{s.notes || ''}</Text>
          </View>
        ))}

        <View style={styles.summaryRow} wrap={false}>
          {summary.map(([label, value]) => (
            <View key={label}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export function renderAttendancePdf(props: AttendancePdfProps): Promise<Blob> {
  return pdf(<AttendancePdfDocument {...props} />).toBlob();
}
