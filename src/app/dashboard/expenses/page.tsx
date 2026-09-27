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
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { date, humanize, money, personName, today } from '@/lib/ops/format';
import { EXPENSE_METHODS, type ExpenseStatus } from '@/lib/ops/resources/finance';
import type { PersonName } from '@/lib/ops/resource';

interface Expense {
    id: string; description: string; amount: number; expense_date: string; status: ExpenseStatus;
    payment_method: string | null; reference: string | null; decision_note: string | null; requested_by: string | null;
    supplier: { name: string } | null; vote_head: { name: string } | null;
    requester: PersonName | null; decider: PersonName | null;
}
interface Named { id: string; name: string }

const STATUS_TONES: Record<ExpenseStatus, PillTone> = { PENDING: 'warn', APPROVED: 'info', REJECTED: 'bad', PAID: 'good' };

type Decision = { expense: Expense; decision: 'APPROVE' | 'REJECT' | 'PAID' };

function useExpenseFields(): readonly FieldDef<FieldName<'expenses'>>[] {
    const suppliers = useOpsList<Named>('suppliers');
    const voteHeads = useOpsList<Named>('vote-heads', {}, { enabled: true });
    return [
        { name: 'description', label: 'What for', kind: 'text', required: true, span: 'full' },
        { name: 'amount', label: 'Amount (KES)', kind: 'number', required: true },
        { name: 'expense_date', label: 'Date', kind: 'date', required: true },
        { name: 'supplier_id', label: 'Supplier', kind: 'options', options: suppliers.rows.map(s => ({ id: s.id, label: s.name })) },
        { name: 'vote_head_id', label: 'Vote head', kind: 'options', options: voteHeads.rows.map(v => ({ id: v.id, label: v.name })) },
        { name: 'payment_method', label: 'Payment method', kind: 'enum', values: EXPENSE_METHODS },
        { name: 'reference', label: 'Invoice / reference', kind: 'text' },
    ];
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
            toast.success(decision.decision === 'PAID' ? 'Marked paid.' : decision.decision === 'APPROVE' ? 'Approved.' : 'Rejected.');
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
        { key: 'status', header: 'Status', render: (e: Expense) => <StatusPill status={e.status} tones={STATUS_TONES} /> },
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
                                defaults={{ expense_date: today() }}
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
                                defaults={{ expense_date: today() }}
                                searchText={e => `${e.description} ${e.supplier?.name ?? ''} ${e.vote_head?.name ?? ''}`}
                                header={rows => {
                                    const sum = (s: ExpenseStatus[]) => rows.filter(r => s.includes(r.status)).reduce((n, r) => n + Number(r.amount), 0);
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
                                        {e.status === 'PENDING' && e.requested_by !== profile?.id && <Button size="xs" onClick={() => setDecision({ expense: e, decision: 'APPROVE' })}><Check />Approve</Button>}
                                        {e.status === 'PENDING' && <Button size="xs" variant="destructive" onClick={() => setDecision({ expense: e, decision: 'REJECT' })}><X />Reject</Button>}
                                        {e.status === 'APPROVED' && <Button size="xs" variant="outline" onClick={() => { setMethod(e.payment_method ?? ''); setDecision({ expense: e, decision: 'PAID' }); }}><Banknote />Paid</Button>}
                                    </>
                                ) : null}
                                columns={[...columns, { key: 'by', header: 'Raised by', hideOnMobile: true, render: (e: Expense) => personName(e.requester) }]}
                            />
                        ),
                    },
                    {
                        id: 'suppliers', label: 'Suppliers', icon: Truck, hue: 'slate',
                        render: () => (
                            <ResourceManager<'suppliers', Named & { phone: string | null; kra_pin: string | null; category: string | null }>
                                resource="suppliers"
                                fields={[
                                    { name: 'name', label: 'Name', kind: 'text', required: true, span: 'full' },
                                    { name: 'phone', label: 'Phone', kind: 'tel' },
                                    { name: 'email', label: 'Email', kind: 'email' },
                                    { name: 'kra_pin', label: 'KRA PIN', kind: 'text' },
                                    { name: 'category', label: 'Category', kind: 'text', hint: 'Food, stationery, fuel…' },
                                ]}
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
                title={decision?.decision === 'PAID' ? 'Mark as paid' : decision?.decision === 'APPROVE' ? 'Approve expense' : 'Reject expense'}
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
