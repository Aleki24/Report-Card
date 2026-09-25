"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, UserCheck, UserX, Clock, RotateCcw } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import FilterBar, { FilterField } from '@/components/ui/FilterBar';
import { Badge, Select } from '@/components/ui';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { apiErrorMessage } from '@/lib/api-error-message';
import { formatIsoDate } from '@/lib/dates';
import { ATTENDANCE_LABELS, attendanceRate, countAttendance, type AttendanceStatus } from '@/lib/attendance';

interface AttendanceRecord {
    id: string;
    date: string;
    status: AttendanceStatus;
    notes: string | null;
}

const STATUS_VARIANT: Record<AttendanceStatus, 'success' | 'danger' | 'warning' | 'info'> = {
    present: 'success',
    absent: 'danger',
    late: 'warning',
    excused: 'info',
};

const columns: DataTableColumn<AttendanceRecord>[] = [
    {
        key: 'date', header: 'Date',
        render: r => <span className="font-medium text-foreground">{formatIsoDate(r.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>,
    },
    {
        key: 'day', header: 'Day', hideOnMobile: true,
        render: r => <span className="text-muted-foreground">{formatIsoDate(r.date, { weekday: 'long' })}</span>,
    },
    {
        key: 'status', header: 'Status',
        render: r => <Badge variant={STATUS_VARIANT[r.status]}>{ATTENDANCE_LABELS[r.status]}</Badge>,
    },
    { key: 'notes', header: 'Notes', hideOnMobile: true, render: r => <span className="text-muted-foreground">{r.notes || '—'}</span> },
];

type LoadState = { state: 'loading' } | { state: 'ready'; records: AttendanceRecord[] } | { state: 'error'; message: string };

export default function StudentAttendancePage() {
    const [load, setLoad] = useState<LoadState>({ state: 'loading' });
    const [monthFilter, setMonthFilter] = useState('');

    // The whole history is fetched once and filtered here: fetching one month
    // at a time left only that month in the picker, so there was no way to
    // move to another month except back through "All months".
    const fetchRecords = useCallback(async () => {
        setLoad({ state: 'loading' });
        try {
            const res = await fetch('/api/school/student/attendance');
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load your attendance.'));
            setLoad({ state: 'ready', records: ((json as { data?: AttendanceRecord[] } | null)?.data) ?? [] });
        } catch (err) {
            setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load your attendance.' });
        }
    }, []);

    useEffect(() => {
        void fetchRecords();
    }, [fetchRecords]);

    const allRecords = useMemo(() => (load.state === 'ready' ? load.records : []), [load]);

    const months = useMemo(
        () => Array.from(new Set(allRecords.map(r => r.date.slice(0, 7)))).sort().reverse(),
        [allRecords],
    );

    const records = useMemo(
        () => (monthFilter ? allRecords.filter(r => r.date.startsWith(monthFilter)) : allRecords),
        [allRecords, monthFilter],
    );

    const counts = useMemo(() => countAttendance(records.map(r => r.status)), [records]);
    const rate = attendanceRate(counts);
    const period = monthFilter ? formatIsoDate(`${monthFilter}-01`, { month: 'long', year: 'numeric' }) : 'All recorded days';

    return (
        <div className="mx-auto w-full max-w-[900px] pb-10">
            <PageHeader title="Attendance" eyebrow="My school" icon={CalendarCheck} hue="teal" description="Your daily attendance, as recorded by your class teacher." />

            <FilterBar>
                <FilterField label="Month">
                    <Select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} disabled={months.length === 0}>
                        <option value="">All months</option>
                        {months.map(m => <option key={m} value={m}>{formatIsoDate(`${m}-01`, { month: 'long', year: 'numeric' })}</option>)}
                    </Select>
                </FilterField>
            </FilterBar>

            {load.state === 'error' ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-foreground">Couldn&rsquo;t load your attendance</p>
                    <p className="text-sm text-muted-foreground">{load.message}</p>
                    <button type="button" onClick={() => void fetchRecords()} className="btn-primary">
                        <RotateCcw className="size-4" aria-hidden="true" />Try again
                    </button>
                </div>
            ) : (
                <>
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard
                            label="Attendance Rate"
                            value={rate === null ? '—' : `${rate}%`}
                            sub={period}
                            icon={CalendarCheck}
                            iconClassName={rate === null || rate >= 80 ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600'}
                        />
                        <StatCard label="Present" value={counts.present} sub="Days" icon={UserCheck} iconClassName="bg-emerald-500/12 text-emerald-600" />
                        <StatCard label="Absent" value={counts.absent} sub="Days" icon={UserX} iconClassName="bg-red-500/12 text-red-600" />
                        <StatCard label="Late / Excused" value={`${counts.late} / ${counts.excused}`} sub="Days" icon={Clock} iconClassName="bg-amber-500/12 text-amber-600" />
                    </div>

                    <DataTable
                        columns={columns}
                        rows={records}
                        rowKey={r => r.id}
                        loading={load.state === 'loading'}
                        mobileTitleKey="date"
                        emptyState="Your attendance records will appear here once your class teacher takes the register."
                    />
                </>
            )}
        </div>
    );
}
