import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { admissionNo, money, personName, studentName } from '@shared/ops/format';
import {
    BILL_TERM_WARNING, statementTotal,
    type Invoice, type InvoiceSummary, type Residence, type ResidenceLearner, type VoteHeadStatement,
} from '@shared/ops/forms/finance';
import { Button, ButtonRow, Card, EmptyState, InfoRow, ListCard, ListRow, SectionLabel, StatGrid, StatTile, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { LookupField } from '@/components/ops/SelectField';
import { toneColor, useRefreshSignal } from '@/components/ops/bits';
import { useApi, withQuery } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { opsGet } from '@/lib/ops';
import { colors, radius, spacing } from '@/lib/theme';

/** Bill a term from the fee structures, previewing totals first — the web's invoicing panel. */
export function Invoicing({ canManage }: { canManage: boolean }) {
    const api = useApi();
    const toast = useToast();
    const [termId, setTermId] = useState('');
    const [streamId, setStreamId] = useState('');
    const [preview, setPreview] = useState<InvoiceSummary | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [busy, setBusy] = useState(false);

    const loadInvoices = useCallback(async () => {
        if (!termId) return;
        try { setInvoices(await opsGet<Invoice[]>(api, withQuery('/api/finance/invoices', { term_id: termId }))); }
        catch (err) { toast.error(errorMessage(err, 'Could not load invoices')); }
    }, [api, termId, toast]);
    useEffect(() => { void loadInvoices(); }, [loadInvoices]);
    useRefreshSignal(loadInvoices);

    const run = async (dryRun: boolean) => {
        if (!termId) { toast.error('Choose a term.'); return; }
        setBusy(true);
        try {
            const r = await api.post<{ data: InvoiceSummary }>('/api/finance/invoices/generate', { term_id: termId, grade_stream_id: streamId || undefined, dry_run: dryRun });
            setPreview(r.data);
            if (!dryRun) { toast.success(`${r.data.learners} learners billed.`); await loadInvoices(); }
        } catch (err) {
            toast.error(errorMessage(err, 'Billing failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <LookupField label="Term" required lookup="terms" value={termId} onChange={(v) => { setTermId(v); setPreview(null); }} />
                <LookupField label="Class (optional)" lookup="streams" value={streamId} onChange={(v) => { setStreamId(v); setPreview(null); }} clearable />
                {canManage ? (
                    <ButtonRow>
                        <Button variant="secondary" label="Preview" onPress={() => void run(true)} disabled={busy} />
                        <Button
                            label="Bill term"
                            disabled={busy || !termId}
                            loading={busy}
                            onPress={() => confirmAlert('Bill this term?', BILL_TERM_WARNING, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Bill term', onPress: () => void run(false) },
                            ])}
                        />
                    </ButtonRow>
                ) : null}
            </Card>

            {preview ? (
                <StatGrid>
                    <StatTile label={preview.dry_run ? 'Would bill' : 'Billed'} value={preview.learners} sub="learners" />
                    <StatTile label="Amount" value={money(preview.billed)} />
                    <StatTile label="Less awards" value={money(preview.awards)} />
                    <StatTile label="No structure" value={preview.unbilled} sub="learners skipped" tone={toneColor(preview.unbilled > 0 ? 'warn' : 'good')} />
                </StatGrid>
            ) : null}

            {termId ? (
                <>
                    <SectionLabel>Invoices</SectionLabel>
                    {invoices.length === 0 ? <EmptyState title="No invoices for this term yet." /> : (
                        <ListCard>
                            {invoices.map((i) => (
                                <ListRow
                                    key={i.id}
                                    title={studentName(i.student)}
                                    subtitle={`${admissionNo(i.student)} · ${i.structure?.name ?? 'Transport only'}`}
                                    meta={i.lines.map((l) => l.description).join(', ')}
                                    right={<Text style={styles.amount}>{money(i.total)}</Text>}
                                />
                            ))}
                        </ListCard>
                    )}
                </>
            ) : null}
        </View>
    );
}

/** Day scholar or boarder, class by class: decides fee structures and who sleeps in. */
export function ResidencePanel({ canEdit }: { canEdit: boolean }) {
    const api = useApi();
    const toast = useToast();
    const [streamId, setStreamId] = useState('');
    const [learners, setLearners] = useState<ResidenceLearner[]>([]);

    const load = useCallback(async () => {
        if (!streamId) return;
        try { setLearners(await opsGet<ResidenceLearner[]>(api, withQuery('/api/finance/residence', { grade_stream_id: streamId }))); }
        catch (err) { toast.error(errorMessage(err, 'Could not load the class')); }
    }, [api, streamId, toast]);
    useEffect(() => { void load(); }, [load]);
    useRefreshSignal(load);

    const set = async (ids: string[], residence: Residence) => {
        try {
            await api.post('/api/finance/residence', { student_ids: ids, residence });
            setLearners((ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, residence } : l)));
        } catch (err) {
            toast.error(errorMessage(err, 'Could not save'));
        }
    };

    const boarders = learners.filter((l) => l.residence === 'BOARDER').length;

    return (
        <View>
            <LookupField label="Class" lookup="streams" value={streamId} onChange={setStreamId} />
            {canEdit && learners.length > 0 ? (
                <ButtonRow>
                    <Button size="sm" variant="secondary" label="All day" onPress={() => void set(learners.map((l) => l.id), 'DAY')} />
                    <Button size="sm" variant="secondary" label="All boarders" onPress={() => void set(learners.map((l) => l.id), 'BOARDER')} />
                </ButtonRow>
            ) : null}
            {learners.length > 0 ? <Text style={styles.note}>{boarders} boarders · {learners.length - boarders} day scholars</Text> : null}
            {learners.map((l) => (
                <Card key={l.id} style={styles.learner}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.name} numberOfLines={1}>{personName(l.user)}</Text>
                        <Text style={styles.meta}>{l.admission_number}</Text>
                    </View>
                    <View style={styles.toggle} accessibilityRole="radiogroup" accessibilityLabel={`Residence for ${personName(l.user)}`}>
                        {(['DAY', 'BOARDER'] as const).map((r) => (
                            <Pressable
                                key={r}
                                disabled={!canEdit}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: l.residence === r, disabled: !canEdit }}
                                onPress={() => { if (l.residence !== r) void set([l.id], r); }}
                                style={[styles.toggleBtn, l.residence === r && styles.toggleOn]}
                            >
                                <Text style={[styles.toggleText, l.residence === r && { color: colors.foreground }]}>{r === 'DAY' ? 'Day' : 'Boarder'}</Text>
                            </Pressable>
                        ))}
                    </View>
                </Card>
            ))}
        </View>
    );
}

