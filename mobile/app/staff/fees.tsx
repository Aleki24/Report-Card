import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { useGradeStreams, useTerms } from '@/lib/useSchoolData';
import { errorMessage, formatCurrency, formatDate, fullName, isOverdue, pluralize } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, SearchField, SegmentedTabs, StatGrid, StatTile, TextField,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { FeeDetail, PAYMENT_STATUS_VARIANT } from '@/components/fees/FeeDetail';
import type { FeePaymentStatus, FeeStatus, StaffFeeRecord, StudentListItem } from '@/lib/types';

const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    PARTIAL: { label: 'Partial', variant: 'info' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERPAID: { label: 'Overpaid', variant: 'info' },
};

type Tab = 'balances' | 'payments' | 'unmatched';

interface LedgerPayment {
    id: string;
    studentFeeId: string | null;
    receiptNumber: string;
    amount: number;
    method: string;
    status: FeePaymentStatus;
    source: 'AUTO' | 'MANUAL';
    studentName: string | null;
    admissionNumber: string | null;
    unmatchedReference: string | null;
    termName: string | null;
    mpesaReceiptNumber: string | null;
    recordedByName: string | null;
    paidAt: string;
}

export default function StaffFeesScreen() {
    return (
        <RequireScreen screen="fees">
            <FeesContent />
        </RequireScreen>
    );
}

function FeesContent() {
    const { role } = useCurrentUser();
    const [tab, setTab] = useState<Tab>('balances');
    const tabs = [
        { value: 'balances' as const, label: 'Balances' },
        { value: 'payments' as const, label: 'Payments' },
        ...(role === 'ADMIN' ? [{ value: 'unmatched' as const, label: 'Unmatched' }] : []),
    ];
    return (
        <Screen>
            <ScreenHeader title="Fees" description={role === 'ADMIN' ? 'Bill learners, record payments and follow up balances.' : 'Fee balances for your class.'} />
            <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />
            {tab === 'balances' ? <Balances /> : tab === 'payments' ? <Payments /> : <Unmatched />}
        </Screen>
    );
}

// ── Balances ───────────────────────────────────────────────

