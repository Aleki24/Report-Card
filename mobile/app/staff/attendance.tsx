import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useGradeStreams } from '@/lib/useSchoolData';
import { errorMessage, pluralize, toISODate } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Button, ButtonRow, ChipSelect, DateStepper, EmptyState, ErrorBanner, ListCard, LoadingView, Notice, Screen, ScreenHeader, StatGrid, StatTile,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { AttendanceNotifyResult, AttendanceStatus, ClassAttendanceRow } from '@/lib/types';
import { confirmAlert } from '@/lib/confirm';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
    { value: 'present', label: 'P', color: colors.success },
    { value: 'absent', label: 'A', color: colors.danger },
    { value: 'late', label: 'L', color: colors.warning },
    { value: 'excused', label: 'E', color: colors.info },
];

export default function AttendanceScreen() {
    return (
        <RequireScreen screen="attendance">
            <AttendanceContent />
        </RequireScreen>
    );
}

function AttendanceContent() {
    const api = useApi();
    const { streams, loading: streamsLoading, error: streamsError } = useGradeStreams();
    const [streamId, setStreamId] = useState<string | null>(null);
    const [date, setDate] = useState(toISODate());
    const [rows, setRows] = useState<ClassAttendanceRow[]>([]);
    const [pending, setPending] = useState<Record<string, AttendanceStatus>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notifying, setNotifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

    const effectiveStreamId = streamId ?? streams[0]?.id ?? null;

    const loadRoster = useCallback(async () => {
        if (!effectiveStreamId) return;
        setLoading(true);
        setError(null);
        setPending({});
        try {
            const res = await api.get<{ data: ClassAttendanceRow[] }>(withQuery('/api/school/attendance', { stream_id: effectiveStreamId, date }));
            setRows(res.data ?? []);
        } catch (err) {
            setRows([]);
            setError(errorMessage(err, 'Failed to load attendance'));
        } finally {
            setLoading(false);
        }
    }, [api, effectiveStreamId, date]);

    useEffect(() => {
        void loadRoster();
    }, [loadRoster]);

    const statusOf = (r: ClassAttendanceRow): AttendanceStatus | null => pending[r.id] ?? r.status;
    const counts = useMemo(() => {
        const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
        for (const r of rows) {
            const s = pending[r.id] ?? r.status;
            if (s) c[s] += 1;
            else c.unmarked += 1;
        }
        return c;
    }, [rows, pending]);
    const changed = Object.keys(pending).filter((id) => rows.find((r) => r.id === id)?.status !== pending[id]).length;
    const unsaved = changed > 0 || counts.unmarked > 0;

    const markAllPresent = () => setPending(Object.fromEntries(rows.map((r) => [r.id, 'present' as const])));

    const save = async () => {
        if (!effectiveStreamId || rows.length === 0) return;
        setSaving(true);
        setMessage(null);
        try {
            // Like the web, the whole register is saved; anyone unmarked counts as present.
            const records = rows.map((r) => ({ student_id: r.id, status: statusOf(r) ?? 'present', notes: r.notes }));
            const res = await api.post<{ count?: number }>('/api/school/attendance', { date, stream_id: effectiveStreamId, records });
            setMessage({ tone: 'success', text: `Attendance saved for ${pluralize(res.count ?? records.length, 'student')}.` });
            await loadRoster();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to save attendance') });
        } finally {
            setSaving(false);
        }
    };

    const notify = () =>
        confirmAlert('Text guardians of absent learners?', 'Each guardian with a phone number gets one SMS for this date. Already-notified guardians are skipped.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Send',
                onPress: async () => {
                    if (!effectiveStreamId) return;
                    setNotifying(true);
                    try {
                        const r = await api.post<AttendanceNotifyResult>('/api/school/attendance/notify', { date, stream_id: effectiveStreamId });
                        const parts = [
                            r.sent > 0 ? `${r.sent} sent` : null,
                            r.alreadyNotified > 0 ? `${r.alreadyNotified} already notified` : null,
                            r.skipped > 0 ? `${r.skipped} skipped (no phone)` : null,
                            r.failed > 0 ? `${r.failed} failed` : null,
                        ].filter(Boolean);
                        setMessage(parts.length === 0 ? { tone: 'info', text: 'No absent students to notify for this date.' } : { tone: r.failed > 0 ? 'danger' : 'success', text: `Guardian SMS: ${parts.join(', ')}` });
                    } catch (err) {
                        setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to notify guardians') });
                    } finally {
                        setNotifying(false);
                    }
                },
            },
        ]);

    if (streamsLoading) return <LoadingView />;

    return (
        <Screen
            footer={
                rows.length > 0 ? (
                    <Button block label={saving ? 'Saving…' : unsaved ? `Save register${changed ? ` (${changed} changed)` : ''}` : 'Register saved ✓'} onPress={save} loading={saving} disabled={!unsaved} />
                ) : undefined
            }
        >
            <ScreenHeader title="Attendance" description="Take or review the daily register for a class." />
            {streamsError ? <ErrorBanner message={streamsError} /> : null}

            {streams.length === 0 ? (
                <EmptyState title="No classes assigned" description="Registers are kept by admins and each class's own teacher." />
            ) : (
                <>
                    <ChipSelect options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={effectiveStreamId} onChange={setStreamId} />
                    <DateStepper value={date} onChange={setDate} max={toISODate()} />
                    {error ? <ErrorBanner message={error} onRetry={loadRoster} /> : null}
                    {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

                    {rows.length > 0 ? (
                        <>
                            <StatGrid>
                                <StatTile label="Present" value={counts.present} tone={colors.success} />
                                <StatTile label="Absent" value={counts.absent} tone={counts.absent ? colors.danger : undefined} />
                                <StatTile label="Late / excused" value={`${counts.late} / ${counts.excused}`} />
                                <StatTile label="Not marked" value={counts.unmarked} />
                            </StatGrid>
                            <ButtonRow>
                                <Button size="sm" variant="secondary" label="Mark all present" onPress={markAllPresent} />
                                {changed > 0 ? <Button size="sm" variant="ghost" label="Undo changes" onPress={() => setPending({})} /> : null}
                                <Button size="sm" variant="secondary" label="SMS absentees' guardians" onPress={notify} loading={notifying} disabled={counts.absent === 0 || unsaved} />
                            </ButtonRow>
                        </>
                    ) : null}

                    <View style={{ marginTop: spacing.md }}>
                        {loading ? (
                            <LoadingView />
                        ) : rows.length === 0 ? (
                            <EmptyState title="No students in this class" />
                        ) : (
                            <ListCard>
                                {rows.map((r) => {
                                    const current = statusOf(r);
                                    return (
                                        <View key={r.id} style={styles.row}>
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={styles.rowTitle} numberOfLines={1}>{r.name}</Text>
                                                <Text style={styles.rowSub}>{r.admission_number}</Text>
                                            </View>
                                            <View style={styles.statusRow}>
                                                {STATUS_OPTIONS.map((opt) => {
                                                    const active = current === opt.value;
                                                    return (
                                                        <Pressable
                                                            key={opt.value}
                                                            onPress={() => setPending((prev) => ({ ...prev, [r.id]: opt.value }))}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`${r.name} ${opt.value}`}
                                                            accessibilityState={{ selected: active }}
                                                            style={[styles.statusChip, active && { backgroundColor: opt.color, borderColor: opt.color }]}
                                                        >
                                                            <Text style={[styles.statusChipText, active && { color: colors.white }]}>{opt.label}</Text>
                                                        </Pressable>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    );
                                })}
                            </ListCard>
                        )}
                    </View>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.sm },
    rowTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
    rowSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
    statusRow: { flexDirection: 'row', gap: 6 },
    statusChip: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    statusChipText: { fontSize: 12, fontWeight: '800', color: colors.muted },
});
