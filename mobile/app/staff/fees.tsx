import { useDownload } from '@/lib/useDownload';
import { DateField } from '@/components/DateField';
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useApi, withQuery } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';
import { useCurrentUser } from '@/lib/UserContext';
import { useTabParam } from '@/lib/useTabParam';
import { useGradeStreams, useTerms } from '@/lib/useSchoolData';
import { errorMessage, formatCurrency, formatDate, fullName, isOverdue, pluralize } from '@/lib/format';
import { spacing, useTheme } from '@/lib/theme';
import {
    Badge, Button, ButtonRow, Card, ChipSelect, FilterGrid, EmptyState, ErrorBanner, ListCard, ListRow, LoadingView, Notice,
    Screen, ScreenHeader, ScrollTabs, SearchField, StatGrid, StatTile, TextField,
} from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import { FeeDetail, PAYMENT_STATUS_VARIANT } from '@/components/fees/FeeDetail';
import { UnmatchedQueue } from '@/components/fees/UnmatchedQueue';
import { DayBook } from '@/components/fees/DayBook';
import { FeesOverview } from '@/components/fees/FeesOverview';
import type { FeePaymentStatus, FeeStatus, StaffFeeRecord, StudentListItem } from '@/lib/types';
import { totalOwed } from '@shared/fees';

const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    PARTIAL: { label: 'Partial', variant: 'info' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERPAID: { label: 'Overpaid', variant: 'info' },
};

const TABS = ['overview', 'balances', 'payments', 'unmatched', 'daybook'] as const;
type Tab = (typeof TABS)[number];

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
    const { can } = useCurrentUser();
    const finance = can('fees.view');
    // Finance staff open on the health check; a class teacher on their class's balances.
    const [picked, setTab] = useTabParam<Tab>(TABS, finance ? 'overview' : 'balances');
    const tabs = [
        ...(finance ? [{ value: 'overview' as const, label: 'Overview' }] : []),
        { value: 'balances' as const, label: 'Balances' },
        { value: 'payments' as const, label: 'Payments' },
        // Matching Paybill money is fees.collect work: the bursar or accountant, not only an admin.
        ...(can('fees.collect') ? [{ value: 'unmatched' as const, label: 'Unmatched' }] : []),
        ...(finance ? [{ value: 'daybook' as const, label: 'Day book' }] : []),
    ];
    const tab: Tab = tabs.some((t) => t.value === picked) ? picked : 'balances';
    return (
        <Screen>
            <ScreenHeader
                title="Fees"
                description={can('fees.manage')
                    ? 'Bill learners, record payments and follow up balances.'
                    : can('fees.collect') ? 'Record payments and follow up balances.' : 'Fee balances for your class.'}
            />
            <ScrollTabs tabs={tabs} value={tab} onChange={setTab} />
            {tab === 'overview' ? <FeesOverview onGo={setTab} />
                : tab === 'balances' ? <Balances />
                : tab === 'payments' ? <Payments />
                : tab === 'unmatched' ? <UnmatchedQueue />
                : <DayBook />}
        </Screen>
    );
}

// ── Balances ───────────────────────────────────────────────

function Balances() {
    const download = useDownload();
    const { colors } = useTheme();
    const api = useApi();
    // Billing is fees.manage; an accountant records payments only.
    const { can } = useCurrentUser();
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
    const outstanding = totalOwed(fees);
    const overdue = fees.filter((f) => isOverdue(f.dueDate, f.balance)).length;

    const exportXlsx = async () => {
        setExporting(true);
        try {
            await download(withQuery('/api/school/fees/export', { term_id: termId }), 'Fee_balances.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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

            <ChipSelect label="Term" options={[{ value: '', label: 'All terms' }, ...terms.map((t) => ({ value: t.id, label: t.name }))]} value={termId} onChange={setTermId} />
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
                    {can('fees.manage') ? <Button icon={Plus} label="Bill learners" onPress={() => setBilling(true)} /> : null}
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
    const { colors } = useTheme();
    const api = useApi();
    const { terms } = useTerms();
    const { streams } = useGradeStreams();
    const [mode, setMode] = useState<'one' | 'class'>('one');
    const [termId, setTermId] = useState<string | null>(defaultTermId);
    const [streamId, setStreamId] = useState<string | null>(streams.length === 1 ? streams[0].id : null);
    const [studentId, setStudentId] = useState<string | null>(null);
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
                // Learners already billed this term are left alone rather than
                // re-billed (which would replace their amount). Matched by id:
                // many learners have no admission number. Without the term's
                // records there is no telling who is billed, so stop.
                if (!termFees.data) throw new Error('Could not load this term’s fee records. Try again.');
                const billed = new Set(termFees.data.map((f) => f.studentId).filter(Boolean));
                const targets = roster.filter((s) => !billed.has(s.id));
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
            <FilterGrid>
                <ChipSelect label="Term" options={terms.map((t) => ({ value: t.id, label: t.name }))} value={termId} onChange={setTermId} />
                <ChipSelect label="Class" options={streams.map((s) => ({ value: s.id, label: s.full_name }))} value={streamId} onChange={(id) => { setStreamId(id); setStudentId(null); }} />
            </FilterGrid>
            {mode === 'one' && streamId ? (
                <ChipSelect label="Learner" layout="picker" placeholder="Find the learner" options={roster.map((s) => ({ value: s.id, label: fullName(s.users), hint: s.admission_number ?? undefined }))} value={studentId} onChange={setStudentId} />
            ) : null}
            {mode === 'class' && streamId ? <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.sm }}>{pluralize(roster.length, 'active learner')} will be billed (anyone already billed this term is skipped).</Text> : null}
            <TextField label="Amount (KES)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <DateField label="Due date (optional)" optional value={dueDate} onChange={setDueDate} />
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
    const download = useDownload();
    const { colors } = useTheme();
    const api = useApi();
    const [method, setMethod] = useState('');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    // Raw: the answer says how many payments there are in all, and the list
    // carries only the newest of them (the export has every one).
    const ledger = useApiQuery<{ data?: LedgerPayment[]; total?: number; truncated?: boolean }>(withQuery('/api/school/fees/payments', { method }), { raw: true });
    const { loading, error, refresh } = ledger;
    const data = ledger.data?.data;

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
            {ledger.data?.truncated ? (
                <Notice tone="info" message={`Showing the newest ${(data ?? []).length} of ${ledger.data.total ?? 'many'} payments. Export the ledger for all of them.`} />
            ) : null}
            <StatGrid>
                <StatTile label="Payments" value={rows.length} />
                <StatTile label="Completed total" value={formatCurrency(total)} tone={colors.success} />
            </StatGrid>
            <ButtonRow>
                <Button
                    variant="secondary"
                    label="Export ledger"
                    loading={busy === 'export'}
                    onPress={() => run('export', () => download(withQuery('/api/school/fees/payments/export', { method }), 'Fee_payments.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))}
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
                                            <Button size="sm" variant="ghost" label="Receipt" loading={busy === p.id} onPress={() => run(p.id, () => download(`/api/school/fees/payments/${p.id}/receipt`, `Receipt_${p.receiptNumber}.pdf`))} />
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
