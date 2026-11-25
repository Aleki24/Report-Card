import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { withQuery } from '@/lib/api';
import { rowCard, fonts, makeStyles, spacing, useTheme } from '@/lib/theme';
import { Badge, DateStepper, EmptyState, ErrorBanner, ListCard, LoadingView, StatGrid, StatTile } from '@/components/ui';
import { AttendanceBar } from './AttendanceBar';
import { addWeekdays, isWeekday, localIsoDate } from '@shared/dates';
import { LOW_ATTENDANCE_RATE, attendanceRate, type AttendanceClassDay, type AttendanceOverviewResponse } from '@shared/attendance';

const taken = (c: AttendanceClassDay) => c.counts.unmarked < c.counts.total;

/**
 * The web's "Whole school": every class on one day, the registers still to
 * take first. Tapping a class opens its register for that day.
 */
export function WholeSchool({ onOpen }: { onOpen: (streamId: string, date: string) => void }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const today = localIsoDate();
    const [date, setDate] = useState(() => (isWeekday(today) ? today : addWeekdays(today, -1)));
    const query = useApiQuery<AttendanceOverviewResponse>(withQuery('/api/school/attendance/overview', { date }), { raw: true });
    const body = query.data?.date === date ? query.data : null;

    const classes = body ? [...body.classes].sort((a, b) => Number(taken(a)) - Number(taken(b)) || a.name.localeCompare(b.name, undefined, { numeric: true })) : [];
    const takenCount = classes.filter(taken).length;
    const totals = body?.totals;
    const rate = totals ? attendanceRate(totals) : null;
    const marked = totals ? totals.total - totals.unmarked : 0;

    return (
        <View>
            <DateStepper value={date} onChange={setDate} max={today} />
            {query.error && !body ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {!body ? (
                query.loading ? <LoadingView /> : null
            ) : (
                <>
                    <StatGrid>
                        <StatTile label="Registers taken" value={`${takenCount} of ${classes.length}`} sub={takenCount < classes.length ? `${classes.length - takenCount} still to take` : undefined} tone={takenCount === classes.length ? colors.success : colors.warning} />
                        <StatTile label="Absent" value={totals?.absent ?? 0} sub={totals?.excused ? `${totals.excused} excused` : undefined} tone={totals?.absent ? colors.danger : undefined} />
                        <StatTile label="Late" value={totals?.late ?? 0} tone={totals?.late ? colors.warning : undefined} />
                        <StatTile label="Attendance" value={rate === null ? '—' : `${rate}%`} sub={marked > 0 ? `of ${marked} marked` : 'nothing marked yet'} tone={rate === null ? undefined : rate < LOW_ATTENDANCE_RATE ? colors.warning : colors.success} />
                    </StatGrid>
                    {classes.length === 0 ? (
                        <EmptyState title="No classes with learners yet" />
                    ) : (
                        <ListCard style={{ marginTop: spacing.md }}>
                            {classes.map((c) => {
                                const isTaken = taken(c);
                                return (
                                    <Pressable
                                        key={c.streamId}
                                        onPress={() => onOpen(c.streamId, date)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${c.name}: ${isTaken ? `${c.rate ?? 0}% present, ${c.counts.absent} absent` : 'register not taken'}`}
                                        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mutedBg }]}
                                    >
                                        <View style={styles.head}>
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
                                                <Text style={styles.sub}>{c.counts.total} learners</Text>
                                            </View>
                                            {isTaken ? (
                                                <Text style={styles.sub}>
                                                    <Text style={[styles.rate, c.rate !== null && c.rate < LOW_ATTENDANCE_RATE && { color: colors.warningText }]}>{c.rate ?? '—'}%</Text>
                                                    {` · ${c.counts.absent} absent${c.counts.unmarked > 0 ? ` · ${c.counts.unmarked} unmarked` : ''}`}
                                                </Text>
                                            ) : (
                                                <Badge label="Not taken" variant="warning" />
                                            )}
                                            <ChevronRight size={16} color={colors.muted} />
                                        </View>
                                        {isTaken ? <AttendanceBar counts={c.counts} /> : null}
                                    </Pressable>
                                );
                            })}
                        </ListCard>
                    )}
                </>
            )}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    row: { padding: spacing.md, gap: spacing.sm, ...rowCard(colors) },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    rate: { fontFamily: fonts.bold, color: colors.foreground },
}));
