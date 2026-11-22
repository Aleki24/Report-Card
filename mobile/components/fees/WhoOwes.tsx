import React, { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Phone } from 'lucide-react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useDownload } from '@/lib/useDownload';
import { useGradeStreams, useTerms } from '@/lib/useSchoolData';
import { useCurrentUser } from '@/lib/UserContext';
import { askConfirm } from '@/lib/confirm';
import { errorMessage, formatCurrency, formatDate } from '@/lib/format';
import { fonts, makeStyles, spacing, useTheme } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, ChipSelect, EmptyState, ErrorBanner, ListCard, LoadingView, Notice, ScrollTabs, StatGrid, StatTile, TextField, type BadgeVariant,
} from '@/components/ui';
import { FollowUps } from './FollowUps';
import { daysSince, type Defaulter, type DefaultersResponse } from '@shared/fee-reports';
import { PROMISE_COPY, type PromiseState } from '@shared/fee-followups';
import type { FeeReminderSummary } from '@shared/fee-account';
import { formatIsoDate, schoolDayOf } from '@shared/dates';

type Focus = 'all' | 'nothing' | 'broken' | 'due';
const FOCUS: readonly { value: Focus; label: string; test: (d: Defaulter) => boolean }[] = [
    { value: 'all', label: 'Everyone owing', test: () => true },
    { value: 'nothing', label: 'Paid nothing this term', test: (d) => d.paidThisTerm === 0 },
    { value: 'broken', label: 'Promise broken', test: (d) => d.followUp?.promise?.state === 'BROKEN' },
    { value: 'due', label: 'Promised', test: (d) => d.followUp?.promise?.state === 'DUE' },
];
const PROMISE_BADGE: Record<PromiseState, BadgeVariant> = { KEPT: 'success', DUE: 'info', BROKEN: 'danger' };

function contactedAgo(iso: string): string {
    const days = daysSince(schoolDayOf(iso));
    return days === 0 ? 'Contacted today' : days === 1 ? 'Contacted yesterday' : `Contacted ${days} days ago`;
}

/**
 * The web's "Who owes": every learner owing, arrears included, most owed
 * first, with how long it has been due, when they last paid, the family's
 * latest promise and the parent to call. Narrows to the families to chase
 * first; exports to Excel; texts reminders.
 */
