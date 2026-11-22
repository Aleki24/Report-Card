import React from 'react';
import { View } from 'react-native';
import { makeStyles, useTheme, type Palette } from '@/lib/theme';
import type { AttendanceCounts, AttendanceStatus } from '@shared/attendance';

/** Each status's colour, as on the web: present green, late amber, excused blue, absent red. */
export const statusColor = (colors: Palette, status: AttendanceStatus): string =>
    ({ present: colors.success, late: colors.warning, excused: colors.info, absent: colors.danger })[status];

const ORDER: readonly AttendanceStatus[] = ['present', 'late', 'excused', 'absent'];

/** A class's day as one bar: a segment per status, unmarked left grey. */
export function AttendanceBar({ counts }: { counts: AttendanceCounts }) {
    const { colors } = useTheme();
    const styles = useStyles();
    if (counts.total === 0) return <View style={styles.bar} />;
    return (
        <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {ORDER.map((s) => (counts[s] > 0 ? <View key={s} style={{ flex: counts[s], backgroundColor: statusColor(colors, s) }} /> : null))}
            {counts.unmarked > 0 ? <View style={{ flex: counts.unmarked }} /> : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.mutedBg },
}));
