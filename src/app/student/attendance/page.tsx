"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { CalendarCheck } from 'lucide-react';

const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    present: { bg: 'rgba(16,185,129,0.12)', color: 'var(--color-success)', label: 'Present' },
    absent: { bg: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', label: 'Absent' },
    late: { bg: 'rgba(234,179,8,0.12)', color: 'var(--color-warning)', label: 'Late' },
    excused: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', label: 'Excused' },
};

export default function StudentAttendancePage() {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [monthFilter, setMonthFilter] = useState('');

    useEffect(() => {
        let url = '/api/school/student/attendance';
        if (monthFilter) {
            const [y, m] = monthFilter.split('-');
            const from = `${y}-${m}-01`;
            const lastDay = new Date(Number(y), Number(m), 0).getDate();
            const to = `${y}-${m}-${lastDay}`;
            url += `?from=${from}&to=${to}`;
        }
        setLoading(true);
        fetch(url).then(r => r.json()).then(j => setRecords(j.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, [monthFilter]);

    // Stats
    const stats = useMemo(() => {
        const total = records.length;
        const present = records.filter((r: any) => r.status === 'present').length;
        const absent = records.filter((r: any) => r.status === 'absent').length;
        const late = records.filter((r: any) => r.status === 'late').length;
        const excused = records.filter((r: any) => r.status === 'excused').length;
        const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
        return { total, present, absent, late, excused, rate };
    }, [records]);

    // Available months
    const months = useMemo(() => {
        const set = new Set<string>();
        records.forEach((r: any) => { if (r.date) set.add(r.date.slice(0, 7)); });
        return Array.from(set).sort().reverse();
    }, [records]);

    if (loading) return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div className="skeleton-bone" style={{ width: '30%', height: 22, borderRadius: 6, marginBottom: 24 }} />
            <div className="student-kpi-grid">{[1,2,3,4].map(i => <div key={i} className="student-skeleton-card" style={{ height: 72 }}><div className="skeleton-bone" style={{ width: '50%', height: 14, borderRadius: 6, marginBottom: 8 }} /><div className="skeleton-bone" style={{ width: '30%', height: 20, borderRadius: 6 }} /></div>)}</div>
        </div>
    );

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div className="student-page-header"><h1>Attendance</h1><p>View your daily attendance history.</p></div>

            {/* Filter */}
            <div className="student-filter-bar">
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                    <option value="">All Months</option>
                    {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
                </select>
            </div>

            {/* Stats */}
            <div className="student-kpi-grid">
                <StatMini label="Attendance Rate" value={`${stats.rate}%`} color={stats.rate >= 80 ? 'var(--color-success)' : 'var(--color-warning)'} />
                <StatMini label="Present" value={String(stats.present)} color="var(--color-success)" />
                <StatMini label="Absent" value={String(stats.absent)} color="var(--color-danger)" />
                <StatMini label="Late / Excused" value={`${stats.late} / ${stats.excused}`} color="var(--color-warning)" />
            </div>

            {records.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                    <CalendarCheck size={36} style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', opacity: 0.4 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No Attendance Records</p>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Your attendance records will appear here.</p>
                </div>
            ) : (
                <div className="card">
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead><tr><th>Date</th><th>Day</th><th>Status</th><th>Notes</th></tr></thead>
                        <tbody>
                            {records.map((r: any) => {
                                const d = new Date(r.date);
                                const s = statusColors[r.status] || statusColors.present;
                                return (
                                    <tr key={r.id}>
                                        <td data-label="Date" style={{ fontWeight: 500 }}>{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                        <td data-label="Day" style={{ color: 'var(--color-text-muted)' }}>{d.toLocaleDateString('en-GB', { weekday: 'long' })}</td>
                                        <td data-label="Status">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
                                                <span className={`attendance-dot attendance-dot-${r.status}`} />
                                                {s.label}
                                            </span>
                                        </td>
                                        <td data-label="Notes" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{r.notes || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color }}>{value}</div>
        </div>
    );
}