export function WhoOwes({ initialFocus }: { initialFocus?: Exclude<Focus, 'all' | 'due'> }) {
    const { colors } = useTheme();
    const styles = useStyles();
    const api = useApi();
    const download = useDownload();
    const { can } = useCurrentUser();
    const { streams } = useGradeStreams();
    const { activeTermId } = useTerms();
    const [streamId, setStreamId] = useState('');
    const [minBalance, setMinBalance] = useState('1');
    const [focus, setFocus] = useState<Focus>(initialFocus ?? 'all');
    const [open, setOpen] = useState<string | null>(null);
    const [busy, setBusy] = useState<'excel' | 'remind' | null>(null);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
    const min = Math.max(1, Number(minBalance) || 1);
    const params = { min_balance: String(min), grade_stream_id: streamId || undefined };
    const query = useApiQuery<DefaultersResponse>(withQuery('/api/school/fees/defaulters', params), { raw: true });

    const all = useMemo(() => query.data?.data ?? [], [query.data]);
    const counts = useMemo(() => Object.fromEntries(FOCUS.map((f) => [f.value, all.filter(f.test).length])) as Record<Focus, number>, [all]);
    const rows = useMemo(() => all.filter(FOCUS.find((f) => f.value === focus)?.test ?? (() => true)), [all, focus]);
    const noPhone = all.filter((r) => !r.guardianPhone).length;

    const exportXlsx = async () => {
        setBusy('excel');
        try {
            await download(withQuery('/api/school/fees/defaulters', { ...params, format: 'xlsx' }), 'Who_owes.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Export failed') });
        } finally {
            setBusy(null);
        }
    };

    const remind = async () => {
        if (!activeTermId) return;
        const body = (dryRun: boolean) => ({ term_id: activeTermId, min_balance: min, dry_run: dryRun, ...(streamId ? { grade_stream_id: streamId } : {}) });
        setBusy('remind');
        setMessage(null);
        try {
            const preview = await api.post<FeeReminderSummary>('/api/finance/reminders', body(true));
            if (preview.recipients === 0) {
                setMessage({ tone: 'info', text: preview.without_phone ? `Nobody to text: ${preview.without_phone} owing learners have no parent phone.` : 'Nobody owing has a parent to text.' });
                return;
            }
            const ok = await askConfirm(
                'Text fee reminders?',
                `${preview.recipients} ${preview.recipients === 1 ? 'SMS' : 'SMSes'} to the parents of ${preview.learners} ${preview.learners === 1 ? 'learner' : 'learners'}, each with their balance.${preview.without_phone ? ` ${preview.without_phone} more owe but have no parent phone.` : ''}`,
                'Send reminders',
            );
            if (!ok) return;
            // Awaited here, so the button stays busy until the texts are sent.
            const sent = await api.post<FeeReminderSummary>('/api/finance/reminders', body(false));
            setMessage({ tone: sent.failed ? 'danger' : 'success', text: `Reminders sent: ${sent.sent}${sent.failed ? `, ${sent.failed} failed` : ''}.` });
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not send reminders') });
        } finally {
            setBusy(null);
        }
    };

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <ChipSelect label="Class" options={[{ value: '', label: 'All classes' }, ...streams.map((s) => ({ value: s.id, label: s.full_name }))]} value={streamId} onChange={setStreamId} />
            <TextField label="Owing over (KSh)" value={minBalance} onChangeText={(t) => setMinBalance(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
            <ButtonRow>
                <Button variant="secondary" label="Excel" onPress={exportXlsx} loading={busy === 'excel'} />
                {can('fees.manage') && activeTermId ? <Button label="Text reminders" onPress={remind} loading={busy === 'remind'} disabled={rows.length === 0} /> : null}
            </ButtonRow>

            {query.error && !query.data ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {!query.data ? (
                query.loading ? <LoadingView /> : null
            ) : (
                <>
                    <StatGrid>
                        <StatTile label="Learners owing" value={all.length} tone={all.length > 0 ? colors.warning : colors.success} />
                        <StatTile label="Total owed" value={formatCurrency(query.data.totalOwed)} sub="arrears included" tone={all.length > 0 ? colors.warning : colors.success} />
                        <StatTile label="Paid nothing" value={counts.nothing} sub="billed this term" tone={counts.nothing > 0 ? colors.danger : colors.success} />
                        <StatTile label="No parent phone" value={noPhone} tone={noPhone > 0 ? colors.danger : colors.success} />
                    </StatGrid>
                    <ScrollTabs tabs={FOCUS.map((f) => ({ value: f.value, label: `${f.label} · ${counts[f.value]}` }))} value={focus} onChange={setFocus} />
                    {rows.length === 0 ? (
                        <EmptyState title={focus === 'all' ? `Nobody owes over this amount${streamId ? ' in this class' : ''}` : 'Nobody here right now'} />
                    ) : (
                        <ListCard>
                            {rows.map((r) => {
                                const days = daysSince(r.oldestDue);
                                const due = r.oldestDue ? (days > 0 ? `${days} days overdue` : 'Not yet due') : 'No due date';
                                const promise = r.followUp?.promise;
                                return (
                                    <View key={r.studentId} style={styles.item}>
                                        <Pressable
                                            onPress={() => setOpen(open === r.studentId ? null : r.studentId)}
                                            accessibilityRole="button"
                                            accessibilityState={{ expanded: open === r.studentId }}
                                            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.mutedBg }]}
                                        >
                                            <View style={styles.head}>
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                    <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                                                    <Text style={styles.sub} numberOfLines={1}>{[r.admissionNumber, r.className].filter(Boolean).join(' · ')}</Text>
                                                </View>
                                                <Text style={[styles.owed, { color: colors.warningText }]}>{formatCurrency(r.owed)}</Text>
                                            </View>
                                            <View style={styles.badges}>
                                                <Badge label={`${due}${r.termsOwing > 1 ? ` · ${r.termsOwing} terms` : ''}`} variant={days > 60 ? 'danger' : days > 0 ? 'warning' : 'default'} />
                                                {r.paidThisTerm === 0 ? <Badge label="Nothing this term" variant="danger" /> : null}
                                                {promise ? (
                                                    <Badge label={`${PROMISE_COPY[promise.state].label}: ${formatCurrency(promise.amount)} by ${formatIsoDate(promise.dueDate, { day: 'numeric', month: 'short' })}`} variant={PROMISE_BADGE[promise.state]} />
                                                ) : null}
                                            </View>
                                            <Text style={styles.sub}>
                                                Last paid {r.lastPaymentAt ? formatDate(r.lastPaymentAt) : 'never'}
                                                {!promise && r.followUp?.lastContactAt ? ` · ${contactedAgo(r.followUp.lastContactAt)}` : ''}
                                            </Text>
                                        </Pressable>
                                        {r.guardianPhone ? (
                                            <Pressable onPress={() => void Linking.openURL(`tel:${r.guardianPhone}`)} accessibilityRole="link" accessibilityLabel={`Call ${r.guardianName ?? 'parent'} ${r.guardianPhone}`} style={styles.call}>
                                                <Phone size={14} color={colors.primary} />
                                                <Text style={[styles.sub, { color: colors.primary, fontFamily: fonts.semibold }]} numberOfLines={1}>{r.guardianName ? `${r.guardianName} · ` : ''}{r.guardianPhone}</Text>
                                            </Pressable>
                                        ) : (
                                            <Text style={[styles.sub, styles.call, { color: colors.danger }]}>No parent phone</Text>
                                        )}
                                        {open === r.studentId ? <View style={styles.follow}><FollowUps studentId={r.studentId} /></View> : null}
                                    </View>
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
    item: { borderBottomWidth: 1, borderBottomColor: colors.border },
    row: { padding: spacing.md, paddingBottom: spacing.xs, gap: 6 },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
    owed: { fontSize: 14, fontFamily: fonts.bold },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    call: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingBottom: spacing.md, minHeight: 32 },
    follow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
}));
