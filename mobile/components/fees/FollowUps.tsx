import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { errorMessage, formatCurrency, formatDate, toISODate } from '@/lib/format';
import { fonts, spacing, makeStyles } from '@/lib/theme';
import { Badge, Button, ButtonRow, ChipSelect, EmptyState, ErrorBanner, ListRow, LoadingView, Notice, TextField } from '@/components/ui';
import { FOLLOW_UP_NOTES, FOLLOWUPS_URL, PROMISE_COPY, type FeeFollowUp, type FollowUpBody, type FollowUpKind } from '@shared/fee-followups';

const BADGE = { KEPT: 'success', DUE: 'info', BROKEN: 'danger' } as const;

/**
 * Follow-ups on what a family owes, as in the web's fee account: each call
 * noted, and each promise to pay written down with its amount and date.
 * Skulbase marks a promise kept or broken from the payments.
 */
export function FollowUps({ studentId }: { studentId: string }) {
    const styles = useStyles();
    const api = useApi();
    const { can } = useCurrentUser();
    const canWrite = can('fees.collect');
    const canRemove = can('fees.manage');
    const query = useApiQuery<FeeFollowUp[]>(withQuery(FOLLOWUPS_URL, { student_id: studentId }));
    const [adding, setAdding] = useState(false);
    const [kind, setKind] = useState<FollowUpKind>('NOTE');
    const [note, setNote] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const today = toISODate();
    const problem = kind === 'NOTE'
        ? (note.trim().length < 3 ? 'Say what was said.' : null)
        : !(Number(amount) > 0) ? 'Enter the amount promised.' : !dueDate ? 'Pick the date they will pay by.' : dueDate < today ? 'That date has passed.' : null;

    const save = async () => {
        if (problem) return;
        setBusy('save');
        setMessage(null);
        try {
            const body: FollowUpBody = kind === 'NOTE'
                ? { kind, studentId, note: note.trim() }
                : { kind, studentId, note: note.trim(), amount: Number(amount), dueDate };
            await api.post(FOLLOWUPS_URL, body);
            setAdding(false);
            setNote('');
            setAmount('');
            setDueDate('');
            setMessage({ tone: 'success', text: kind === 'NOTE' ? 'Note saved.' : 'Promise written down.' });
            query.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not save') });
        } finally {
            setBusy(null);
        }
    };

    const remove = async (item: FeeFollowUp) => {
        setBusy(item.id);
        try {
            await api.del(`${FOLLOWUPS_URL}/${item.id}`);
            query.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not remove it') });
        } finally {
            setBusy(null);
        }
    };

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {canWrite && !adding ? (
                <ButtonRow align="start">
                    <Button size="sm" variant="secondary" label="Add a follow-up" onPress={() => setAdding(true)} />
                </ButtonRow>
            ) : null}
            {adding ? (
                <View style={styles.form}>
                    <ChipSelect options={[{ value: 'NOTE' as const, label: 'Note of a contact' }, { value: 'PROMISE' as const, label: 'Promise to pay' }]} value={kind} onChange={setKind} />
                    {kind === 'PROMISE' ? (
                        <>
                            <TextField label="Amount (KES)" value={amount} keyboardType="decimal-pad" onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))} />
                            <DateField label="Will pay by" value={dueDate} onChange={setDueDate} min={today} />
                        </>
                    ) : (
                        <ChipSelect label="Quick note" wrap options={FOLLOW_UP_NOTES.map((n) => ({ value: n, label: n }))} value={(FOLLOW_UP_NOTES as readonly string[]).includes(note) ? note : null} onChange={setNote} />
                    )}
                    <TextField label={kind === 'NOTE' ? 'What was said' : 'Note (optional)'} value={note} onChangeText={setNote} multiline placeholder={kind === 'NOTE' ? 'Spoke to the mother; she will pay after harvest.' : 'Agreed by phone with the father.'} />
                    <ButtonRow>
                        <Button variant="secondary" label="Cancel" onPress={() => setAdding(false)} />
                        <Button label="Save" loading={busy === 'save'} disabled={!!problem} onPress={() => void save()} />
                    </ButtonRow>
                </View>
            ) : null}
            {query.loading && !query.data ? <LoadingView /> : null}
            {query.error && !query.data ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {query.data && query.data.length === 0 && !adding ? (
                <EmptyState title="No follow-ups yet" description="Note each call, and write down promises to pay: Skulbase checks them against the payments." />
            ) : null}
            {(query.data ?? []).map((item) => (
                <ListRow
                    key={item.id}
                    title={item.promise ? `${PROMISE_COPY[item.promise.state].label}: ${formatCurrency(item.promise.amount)} by ${formatDate(item.promise.dueDate, { day: 'numeric', month: 'short' })}` : item.note}
                    subtitle={[item.promise && item.note ? item.note : null, item.promise && item.promise.state !== 'KEPT' && item.promise.paidByDue > 0 ? `${formatCurrency(item.promise.paidByDue)} paid so far` : null].filter(Boolean).join(' · ') || null}
                    meta={`${formatDate(item.createdAt)}${item.createdByName ? ` · ${item.createdByName}` : ''}`}
                    right={
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            {item.promise ? <Badge label={PROMISE_COPY[item.promise.state].label} variant={BADGE[item.promise.state]} /> : null}
                            {canRemove ? <Button size="sm" variant="ghost" label="Remove" loading={busy === item.id} onPress={() => void remove(item)} /> : null}
                        </View>
                    }
                />
            ))}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    form: { gap: spacing.sm, marginBottom: spacing.md },
    foot: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: spacing.sm },
}));