function Balances() {
    const api = useApi();
    const { terms, activeTermId } = useTerms();
    const [termId, setTermId] = useState<string>('');
    const [status, setStatus] = useState<'all' | 'owing' | 'overdue' | 'paid'>('all');
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState<string | null>(null);
    const [billing, setBilling] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
    const { data, loading, error, refresh } = useApiQuery<StaffFeeRecord[]>(withQuery('/api/school/fees', { term_id: termId }));

    const fees = data ?? [];
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return fees.filter((f) => {
            if (status === 'owing' && f.balance <= 0) return false;
            if (status === 'paid' && f.balance > 0) return false;
            if (status === 'overdue' && !isOverdue(f.dueDate, f.balance)) return false;
            return !q || `${f.studentName ?? ''} ${f.admissionNumber ?? ''}`.toLowerCase().includes(q);
        });
    }, [fees, search, status]);

    const billed = fees.reduce((s, f) => s + f.totalFee, 0);
    const paid = fees.reduce((s, f) => s + f.paidAmount, 0);
    const outstanding = fees.reduce((s, f) => s + Math.max(0, f.balance), 0);
    const overdue = fees.filter((f) => isOverdue(f.dueDate, f.balance)).length;

    const exportXlsx = async () => {
        setExporting(true);
        try {
            await api.downloadAndShare(withQuery('/api/school/fees/export', { term_id: termId }), 'Fee_balances.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Export failed') });
        } finally {
            setExporting(false);
        }
    };

    return (
        <View>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}

            <ChipSelect options={[{ value: '', label: 'All terms' }, ...terms.map((t) => ({ value: t.id, label: t.name }))]} value={termId} onChange={setTermId} />
            <StatGrid>
                <StatTile label="Billed" value={formatCurrency(billed)} />
                <StatTile label="Collected" value={formatCurrency(paid)} tone={colors.success} sub={billed > 0 ? `${Math.round((paid / billed) * 100)}% of billed` : undefined} />
                <StatTile label="Outstanding" value={formatCurrency(outstanding)} tone={outstanding > 0 ? colors.danger : undefined} />
                <StatTile label="Overdue" value={overdue} tone={overdue > 0 ? colors.danger : undefined} />
            </StatGrid>

            {billing ? (
                <BillForm
                    defaultTermId={termId || activeTermId}
                    onCancel={() => setBilling(false)}
                    onDone={(text) => {
                        setBilling(false);
                        setMessage({ tone: 'success', text });
                        refresh();
                    }}
                />
            ) : (
                <ButtonRow>
                    <Button variant="secondary" label="Export" onPress={exportXlsx} loading={exporting} />
                    <Button label="+ Bill learners" onPress={() => setBilling(true)} />
                </ButtonRow>
            )}

            <View style={{ marginTop: spacing.md }}>
                <SearchField value={search} onChangeText={setSearch} placeholder="Search by student name or admission no." />
                <ChipSelect
                    options={[
                        { value: 'all', label: 'All' },
                        { value: 'owing', label: 'Owing' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'paid', label: 'Paid up' },
                    ]}
                    value={status}
                    onChange={setStatus}
                />
            </View>

            {loading ? (
                <LoadingView />
            ) : filtered.length === 0 ? (
                <EmptyState title="No fee records found" description={fees.length === 0 ? 'Bill learners to start tracking fees.' : undefined} />
            ) : (
                <ListCard>
                    {filtered.map((f) => {
                        const late = isOverdue(f.dueDate, f.balance);
                        return (
                            <View key={f.id}>
                                <ListRow
                                    title={f.studentName ?? '—'}
                                    subtitle={`${f.admissionNumber ?? '—'} · ${f.termName ?? '—'}${f.dueDate ? ` · due ${formatDate(f.dueDate)}` : ''}`}
                                    meta={f.balance > 0 ? `Balance ${formatCurrency(f.balance)}` : f.balance < 0 ? `Credit ${formatCurrency(-f.balance)}` : 'Paid in full'}
                                    right={late ? <Badge label="Overdue" variant="danger" /> : <Badge label={STATUS_META[f.status]?.label ?? f.status} variant={STATUS_META[f.status]?.variant ?? 'warning'} />}
                                    onPress={() => setOpen(open === f.id ? null : f.id)}
                                />
                                {open === f.id ? <FeeDetail fee={f} onChanged={refresh} /> : null}
                            </View>
                        );
                    })}
                </ListCard>
            )}
        </View>
    );
}

