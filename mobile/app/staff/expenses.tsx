import React, { useState } from 'react';
import { Text } from 'react-native';
import { date, humanize, money, personName } from '@shared/ops/format';
import {
    EXPENSE_DECISION_DONE, EXPENSE_DECISION_TITLES, EXPENSE_TONES, SUPPLIER_FIELDS, expenseDecisions, expenseDefaults, expenseFields, expenseTotal,
    type Expense, type ExpenseDecision, type Named, type Supplier,
} from '@shared/ops/forms/finance';
import { EXPENSE_METHODS } from '@shared/ops/resources/finance';
import { Button, ChipSelect, StatGrid, StatTile, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { StatusPill, toneColor } from '@/components/ops/bits';
import { useApi } from '@/lib/api';
import { useOpsList } from '@/lib/ops';
import { errorMessage } from '@/lib/format';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, spacing } from '@/lib/theme';

type Decision = { expense: Expense; decision: ExpenseDecision; reload: () => Promise<void> };

const expenseTitle = (e: Expense) => e.description;
const expenseSubtitle = (e: Expense) => `${money(e.amount)} · ${date(e.expense_date)}`;
const expenseDetails = (e: Expense) => [
    ['Vote head', e.vote_head?.name ?? '—'],
    ['Supplier', e.supplier?.name ?? '—'],
    ['Raised by', personName(e.requester)],
    ...(e.decision_note ? [['Note', e.decision_note] as const] : []),
] as const;

export default function ExpensesScreen() {
    const api = useApi();
    const toast = useToast();
    const { can, profile } = useCurrentUser();
    const approver = can('expenses.approve');
    const viewer = approver || can('expenses.view');
    const suppliers = useOpsList<Named>('suppliers');
    const voteHeads = useOpsList<Named>('vote-heads');
    const fields = expenseFields(suppliers.rows, voteHeads.rows);
    const [decision, setDecision] = useState<Decision | null>(null);
    const [note, setNote] = useState('');
    const [method, setMethod] = useState('');
    const [reference, setReference] = useState('');
    const [busy, setBusy] = useState(false);

    const decide = async () => {
        if (!decision) return;
        setBusy(true);
        try {
            await api.post(`/api/finance/expenses/${decision.expense.id}/decision`, {
                decision: decision.decision, note: note || undefined, payment_method: method || undefined, reference: reference || undefined,
            });
            toast.success(EXPENSE_DECISION_DONE[decision.decision]);
            const { reload } = decision;
            setDecision(null);
            setNote(''); setMethod(''); setReference('');
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not save the decision'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <ModuleScreen
                screen="expenses"
                title="Expenses"
                description="Raise payment vouchers, approve them, and track spending by vote head and supplier."
                tabs={[
                    {
                        id: 'mine',
                        label: 'My requests',
                        visible: can('expenses.request') && !viewer,
                        render: () => (
                            <ResourceList<'expenses', Expense>
                                resource="expenses"
                                fields={fields}
                                canCreate
                                canEdit={(e) => e.status === 'PENDING'}
                                canDelete={(e) => e.status === 'PENDING'}
                                addLabel="Request payment"
                                defaults={expenseDefaults()}
                                title={expenseTitle}
                                subtitle={expenseSubtitle}
                                badge={(e) => <StatusPill status={e.status} tones={EXPENSE_TONES} />}
                                details={expenseDetails}
                            />
                        ),
                    },
                    {
                        id: 'all',
                        label: 'Expenses',
                        visible: viewer,
                        render: () => (
                            <ResourceList<'expenses', Expense>
                                resource="expenses"
                                fields={fields}
                                canCreate={can('expenses.request') || approver}
                                canEdit={(e) => (approver ? e.status === 'PENDING' : e.status === 'PENDING' && e.requested_by === profile?.id)}
                                canDelete={(e) => e.status === 'PENDING' && (approver || e.requested_by === profile?.id)}
                                addLabel="Record expense"
                                defaults={expenseDefaults()}
                                searchText={(e) => `${e.description} ${e.supplier?.name ?? ''} ${e.vote_head?.name ?? ''}`}
                                header={(rows) => (
                                    <StatGrid>
                                        <StatTile label="Awaiting approval" value={money(expenseTotal(rows, ['PENDING']))} tone={toneColor('warn')} />
                                        <StatTile label="Approved, unpaid" value={money(expenseTotal(rows, ['APPROVED']))} tone={toneColor('info')} />
                                        <StatTile label="Paid" value={money(expenseTotal(rows, ['PAID']))} tone={toneColor('good')} />
                                        <StatTile label="Rejected" value={rows.filter((r) => r.status === 'REJECTED').length} />
                                    </StatGrid>
                                )}
                                title={expenseTitle}
                                subtitle={expenseSubtitle}
                                badge={(e) => <StatusPill status={e.status} tones={EXPENSE_TONES} />}
                                details={expenseDetails}
                                rowActions={(e, reload) => (approver ? (
                                    <>
                                        {expenseDecisions(e, profile?.id).map((d) => (
                                            <Button
                                                key={d}
                                                size="sm"
                                                variant={d === 'REJECT' ? 'danger' : d === 'PAID' ? 'secondary' : 'primary'}
                                                label={d === 'APPROVE' ? 'Approve' : d === 'REJECT' ? 'Reject' : 'Paid'}
                                                onPress={() => { if (d === 'PAID') setMethod(e.payment_method ?? ''); setDecision({ expense: e, decision: d, reload }); }}
                                            />
                                        ))}
                                    </>
                                ) : null)}
                            />
                        ),
                    },
                    {
                        id: 'suppliers',
                        label: 'Suppliers',
                        render: () => (
                            <ResourceList<'suppliers', Supplier>
                                resource="suppliers"
                                fields={SUPPLIER_FIELDS}
                                canCreate={approver}
                                canEdit={approver}
                                canDelete={approver}
                                searchText={(s) => `${s.name} ${s.category ?? ''}`}
                                title={(s) => s.name}
                                subtitle={(s) => s.category}
                                details={(s) => [
                                    ['Phone', s.phone ?? '—'],
                                    ['KRA PIN', s.kra_pin ?? '—'],
                                ]}
                            />
                        ),
                    },
                ]}
            />

            <FormSheet
                visible={decision !== null}
                title={decision ? EXPENSE_DECISION_TITLES[decision.decision] : ''}
                onClose={() => setDecision(null)}
                onSubmit={() => void decide()}
                submitLabel="Confirm"
                submitting={busy}
            >
                {decision ? (
                    <>
                        <Text style={{ fontSize: 14, color: colors.foreground, marginBottom: spacing.md }}>
                            {decision.expense.description} · {money(decision.expense.amount)} · raised by {personName(decision.expense.requester)}
                        </Text>
                        {decision.decision === 'PAID' ? (
                            <>
                                <ChipSelect label="Paid by *" wrap options={EXPENSE_METHODS.map((m) => ({ value: m, label: humanize(m) }))} value={method || null} onChange={setMethod} />
                                <TextField label="Reference (cheque, M-Pesa code…)" value={reference} onChangeText={setReference} />
                            </>
                        ) : (
                            <TextField
                                label="Note"
                                value={note}
                                onChangeText={setNote}
                                multiline
                                placeholder={decision.decision === 'REJECT' ? 'Say why, so it can be corrected.' : undefined}
                            />
                        )}
                    </>
                ) : null}
            </FormSheet>
        </>
    );
}
