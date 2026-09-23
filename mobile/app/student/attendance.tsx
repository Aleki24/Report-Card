import React, { useMemo, useState } from 'react';
import { withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { formatDate, toISODate } from '@/lib/format';
import { colors } from '@/lib/theme';
import { Badge, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Screen, ScreenHeader, SectionLabel, StatGrid, StatTile } from '@/components/ui';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/types';

const STATUS_META: Record<AttendanceStatus, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' }> = {
    present: { label: 'Present', variant: 'success' },
    absent: { label: 'Absent', variant: 'danger' },
    late: { label: 'Late', variant: 'warning' },
    excused: { label: 'Excused', variant: 'info' },
};

/** The last six months as YYYY-MM, newest first — the web's month filter. */
function recentMonths(): { value: string; label: string }[] {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return { value: toISODate(d).slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) };
    });
}

function monthRange(month: string): { from: string | null; to: string | null } {
    if (!month) return { from: null, to: null };
    const [y, m] = month.split('-').map(Number);
    return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
}

export default function AttendanceScreen() {
    const [month, setMonth] = useState('');
    const { data, loading, error, refresh, refreshing } = useApiQuery<AttendanceRecord[]>(withQuery('/api/school/student/attendance', monthRange(month)));
    const records = data ?? [];
    const months = useMemo(recentMonths, []);

    const stats = useMemo(() => {
        const count = (s: AttendanceStatus) => records.filter((r) => r.status === s).length;
        const present = count('present');
        return { present, absent: count('absent'), late: count('late'), excused: count('excused'), rate: records.length > 0 ? Math.round((present / records.length) * 1000) / 10 : null };
    }, [records]);

    return (
        <Screen onRefresh={refresh} refreshing={refreshing}>
            <ScreenHeader title="Attendance" description="Your daily attendance history." />
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            <ChipSelect options={[{ value: '', label: 'All time' }, ...months]} value={month} onChange={setMonth} />

            <StatGrid>
                <StatTile label="Attendance rate" value={stats.rate != null ? `${stats.rate}%` : '—'} tone={stats.rate != null && stats.rate < 80 ? colors.danger : colors.success} />
                <StatTile label="Present" value={stats.present} />
                <StatTile label="Absent" value={stats.absent} tone={stats.absent > 0 ? colors.danger : undefined} />
                <StatTile label="Late / excused" value={`${stats.late} / ${stats.excused}`} />
            </StatGrid>

            <SectionLabel>Days</SectionLabel>
            {loading ? (
                <LoadingView />
            ) : records.length === 0 ? (
                <EmptyState title="No attendance records" description="Your attendance history will appear here." />
            ) : (
                <ListCard>
                    {records.map((r) => (
                        <ListRow
                            key={r.id}
                            title={formatDate(r.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            subtitle={r.notes}
                            right={<Badge label={STATUS_META[r.status]?.label ?? r.status} variant={STATUS_META[r.status]?.variant ?? 'info'} />}
                        />
                    ))}
                </ListCard>
            )}
        </Screen>
    );
}
