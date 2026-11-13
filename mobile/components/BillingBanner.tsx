import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { CalendarClock, ChevronDown, Lock } from 'lucide-react-native';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { formatDate } from '@/lib/format';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/lib/theme';
import { formatKes } from '@shared/pricing';
import { BILLING_URL, hasInstructions, type SchoolBilling } from '@shared/school-billing';

/**
 * The web's billing notice, under every staff screen's title: for whoever
 * manages the school, the term's unpaid Skulbase invoice with where to pay
 * (tap to open); for all staff, a notice once the school is read-only.
 */
export function BillingBanner() {
    const { role, can } = useCurrentUser();
    const staff = !!role && role !== 'STUDENT' && role !== 'PARENT' && role !== 'PENDING';
    const query = useApiQuery<SchoolBilling>(staff ? BILLING_URL : null);
    const [open, setOpen] = useState(false);
    const styles = useStyles();
    const { colors } = useTheme();
    if (!staff || !query.data) return null;

    const { state, instructions, schoolName } = query.data;
    const manager = can('school.manage');
    const locked = state.kind === 'locked';
    if (!locked && !(manager && (state.kind === 'due' || state.kind === 'overdue'))) return null;

    const invoice = state.invoice;
    const bad = locked || state.kind === 'overdue';
    const tone = bad ? { bg: colors.dangerBg, border: colors.dangerBorder, fg: colors.danger } : { bg: colors.warningBg, border: colors.warningBorder, fg: colors.warningText };
    const Icon = locked ? Lock : CalendarClock;
    const title = locked ? 'Read-only: the Skulbase subscription is unpaid' : `${formatKes(invoice.amount)} due for ${invoice.label}`;
    const detail = !manager
        ? 'Ask your administrator to pay it.'
        : locked ? `${formatKes(invoice.amount)} for ${invoice.label}` : `Read-only from ${formatDate(state.lockOn, { day: 'numeric', month: 'short' })} if unpaid`;

    return (
        <View style={[styles.box, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Pressable
                onPress={() => manager && setOpen((o) => !o)}
                disabled={!manager}
                accessibilityRole={manager ? 'button' : 'text'}
                accessibilityState={manager ? { expanded: open } : undefined}
                style={styles.head}
            >
                <Icon size={18} color={tone.fg} />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.title, { color: tone.fg }]}>{title}</Text>
                    <Text style={styles.detail}>{detail}</Text>
                </View>
                {manager ? <ChevronDown size={18} color={tone.fg} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} /> : null}
            </Pressable>
            {open && manager ? (
                <View style={styles.pay}>
                    {instructions && hasInstructions(instructions) ? (
                        <>
                            {instructions.paybill ? <Row label="Paybill" value={instructions.paybill} /> : null}
                            {instructions.paybill ? <Row label="Account" value={instructions.account || schoolName} /> : null}
                            {instructions.till ? <Row label="Till" value={instructions.till} /> : null}
                            <Row label="Amount" value={formatKes(invoice.amount)} />
                            {instructions.bank ? <Row label="Bank" value={instructions.bank} /> : null}
                            {instructions.phone ? (
                                <Pressable onPress={() => void Linking.openURL(`tel:${instructions.phone}`)} accessibilityRole="link">
                                    <Row label="Questions" value={instructions.phone} />
                                </Pressable>
                            ) : null}
                        </>
                    ) : (
                        <Text style={styles.detail}>Payment details coming soon.</Text>
                    )}
                </View>
            ) : null}
        </View>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    const styles = useStyles();
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} selectable>{value}</Text>
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    box: { borderWidth: 1, borderRadius: radius.lg, marginTop: spacing.sm, overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
    title: { fontSize: 13, fontFamily: fonts.bold },
    detail: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    pay: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card, padding: spacing.sm, gap: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
    rowLabel: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    rowValue: { flexShrink: 1, textAlign: 'right', fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
}));
