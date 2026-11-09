import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { errorMessage, formatCurrency, formatDate, pluralize, toISODate } from '@/lib/format';
import { fonts, spacing, makeStyles } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, DateStepper, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    SectionLabel, StatGrid, StatTile, TextField, ToggleRow,
} from '@/components/ui';
import { DAYBOOK_URL, type DayBook as DayBookData, type DayReviewBody } from '@shared/fee-daybook';
import { schoolTimeOf } from '@shared/dates';

/**
 * The web's Day book: one day's money in, how it came and who recorded it,
 * and the day's sign-off by someone who looked it over (ideally not the
 * person who recorded the money).
 */
export function DayBook() {
    const styles = useStyles();
    const api = useApi();
    const canReview = useCurrentUser().can('fees.manage');
    const today = toISODate();
    const [day, setDay] = useState(today);
    const query = useApiQuery<DayBookData>(withQuery(DAYBOOK_URL, { day }));
    const [note, setNote] = useState('');
    const [ownEntries, setOwnEntries] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const pick = (next: string) => { setDay(next); setNote(''); setOwnEntries(false); setMessage(null); };

    const sign = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const body: DayReviewBody = { day, note: note.trim() || null, ownEntries };
            await api.post(DAYBOOK_URL, body);
            setNote('');
            setMessage({ tone: 'success', text: 'Day marked as reviewed.' });
            query.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not sign the day off') });
        } finally {
            setBusy(false);
        }
    };

    const book = query.data;
    const canSign = canReview && !!book && book.payments.length > 0 && (!book.review || book.changedSinceReview);

    return (
        <View>
            <DateStepper value={day} onChange={pick} max={today} />
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {query.loading && !book ? <LoadingView /> : null}
            {query.error && !book ? <ErrorBanner message={query.error} onRetry={query.reload} /> : null}
            {book ? (
                <>
                    <StatGrid>
                        <StatTile label="Received" value={formatCurrency(book.received.amount)} sub={pluralize(book.received.count, 'payment')} />
                        <StatTile label="Voided" value={formatCurrency(book.voided.amount)} sub={pluralize(book.voided.count, 'payment')} />
                        <StatTile label="Not matched" value={formatCurrency(book.unmatched.amount)} sub={book.unmatched.count > 0 ? `${pluralize(book.unmatched.count, 'payment')} to assign` : 'all matched'} />
                        <StatTile label="Entered late" value={book.recordedLate} sub="entered on a later day" />
                    </StatGrid>

                    <Card>
                        {book.review ? (
                            <Text style={styles.body}>
                                Reviewed by {book.review.reviewedByName ?? 'a former staff member'} on {formatDate(book.review.reviewedAt)}: {formatCurrency(book.review.total)} in {pluralize(book.review.payments, 'payment')} when signed.
                                {book.review.ownEntries ? ' They recorded some of these payments themselves.' : ''}
                                {book.review.note ? ` “${book.review.note}”` : ''}
                            </Text>
                        ) : (
                            <Text style={styles.body}>{book.payments.length > 0 ? 'Not reviewed yet.' : 'Nothing to review: no payments on this day.'}</Text>
                        )}
                        {book.changedSinceReview ? (
                            <Text style={styles.warn}>Changed since: a payment was recorded or voided after the sign-off. It is now {formatCurrency(book.received.amount)} in {pluralize(book.received.count, 'payment')}.</Text>
                        ) : null}
                        {canSign ? (
                            <View style={{ marginTop: spacing.sm }}>
                                <TextField label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Cash KSh 12,000 banked, slip 004512" />
                                {book.viewerRecorded ? (
                                    <ToggleRow
                                        label="I am checking my own entries"
                                        description="You recorded some of these payments. Better: ask someone else to sign this day."
                                        value={ownEntries}
                                        onValueChange={setOwnEntries}
                                    />
                                ) : null}
                                <ButtonRow>
                                    <Button label={book.review ? 'Review again' : 'Mark day as reviewed'} loading={busy} disabled={book.viewerRecorded && !ownEntries} onPress={() => void sign()} />
                                </ButtonRow>
                            </View>
                        ) : null}
                        {!canReview && book.payments.length > 0 && !book.review ? <Text style={styles.muted}>The bursar or the head signs each day off.</Text> : null}
                    </Card>

                    {book.byMethod.length > 0 ? (
                        <>
                            <SectionLabel>By method</SectionLabel>
                            <ListCard>{book.byMethod.map((b) => <ListRow key={b.key} title={b.label} right={<Text style={styles.amount}>{formatCurrency(b.amount)} · {b.count}</Text>} />)}</ListCard>
                            <SectionLabel>By who recorded it</SectionLabel>
                            <ListCard>{book.byRecorder.map((b) => <ListRow key={b.key} title={b.label} right={<Text style={styles.amount}>{formatCurrency(b.amount)} · {b.count}</Text>} />)}</ListCard>
                        </>
                    ) : null}

                    <SectionLabel>Payments</SectionLabel>
                    {book.payments.length === 0 ? <EmptyState title="No payments on this day" /> : (
                        <ListCard>
                            {book.payments.map((p) => (
                                <ListRow
                                    key={p.id}
                                    title={`${formatCurrency(p.amount)} · ${p.learner ?? 'Not matched'}`}
                                    subtitle={[schoolTimeOf(p.paidAt).slice(0, 5), p.code ? `${p.method} ${p.code}` : p.method, p.receiptNumber, p.automatic ? 'came in on its own' : p.recordedByName].filter(Boolean).join(' · ')}
                                    meta={p.voided ? `Voided${p.voidedByName ? ` by ${p.voidedByName}` : ''}` : p.recordedLateOn ? `Entered ${formatDate(p.recordedLateOn, { day: 'numeric', month: 'short' })}` : null}
                                    right={p.voided ? <Badge label="Voided" variant="danger" /> : p.recordedLateOn ? <Badge label="Late" variant="warning" /> : null}
                                />
                            ))}
                        </ListCard>
                    )}
                </>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    body: { fontFamily: fonts.regular, fontSize: 14, color: colors.foreground },
    warn: { fontFamily: fonts.semibold, fontSize: 13, color: colors.warning, marginTop: spacing.sm },
    muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: spacing.sm },
    amount: { fontFamily: fonts.semibold, fontSize: 13, color: colors.foreground },
}));
