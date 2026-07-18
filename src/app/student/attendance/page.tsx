"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { CalendarCheck, UserCheck, UserX, Clock } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import FilterBar, { FilterField } from '@/components/ui/FilterBar';
import { Badge, Select } from '@/components/ui';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface AttendanceRecord {
    id: string;
    date: string;
    status: AttendanceStatus;
    notes: string | null;
}

const STATUS_META: Record<AttendanceStatus, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }> = {
    present: { label: 'Present', variant: 'success' },
    absent: { label: 'Absent', variant: 'danger' },
    late: { label: 'Late', variant: 'warning' },
    excused: { label: 'Excused', variant: 'info' },
};

export default function StudentAttendancePage() {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
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

    const stats = useMemo(() => {
        const total = records.length;
        const present = records.filter((r) => r.status === 'present').length;
        const absent = records.filter((r) => r.status === 'absent').length;
        const late = records.filter((r) => r.status === 'late').length;
        const excused = records.filter((r) => r.status === 'excused').length;
        const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
        return { total, present, absent, late, excused, rate };
    }, [records]);

    const months = useMemo(() => {
        const set = new Set<string>();
        records.forEach((r) => { if (r.date) set.add(r.date.slice(0, 7)); });
        return Array.from(set).sort().reverse();
    }, [records]);

    const columns: DataTableColumn<AttendanceRecord>[] = [
        {
            key: 'date', header: 'Date',
            render: r => <span className="font-medium text-foreground">{new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>,
        },
        {
            key: 'day', header: 'Day', hideOnMobile: true,
            render: r => <span className="text-muted-foreground">{new Date(r.date).toLocaleDateString('en-GB', { weekday: 'long' })}</span>,
        },
        {
            key: 'status', header: 'Status',
            render: r => <Badge variant={STATUS_META[r.status]?.variant ?? 'success'}>{STATUS_META[r.status]?.label ?? r.status}</Badge>,
        },
        { key: 'notes', header: 'Notes', hideOnMobile: true, render: r => <span className="text-muted-foreground">{r.notes || '—'}</span> },
    ];

    return (
        <div className="mx-auto max-w-[900px] pb-10">
            <PageHeader title="Attendance" description="View your daily attendance history." />

            <FilterBar>
                <FilterField label="Month">
                    <Select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                        <option value="">All Months</option>
                        {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
                    </Select>
                </FilterField>
            </FilterBar>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Attendance Rate" value={`${stats.rate}%`} sub="Overall" icon={CalendarCheck} iconClassName={stats.rate >= 80 ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600'} />
                <StatCard label="Present" value={stats.present} sub="Days" icon={UserCheck} iconClassName="bg-emerald-500/12 text-emerald-600" />
                <StatCard label="Absent" value={stats.absent} sub="Days" icon={UserX} iconClassName="bg-red-500/12 text-red-600" />
                <StatCard label="Late / Excused" value={`${stats.late} / ${stats.excused}`} sub="Days" icon={Clock} iconClassName="bg-amber-500/12 text-amber-600" />
            </div>

            <DataTable
                columns={columns}
                rows={records}
                rowKey={r => r.id}
                loading={loading}
                mobileTitleKey="date"
                emptyState="Your attendance records will appear here."
            />
        </div>
    );
}
