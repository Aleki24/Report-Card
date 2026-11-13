import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, formatDate } from '@/lib/format';
import { fonts, makeStyles, spacing } from '@/lib/theme';
import { Badge, Button, Card, ErrorBanner, InfoRow, ListCard, ListRow, LoadingView, Notice, SectionLabel } from '@/components/ui';
import { YEAR_DISCOUNT, cyclePrice, formatKes } from '@shared/pricing';
import { BILLING_URL, STATE_COPY, hasInstructions, type SchoolBilling, type SchoolInvoice } from '@shared/school-billing';

const BADGE = { good: 'success', warn: 'warning', bad: 'danger', muted: 'default' } as const;
const day = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });

/** When it is due, or when it was paid, in a line. */
function invoiceLine(i: SchoolInvoice): string {
    if (i.status === 'PAID') return `Paid${i.paidAt ? ` ${day(i.paidAt.slice(0, 10))}` : ''}${i.paymentRef ? ` · ${i.paymentRef}` : ''}`;
    if (i.status === 'FREE') return 'Free';
    if (i.status === 'VOID') return 'Cancelled';
    return `Due ${day(i.dueDate)}`;
}

/** The web's Settings → Subscription: this term's Skulbase invoice, where to pay, and past invoices. */
export function Subscription() {
    const styles = useStyles();
    const api = useApi();
    const query = useApiQuery<SchoolBilling>(BILLING_URL);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    if (query.loading && !query.data) return <LoadingView />;
    if (!query.data) return <ErrorBanner message={query.error ?? 'Could not load the subscription'} onRetry={query.reload} />;

    const { state, invoices, instructions, schoolName } = query.data;
    const current = state.kind === 'none' ? null : state.invoice;
    const unpaid = current?.status === 'DUE' ? current : null;
    const copy = STATE_COPY[state.kind];

    const payYear = async (invoice: SchoolInvoice) => {
        setBusy(true);
        setMessage(null);
        try {
            await api.post(`${BILLING_URL}/year`, { invoice_id: invoice.id });
            setMessage({ tone: 'success', text: 'Changed to the year.' });
            query.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Could not change it') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <View>
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            <Card>
                {current ? (
                    <>
                        <View style={styles.head}>
                            <Text style={styles.label} numberOfLines={1}>{current.label}</Text>
                            <Badge label={copy.label} variant={BADGE[copy.tone]} />
                        </View>
                        <Text style={styles.amount}>{formatKes(current.amount)}</Text>
                        <Text style={styles.muted}>{current.plan} · {current.learners.toLocaleString()} learners · {invoiceLine(current)}</Text>
                        {state.kind === 'due' || state.kind === 'overdue' ? (
                            <Notice tone={state.kind === 'overdue' ? 'danger' : 'warning'} message={`Read-only from ${day(state.lockOn)} if unpaid.`} />
                        ) : null}
                        {state.kind === 'locked' ? <Notice tone="danger" message="Read-only until paid." /> : null}
                        {unpaid?.cycle === 'TERM' ? (
                            <View style={{ marginTop: spacing.sm }}>
                                <Button variant="secondary" loading={busy} block label={`Pay the year instead: ${formatKes(cyclePrice(unpaid.learners, 'year'))} (save ${Math.round(YEAR_DISCOUNT * 100)}%)`} onPress={() => void payYear(unpaid)} />
                            </View>
                        ) : null}
                    </>
                ) : (
                    <Text style={styles.muted}>Set the current term under Calendar to see this term’s invoice.</Text>
                )}
            </Card>

            {unpaid ? (
                <>
                    <SectionLabel>Pay by M-Pesa or bank</SectionLabel>
                    <Card>
                        {instructions && hasInstructions(instructions) ? (
                            <>
                                {instructions.paybill ? <InfoRow label="Paybill" value={instructions.paybill} /> : null}
                                {instructions.paybill ? <InfoRow label="Account" value={instructions.account || schoolName} /> : null}
                                {instructions.till ? <InfoRow label="Till" value={instructions.till} /> : null}
                                <InfoRow label="Amount" value={formatKes(unpaid.amount)} />
                                {instructions.bank ? <InfoRow label="Bank" value={instructions.bank} /> : null}
                                {instructions.phone ? (
                                    <Pressable onPress={() => void Linking.openURL(`tel:${instructions.phone}`)} accessibilityRole="link">
                                        <InfoRow label="Questions" value={instructions.phone} />
                                    </Pressable>
                                ) : null}
                            </>
                        ) : (
                            <Text style={styles.muted}>Payment details coming soon.</Text>
                        )}
                    </Card>
                </>
            ) : null}

            {invoices.some((i) => i.status !== 'VOID') ? (
                <>
                    <SectionLabel>Invoices</SectionLabel>
                    <ListCard>
                        {invoices.filter((i) => i.status !== 'VOID').map((i) => (
                            <ListRow key={i.id} title={i.label} subtitle={invoiceLine(i)} right={<Text style={styles.rowAmount}>{formatKes(i.amount)}</Text>} />
                        ))}
                    </ListCard>
                </>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((colors) => ({
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    label: { flex: 1, fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    amount: { fontSize: 32, fontFamily: fonts.bold, color: colors.foreground, marginTop: spacing.sm },
    muted: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular, color: colors.muted, marginBottom: spacing.xs },
    rowAmount: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
}));
