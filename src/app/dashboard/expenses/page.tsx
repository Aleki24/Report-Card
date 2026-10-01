"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, ClipboardList, Truck, Wallet, X, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField, InputField, SelectField, TextareaField } from '@/components/ui/FormField';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { date, humanize, money, personName } from '@/lib/ops/format';
import { EXPENSE_METHODS } from '@/lib/ops/resources/finance';
import {
    EXPENSE_DECISION_DONE, EXPENSE_DECISION_TITLES, EXPENSE_TONES, SUPPLIER_FIELDS, expenseDecisions, expenseDefaults, expenseFields, expenseTotal,
    type Expense, type ExpenseDecision, type Named, type Supplier,
} from '@/lib/ops/forms/finance';

type Decision = { expense: Expense; decision: ExpenseDecision };

function useExpenseFields() {
    const suppliers = useOpsList<Named>('suppliers');
    const voteHeads = useOpsList<Named>('vote-heads');
    return expenseFields(suppliers.rows, voteHeads.rows);
}

export default function ExpensesPage() {
    const { can, profile } = useAuth();
    const approver = can('expenses.approve');
    const viewer = approver || can('expenses.view');
    const fields = useExpenseFields();
    const [decision, setDecision] = useState<Decision | null>(null);
    const [note, setNote] = useState('');
    const [method, setMethod] = useState('');
    const [reference, setReference] = useState('');
    const [busy, setBusy] = useState(false);
    const [version, setVersion] = useState(0);

    const decide = async () => {
        if (!decision) return;
        setBusy(true);
        try {
            await opsFetch(`/api/finance/expenses/${decision.expense.id}/decision`, {
                method: 'POST',
                json: { decision: decision.decision, note: note || undefined, payment_method: method || undefined, reference: reference || undefined },
            });
            toast.success(EXPENSE_DECISION_DONE[decision.decision]);
            setDecision(null);
            setNote(''); setMethod(''); setReference('');
            setVersion(v => v + 1);
        } catch (err) { toast.error(errorText(err)); }
        finally { setBusy(false); }
    };

    const columns = [
        { key: 'desc', header: 'Expense', render: (e: Expense) => <span className="font-medium">{e.description}</span> },
        { key: 'amount', header: 'Amount', numeric: true, render: (e: Expense) => money(e.amount) },
        { key: 'date', header: 'Date', hideOnMobile: true, render: (e: Expense) => date(e.expense_date) },
        { key: 'vh', header: 'Vote head', hideOnMobile: true, render: (e: Expense) => e.vote_head?.name ?? '—' },
        { key: 'status', header: 'Status', render: (e: Expense) => <StatusPill status={e.status} tones={EXPENSE_TONES} /> },
    ];

    return (
        <>
            <ModulePage
                module="expenses"
                title="Expenses"
                eyebrow="Finance"
                description="Raise payment vouchers, approve them, and track spending by vote head and supplier."
                icon={Wallet}
                hue="orange"
                tabs={[
                    {
                        id: 'mine', label: 'My requests', shortLabel: 'Mine', icon: ClipboardList, hue: 'orange', visible: can('expenses.request') && !viewer,
                        render: () => (
                            <ResourceManager<'expenses', Expense>
                                resource="expenses"
                                fields={fields}
                                canCreate
                                canEdit={e => e.status === 'PENDING'}
                                canDelete={e => e.status === 'PENDING'}
                                addLabel="Request payment"
                                defaults={expenseDefaults()}
                                columns={columns}
                            />
                        ),
                    },
                    {
                        id: 'all', label: 'Expenses', icon: Wallet, hue: 'orange', visible: viewer,
                        render: () => (
                            <ResourceManager<'expenses', Expense>
                                key={version}
                                resource="expenses"
                                fields={fields}
                                canCreate={can('expenses.request') || approver}
                                canEdit={e => approver ? e.status === 'PENDING' : e.status === 'PENDING' && e.requested_by === profile?.id}
                                canDelete={e => e.status === 'PENDING' && (approver || e.requested_by === profile?.id)}
                                addLabel="Record expense"
                                defaults={expenseDefaults()}
                                searchText={e => `${e.description} ${e.supplier?.name ?? ''} ${e.vote_head?.name ?? ''}`}
                                header={rows => {
                                    const sum = (s: Parameters<typeof expenseTotal>[1]) => expenseTotal(rows, s);
                                    return (
                                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                            <StatTile icon={ClipboardList} label="Awaiting approval" value={money(sum(['PENDING']))} tone="warn" />
                                            <StatTile icon={Check} label="Approved, unpaid" value={money(sum(['APPROVED']))} hue="blue" />
                                            <StatTile icon={Banknote} label="Paid" value={money(sum(['PAID']))} tone="good" />
                                            <StatTile icon={X} label="Rejected" value={rows.filter(r => r.status === 'REJECTED').length} hue="rose" />
                                        </div>
                                    );
                                }}
                                rowActions={e => approver ? (
                                    <>
                                        {expenseDecisions(e, profile?.id).map(d => (
                                            <Button key={d} size="xs" variant={d === 'REJECT' ? 'destructive' : d === 'PAID' ? 'outline' : 'default'}
                                                onClick={() => { if (d === 'PAID') setMethod(e.payment_method ?? ''); setDecision({ expense: e, decision: d }); }}>
                                                {d === 'APPROVE' ? <><Check />Approve</> : d === 'REJECT' ? <><X />Reject</> : <><Banknote />Paid</>}
                                            </Button>
                                        ))}
                                    </>
                                ) : null}
                                columns={[...columns, { key: 'by', header: 'Raised by', hideOnMobile: true, render: (e: Expense) => personName(e.requester) }]}
                            />
                        ),
                    },
                    {
                        id: 'suppliers', label: 'Suppliers', icon: Truck, hue: 'slate',
                        render: () => (
                            <ResourceManager<'suppliers', Supplier>
                                resource="suppliers"
                                fields={SUPPLIER_FIELDS}
                                canCreate={approver}
                                canEdit={approver}
                                canDelete={approver}
                                searchText={s => `${s.name} ${s.category ?? ''}`}
                                columns={[
                                    { key: 'name', header: 'Supplier', render: s => <span className="font-medium">{s.name}</span> },
                                    { key: 'category', header: 'Category', render: s => s.category ?? '—' },
                                    { key: 'phone', header: 'Phone', hideOnMobile: true, render: s => s.phone ?? '—' },
                                    { key: 'kra', header: 'KRA PIN', hideOnMobile: true, render: s => s.kra_pin ?? '—' },
                                ]}
                            />
                        ),
                    },
                ]}
            />

            <Modal
                isOpen={decision !== null}
                onClose={() => setDecision(null)}
                title={decision ? EXPENSE_DECISION_TITLES[decision.decision] : ''}
                footer={<>
                    <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>Cancel</Button>
                    <Button variant={decision?.decision === 'REJECT' ? 'destructive' : 'default'} onClick={decide} disabled={busy}>Confirm</Button>
                </>}
            >
                {decision && (
                    <div className="flex flex-col gap-4">
                        <p className="text-sm">{decision.expense.description} · <strong>{money(decision.expense.amount)}</strong> · raised by {personName(decision.expense.requester)}</p>
                        {decision.decision === 'PAID' ? (
                            <>
                                <FormField label="Paid by" htmlFor="exp-method" required>
                                    <SelectField id="exp-method" value={method} onChange={setMethod} options={EXPENSE_METHODS.map(m => ({ id: m, label: humanize(m) }))} />
                                </FormField>
                                <FormField label="Reference (cheque, M-Pesa code…)" htmlFor="exp-ref"><InputField id="exp-ref" value={reference} onChange={e => setReference(e.target.value)} /></FormField>
                            </>
                        ) : (
                            <FormField label="Note" htmlFor="exp-note" hint={decision.decision === 'REJECT' ? 'Say why, so it can be corrected.' : undefined}>
                                <TextareaField id="exp-note" value={note} onChange={e => setNote(e.target.value)} />
                            </FormField>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}
