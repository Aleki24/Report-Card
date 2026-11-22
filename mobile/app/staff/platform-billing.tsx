import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useApi } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { errorMessage, formatDate } from '@/lib/format';
import { fonts, makeStyles, spacing } from '@/lib/theme';
import { BackLink, Badge, Button, ButtonRow, Card, EmptyState, ErrorBanner, LoadingView, Notice, Screen, ScreenHeader, SectionLabel, TextField } from '@/components/ui';
import { formatKes } from '@shared/pricing';
import {
    PLATFORM_BILLING_URL, STATE_COPY, type InvoiceAction, type PaymentInstructions, type PlatformSchoolBilling, type SchoolInvoice,
} from '@shared/school-billing';

interface Data { schools: PlatformSchoolBilling[]; instructions: PaymentInstructions }
type Message = { tone: 'success' | 'danger'; text: string } | null;
const BADGE = { good: 'success', warn: 'warning', bad: 'danger', muted: 'default' } as const;

/** Where schools pay: the owner's Paybill, till and bank, shown on every unpaid invoice. */
function PaymentDetails({ initial, onSaved, onMessage }: { initial: PaymentInstructions; onSaved: () => void; onMessage: (m: Message) => void }) {
    const api = useApi();
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    useEffect(() => setForm(initial), [initial]);
    const set = (k: keyof PaymentInstructions) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
    const save = async () => {
        setSaving(true);
        try {
            await api.put(`${PLATFORM_BILLING_URL}/settings`, form);
            onMessage({ tone: 'success', text: 'Payment details saved.' });
            onSaved();
        } catch (err) {
            onMessage({ tone: 'danger', text: errorMessage(err, 'Could not save') });
        } finally {
            setSaving(false);
        }
    };
    return (
        <Card>
            <TextField label="Paybill" value={form.paybill} onChangeText={set('paybill')} keyboardType="number-pad" />
            <TextField label="Account (blank: school name)" value={form.account} onChangeText={set('account')} />
            <TextField label="Till" value={form.till} onChangeText={set('till')} keyboardType="number-pad" />
            <TextField label="Phone for questions" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
            <TextField label="Bank" value={form.bank} onChangeText={set('bank')} placeholder="Bank, branch, account name and number" multiline />
            <Button label="Save" onPress={save} loading={saving} block />
        </Card>
    );
}

/** One school's current invoice and the owner's buttons: paid, waive, void. */
function SchoolRow({ school, onDone, onMessage }: { school: PlatformSchoolBilling; onDone: () => void; onMessage: (m: Message) => void }) {
    const styles = useStyles();
    const api = useApi();
    const invoice: SchoolInvoice | null = school.state.kind === 'none' ? null : school.state.invoice;
    const [paying, setPaying] = useState(false);
    const [ref, setRef] = useState('');
    const [amount, setAmount] = useState(String(invoice?.amount ?? 0));
    const [busy, setBusy] = useState(false);
    const copy = STATE_COPY[school.state.kind];

    const act = async (action: InvoiceAction, done: string) => {
        if (!invoice) return;
        setBusy(true);
        try {
            await api.post(`${PLATFORM_BILLING_URL}/${invoice.id}`, action);
            onMessage({ tone: 'success', text: `${school.schoolName}: ${done}` });
            setPaying(false);
            onDone();
        } catch (err) {
            onMessage({ tone: 'danger', text: errorMessage(err, 'Could not save') });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card style={{ marginBottom: spacing.sm }}>
            <View style={styles.head}>
                <Text style={styles.name} numberOfLines={1}>{school.schoolName}</Text>
                <Badge label={copy.label} variant={BADGE[copy.tone]} />
            </View>
            <Text style={styles.sub}>
                {school.learners.toLocaleString()} learners
                {invoice ? ` · ${invoice.label} · ${formatKes(invoice.amount)} · due ${formatDate(invoice.dueDate, { day: 'numeric', month: 'short' })}` : ''}
            </Text>
            {invoice?.status === 'DUE' && !paying ? (
                <ButtonRow>
                    <Button size="sm" label="Mark paid" onPress={() => setPaying(true)} />
                    <Button size="sm" variant="secondary" label="Waive" disabled={busy} onPress={() => void act({ action: 'waive' }, 'waived.')} />
                    <Button size="sm" variant="ghost" label="Void" disabled={busy} onPress={() => void act({ action: 'void' }, 'voided.')} />
                </ButtonRow>
            ) : null}
            {paying && invoice ? (
                <View style={styles.pay}>
                    <TextField label="M-Pesa code or bank reference" value={ref} onChangeText={setRef} autoCapitalize="characters" />
                    <TextField label="Amount (KES)" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
                    <ButtonRow>
                        <Button size="sm" variant="ghost" label="Cancel" onPress={() => setPaying(false)} />
                        <Button size="sm" label="Save" loading={busy} disabled={ref.trim().length < 3 || !(Number(amount) > 0)} onPress={() => void act({ action: 'paid', payment_ref: ref.trim(), amount: Number(amount) || 0 }, 'marked paid.')} />
                    </ButtonRow>
                </View>
            ) : null}
        </Card>
    );
}

/** The web's School billing, for the platform owner: where schools pay, and each school's invoice this term. */
export default function PlatformBillingScreen() {
    const styles = useStyles();
    const query = useApiQuery<Data>(PLATFORM_BILLING_URL);
    const [message, setMessage] = useState<Message>(null);
    const data = query.data;
    const due = data ? data.schools.filter((s) => s.state.kind === 'due' || s.state.kind === 'overdue' || s.state.kind === 'locked') : [];
    const owed = due.reduce((n, s) => n + (s.state.kind === 'none' ? 0 : s.state.invoice.amount), 0);

    return (
        <Screen onRefresh={query.refresh} refreshing={query.refreshing}>
            <BackLink />
            <ScreenHeader title="School billing" />
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {query.error && !data ? (
                <ErrorBanner message={query.error} onRetry={query.reload} />
            ) : !data ? (
                <LoadingView />
            ) : (
                <>
                    <SectionLabel>Where schools pay</SectionLabel>
                    <PaymentDetails initial={data.instructions} onSaved={query.refresh} onMessage={setMessage} />
                    <SectionLabel>Schools</SectionLabel>
                    <Text style={styles.total}>{due.length} unpaid · {formatKes(owed)} owed</Text>
                    {data.schools.length === 0 ? (
                        <EmptyState title="No schools yet" />
                    ) : (
                        data.schools.map((s) => <SchoolRow key={s.schoolId} school={s} onDone={query.refresh} onMessage={setMessage} />)
                    )}
                </>
            )}
        </Screen>
    );
}

const useStyles = makeStyles((colors) => ({
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    name: { flex: 1, fontSize: 15, fontFamily: fonts.bold, color: colors.foreground },
    sub: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 4 },
    pay: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 12, backgroundColor: colors.mutedBg },
    total: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground, marginBottom: spacing.sm },
}));