/** Bill one learner, or everyone in a class at once (the web's batch mode). */
function BillForm({ defaultTermId, onCancel, onDone }: { defaultTermId: string | null; onCancel: () => void; onDone: (message: string) => void }) {
    const api = useApi();
    const { terms } = useTerms();
    const { streams } = useGradeStreams();
    const [mode, setMode] = useState<'one' | 'class'>('one');
    const [termId, setTermId] = useState<string | null>(defaultTermId);
    const [streamId, setStreamId] = useState<string | null>(streams.length === 1 ? streams[0].id : null);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const students = useApiQuery<StudentListItem[]>(streamId ? withQuery('/api/school/data', { type: 'students', grade_stream_id: streamId }) : null);
    // The server updates an existing learner+term bill in place, so batch mode
    // needs this term's bills to leave those learners alone.
    const termFees = useApiQuery<StaffFeeRecord[]>(termId ? withQuery('/api/school/fees', { term_id: termId }) : null);

    const roster = (students.data ?? []).filter((s) => s.status === 'ACTIVE');
    const q = search.trim().toLowerCase();
    const matches = roster.filter((s) => !q || `${fullName(s.users)} ${s.admission_number ?? ''}`.toLowerCase().includes(q)).slice(0, 8);

    const submit = async () => {
        const total = parseFloat(amount);
        if (!termId) return setError('Choose a term.');
        if (!amount || Number.isNaN(total) || total <= 0) return setError('Enter an amount greater than 0.');
        const details = { term_id: termId, total_fee: total, due_date: dueDate.trim() || null, notes: notes.trim() || null };
        setSaving(true);
        setError(null);
        try {
            if (mode === 'one') {
                if (!studentId) throw new Error('Choose a learner.');
                await api.post('/api/school/fees', { ...details, student_id: studentId });
                onDone('Fee record added.');
            } else {
                // Learners already billed this term are left alone rather than double-billed.
                const billed = new Set((termFees.data ?? []).map((f) => f.admissionNumber).filter(Boolean));
                const targets = roster.filter((s) => !s.admission_number || !billed.has(s.admission_number));
                const results = await Promise.all(targets.map((s) => api.post('/api/school/fees', { ...details, student_id: s.id }).then(() => true).catch(() => false)));
                const ok = results.filter(Boolean).length;
                onDone(`Billed ${pluralize(ok, 'learner')}${roster.length - targets.length ? ` · ${roster.length - targets.length} already billed` : ''}${ok < targets.length ? ` · ${targets.length - ok} failed` : ''}.`);
            }
        } catch (err) {
            setError(errorMessage(err, 'Failed to bill'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card style={{ marginVertical: spacing.md }}>
            {error ? <ErrorBanner message={error} /> : null}
            <ChipSelect
                options={[
                    { value: 'one', label: 'One learner' },
                    { value: 'class', label: 'Whole class' },
                ]}
                value={mode}
                onChange={setMode}
            />
            <ChipSelect label="Term" options={terms.map((t) => ({ value: t.id, label: t.name }))} value={termId} onChange={setTermId} />
            <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={streamId} onChange={(id) => { setStreamId(id); setStudentId(null); }} />
            {mode === 'one' && streamId ? (
                <>
                    <SearchField value={search} onChangeText={setSearch} placeholder="Find the learner" />
                    <ChipSelect wrap options={matches.map((s) => ({ value: s.id, label: fullName(s.users), hint: s.admission_number ?? undefined }))} value={studentId} onChange={setStudentId} />
                </>
            ) : null}
            {mode === 'class' && streamId ? <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>{pluralize(roster.length, 'active learner')} will be billed (anyone already billed this term is skipped).</Text> : null}
            <TextField label="Amount (KES)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <TextField label="Due date (YYYY-MM-DD, optional)" value={dueDate} onChangeText={setDueDate} />
            <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} />
            <ButtonRow>
                <Button variant="secondary" label="Cancel" onPress={onCancel} />
                <Button label={mode === 'one' ? 'Add fee' : 'Bill class'} onPress={submit} loading={saving} disabled={mode === 'class' && termFees.loading} />
            </ButtonRow>
        </Card>
    );
}

// ── Payments ledger ────────────────────────────────────────

function Payments() {
    const api = useApi();
    const [method, setMethod] = useState('');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const { data, loading, error, refresh } = useApiQuery<LedgerPayment[]>(withQuery('/api/school/fees/payments', { method }));

    const q = search.trim().toLowerCase();
    const rows = (data ?? []).filter((p) => !q || `${p.studentName ?? ''} ${p.admissionNumber ?? ''} ${p.receiptNumber} ${p.mpesaReceiptNumber ?? ''}`.toLowerCase().includes(q));
    const total = rows.filter((p) => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0);

    const run = async (key: string, work: () => Promise<void>) => {
        setBusy(key);
        try {
            await work();
        } catch (err) {
            setMessage(errorMessage(err, 'Download failed'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <View>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone="danger" message={message} onDismiss={() => setMessage(null)} /> : null}
            <ChipSelect
                options={[{ value: '', label: 'All methods' }, ...['MPESA', 'CASH', 'BANK', 'CHEQUE', 'PESAPAL', 'OTHER'].map((m) => ({ value: m, label: m === 'MPESA' ? 'M-Pesa' : m.charAt(0) + m.slice(1).toLowerCase() }))]}
                value={method}
                onChange={setMethod}
            />
            <SearchField value={search} onChangeText={setSearch} placeholder="Search name, receipt or M-Pesa code" />
            <StatGrid>
                <StatTile label="Payments" value={rows.length} />
                <StatTile label="Completed total" value={formatCurrency(total)} tone={colors.success} />
            </StatGrid>
            <ButtonRow>
                <Button
                    variant="secondary"
                    label="Export ledger"
                    loading={busy === 'export'}
                    onPress={() => run('export', () => api.downloadAndShare(withQuery('/api/school/fees/payments/export', { method }), 'Fee_payments.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))}
                />
            </ButtonRow>
            <View style={{ marginTop: spacing.md }}>
                {loading ? (
                    <LoadingView />
                ) : rows.length === 0 ? (
                    <EmptyState title="No payments yet" />
                ) : (
                    <ListCard>
                        {rows.map((p) => (
                            <ListRow
                                key={p.id}
                                title={`${formatCurrency(p.amount)} · ${p.studentName ?? (p.unmatchedReference ? `Unmatched (${p.unmatchedReference})` : '—')}`}
                                subtitle={`${formatDate(p.paidAt)} · ${p.method}${p.source === 'AUTO' ? ' (auto)' : ''} · ${p.receiptNumber}${p.mpesaReceiptNumber ? ` · ${p.mpesaReceiptNumber}` : ''}`}
                                meta={[p.termName, p.recordedByName ? `by ${p.recordedByName}` : null].filter(Boolean).join(' · ') || null}
                                right={
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <Badge label={p.status} variant={PAYMENT_STATUS_VARIANT[p.status]} />
                                        {p.status === 'COMPLETED' && p.studentFeeId ? (
                                            <Button size="sm" variant="ghost" label="Receipt" loading={busy === p.id} onPress={() => run(p.id, () => api.downloadAndShare(`/api/school/fees/payments/${p.id}/receipt`, `Receipt_${p.receiptNumber}.pdf`))} />
                                        ) : null}
                                    </View>
                                }
                            />
                        ))}
                    </ListCard>
                )}
            </View>
        </View>
    );
}

// ── Unmatched M-Pesa (admin) ───────────────────────────────

interface UnmatchedPayment {
    id: string;
    receiptNumber: string;
    amount: number;
    phoneNumber: string | null;
    payerName: string | null;
    mpesaReceiptNumber: string | null;
    unmatchedAccountReference: string | null;
    paidAt: string;
}

/** Paybill payments whose account number matched no learner; assign each to the right fee. */
function Unmatched() {
    const api = useApi();
    const { data, loading, error, refresh } = useApiQuery<UnmatchedPayment[]>('/api/school/fees/unmatched');
    const fees = useApiQuery<StaffFeeRecord[]>('/api/school/fees');
    const [assigning, setAssigning] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

    const assign = async (paymentId: string, feeId: string) => {
        try {
            await api.post(`/api/school/fees/unmatched/${paymentId}/assign`, { student_fee_id: feeId });
            setAssigning(null);
            setMessage({ tone: 'success', text: 'Payment assigned.' });
            refresh();
            fees.refresh();
        } catch (err) {
            setMessage({ tone: 'danger', text: errorMessage(err, 'Failed to assign') });
        }
    };

    if (loading) return <LoadingView />;
    const q = search.trim().toLowerCase();
    const candidates = (fees.data ?? []).filter((f) => !q || `${f.studentName ?? ''} ${f.admissionNumber ?? ''}`.toLowerCase().includes(q)).slice(0, 10);

    return (
        <View>
            {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
            {message ? <Notice tone={message.tone} message={message.text} onDismiss={() => setMessage(null)} /> : null}
            {(data ?? []).length === 0 ? (
                <EmptyState title="Nothing unmatched" description="Every paybill payment found its learner." />
            ) : (
                <ListCard>
                    {(data ?? []).map((p) => (
                        <View key={p.id}>
                            <ListRow
                                title={`${formatCurrency(p.amount)} · ref “${p.unmatchedAccountReference ?? '—'}”`}
                                subtitle={`${formatDate(p.paidAt)} · ${p.payerName ?? p.phoneNumber ?? ''} · ${p.mpesaReceiptNumber ?? p.receiptNumber}`}
                                onPress={() => setAssigning(assigning === p.id ? null : p.id)}
                            />
                            {assigning === p.id ? (
                                <View style={{ padding: spacing.md, backgroundColor: colors.mutedBg }}>
                                    <SearchField value={search} onChangeText={setSearch} placeholder="Find the learner's fee record" />
                                    {candidates.map((f) => (
                                        <ListRow key={f.id} title={f.studentName ?? '—'} subtitle={`${f.admissionNumber ?? '—'} · ${f.termName ?? ''} · balance ${formatCurrency(f.balance)}`} right={<Button size="sm" label="Assign" onPress={() => void assign(p.id, f.id)} />} />
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    ))}
                </ListCard>
            )}
        </View>
    );
}
