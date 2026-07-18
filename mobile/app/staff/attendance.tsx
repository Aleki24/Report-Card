import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorBanner, LoadingView, Screen, ScreenHeader } from '@/components/ui';
import { colors, radius, spacing } from '@/lib/theme';
import type { AttendanceStatus, ClassAttendanceRow, GradeStream } from '@/lib/types';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; variant: 'success' | 'danger' | 'warning' | 'info' }[] = [
    { value: 'present', label: 'P', variant: 'success' },
    { value: 'absent', label: 'A', variant: 'danger' },
    { value: 'late', label: 'L', variant: 'warning' },
    { value: 'excused', label: 'E', variant: 'info' },
];

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

export default function AttendanceScreen() {
    const api = useApi();
    const [streams, setStreams] = useState<GradeStream[]>([]);
    const [streamId, setStreamId] = useState<string | null>(null);
    const [date, setDate] = useState(todayISO());
    const [rows, setRows] = useState<ClassAttendanceRow[]>([]);
    const [pending, setPending] = useState<Record<string, AttendanceStatus>>({});
    const [loading, setLoading] = useState(true);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api
            .get<{ data: GradeStream[] }>('/api/school/data?type=grade_streams')
            .then((res) => {
                const list = res.data ?? [];
                setStreams(list);
                if (list.length > 0) setStreamId(list[0].id);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load classes'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadRoster = useCallback(() => {
        if (!streamId) return;
        setRosterLoading(true);
        setPending({});
        api
            .get<{ data: ClassAttendanceRow[] }>(`/api/school/attendance?stream_id=${streamId}&date=${date}`)
            .then((res) => setRows(res.data ?? []))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load attendance'))
            .finally(() => setRosterLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamId, date]);

    useEffect(() => {
        loadRoster();
    }, [loadRoster]);

    const dirtyCount = Object.keys(pending).length;

    const handleSave = async () => {
        if (!streamId || dirtyCount === 0) return;
        setSaving(true);
        try {
            const records = Object.entries(pending).map(([student_id, status]) => ({ student_id, status }));
            await api.post('/api/school/attendance', { date, stream_id: streamId, records });
            loadRoster();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const shiftDate = (deltaDays: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() + deltaDays);
        setDate(d.toISOString().split('T')[0]);
    };

    if (loading) return <LoadingView />;

    return (
        <Screen>
            <ScreenHeader title="Attendance" description="Mark or review daily attendance for a class." />
            {error ? <ErrorBanner message={error} onRetry={loadRoster} /> : null}

            {streams.length === 0 ? (
                <EmptyState title="No classes assigned" description="You don't have any classes assigned yet." />
            ) : (
                <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                        {streams.map((s) => (
                            <Pressable
                                key={s.id}
                                onPress={() => setStreamId(s.id)}
                                style={[styles.chip, streamId === s.id && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, streamId === s.id && styles.chipTextActive]}>{s.full_name}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <View style={styles.dateRow}>
                        <Pressable onPress={() => shiftDate(-1)} style={styles.dateArrow}>
                            <Text style={styles.dateArrowText}>‹</Text>
                        </Pressable>
                        <Text style={styles.dateText}>{new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                        <Pressable onPress={() => shiftDate(1)} style={styles.dateArrow}>
                            <Text style={styles.dateArrowText}>›</Text>
                        </Pressable>
                    </View>

                    {rosterLoading ? (
                        <LoadingView />
                    ) : rows.length === 0 ? (
                        <EmptyState title="No students in this class" />
                    ) : (
                        <Card style={styles.listCard}>
                            {rows.map((r) => {
                                const current = pending[r.id] ?? r.status;
                                return (
                                    <View key={r.id} style={styles.row}>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={styles.rowTitle}>{r.name}</Text>
                                            <Text style={styles.rowSub}>{r.admission_number}</Text>
                                        </View>
                                        <View style={styles.statusRow}>
                                            {STATUS_OPTIONS.map((opt) => (
                                                <Pressable
                                                    key={opt.value}
                                                    onPress={() => setPending((prev) => ({ ...prev, [r.id]: opt.value }))}
                                                    style={[styles.statusChip, current === opt.value && { backgroundColor: colors[opt.variant] }]}
                                                >
                                                    <Text style={[styles.statusChipText, current === opt.value && { color: colors.white }]}>{opt.label}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>
                                );
                            })}
                        </Card>
                    )}

                    {dirtyCount > 0 ? (
                        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
                            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : `Save ${dirtyCount} change${dirtyCount === 1 ? '' : 's'}`}</Text>
                        </Pressable>
                    ) : null}
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm, backgroundColor: colors.card },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    chipTextActive: { color: colors.white },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.md },
    dateArrow: { padding: spacing.sm },
    dateArrowText: { fontSize: 22, color: colors.primary, fontWeight: '700' },
    dateText: { fontSize: 14, fontWeight: '700', color: colors.foreground, minWidth: 140, textAlign: 'center' },
    listCard: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
    rowTitle: { fontSize: 13, fontWeight: '700', color: colors.foreground },
    rowSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
    statusRow: { flexDirection: 'row', gap: 6 },
    statusChip: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    statusChipText: { fontSize: 12, fontWeight: '800', color: colors.muted },
    saveButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg },
    saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