/** Billed, collected, owed and spent per vote head for a term, and balance reminders by SMS. */
export function VoteHeadStatementPanel({ canRemind }: { canRemind: boolean }) {
    const api = useApi();
    const toast = useToast();
    const [termId, setTermId] = useState('');
    const [report, setReport] = useState<VoteHeadStatement | null>(null);
    const [minBalance, setMinBalance] = useState('1000');
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        if (!termId) return;
        try { setReport(await opsGet<VoteHeadStatement>(api, withQuery('/api/finance/reports/vote-heads', { term_id: termId }))); }
        catch (err) { toast.error(errorMessage(err, 'Could not load the statement')); }
    }, [api, termId, toast]);
    useEffect(() => { void load(); }, [load]);
    useRefreshSignal(load);

    const remind = async (dryRun: boolean) => {
        setSending(true);
        try {
            const r = await api.post<{ data: { recipients: number; sent: number; failed: number } }>('/api/finance/reminders', { term_id: termId, min_balance: Number(minBalance) || 1, dry_run: dryRun });
            if (dryRun) {
                const n = r.data.recipients;
                confirmAlert('Send fee reminders?', n === 0 ? 'No guardians match; nothing will be sent.' : `${n} guardians will get an SMS with their child's balance.`, [
                    { text: 'Cancel', style: 'cancel' },
                    ...(n > 0 ? [{ text: 'Send', onPress: () => void remind(false) }] : []),
                ]);
            } else {
                toast.success(`Reminders sent: ${r.data.sent}${r.data.failed ? `, ${r.data.failed} failed` : ''}.`);
            }
        } catch (err) {
            toast.error(errorMessage(err, 'Could not send reminders'));
        } finally {
            setSending(false);
        }
    };

    return (
        <View>
            <LookupField label="Term" lookup="terms" value={termId} onChange={setTermId} />
            {report ? (
                report.lines.length === 0 ? <EmptyState title="Bill the term to see its vote-head statement." /> : (
                    <>
                        {report.lines.map((l) => (
                            <Card key={`${l.voteHeadId}-${l.name}`} style={{ marginBottom: spacing.sm, padding: spacing.md }}>
                                <Text style={styles.name}>{l.name}</Text>
                                <InfoRow label="Billed" value={money(l.billed)} />
                                <InfoRow label="Collected" value={money(l.collected)} />
                                <InfoRow label="Owed" value={money(l.outstanding)} />
                                <InfoRow label="Spent" value={money(l.spent)} />
                            </Card>
                        ))}
                        <Text style={styles.note}>
                            Totals: billed {money(statementTotal(report, 'billed'))} · collected {money(statementTotal(report, 'collected'))} · owed {money(statementTotal(report, 'outstanding'))}
                            {report.overpaid > 0 ? ` · overpayments ${money(report.overpaid)}` : ''}
                        </Text>
                    </>
                )
            ) : null}
            {canRemind && termId ? (
                <Card style={{ marginTop: spacing.md }}>
                    <Text style={styles.name}>Balance reminders</Text>
                    <Text style={[styles.meta, { marginBottom: spacing.md }]}>Text the guardians of learners who owe at least this much for the term.</Text>
                    <TextField label="Owing at least (KES)" value={minBalance} onChangeText={setMinBalance} keyboardType="number-pad" />
                    <Button label="Send reminders" onPress={() => void remind(true)} loading={sending} />
                </Card>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    amount: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    note: { fontSize: 13, color: colors.muted, marginVertical: spacing.sm },
    learner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
    name: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
    toggle: { flexDirection: 'row', backgroundColor: colors.mutedBg, borderRadius: radius.sm, padding: 2 },
    toggleBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm - 2 },
    toggleOn: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    toggleText: { fontSize: 12, fontWeight: '700', color: colors.muted },
});
