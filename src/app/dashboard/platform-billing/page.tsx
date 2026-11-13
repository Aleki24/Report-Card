"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Receipt, Smartphone } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import { Button } from '@/components/ui/Button';
import { FormField, InputField, TextareaField } from '@/components/ui/FormField';
import { LoadError } from '@/components/ui/LoadError';
import { StatusPill } from '@/components/billing/SubscriptionTab';
import { jsonBody, requestJson } from '@/lib/api-error-message';
import { formatIsoDate } from '@/lib/dates';
import { formatKes } from '@/lib/pricing';
import { PLATFORM_BILLING_URL, type InvoiceAction, type PaymentInstructions, type PlatformSchoolBilling, type SchoolInvoice } from '@/lib/school-billing';

interface Data { schools: PlatformSchoolBilling[]; instructions: PaymentInstructions }
type Load = { state: 'loading' } | { state: 'ready'; data: Data } | { state: 'error'; message: string } | { state: 'forbidden' };

/** Where schools pay: the owner's Paybill, till and bank, shown on every unpaid invoice. */
function PaymentDetails({ initial, onSaved }: { initial: PaymentInstructions; onSaved: () => void }) {
    const [form, setForm] = useState(initial);
    const [saving, setSaving] = useState(false);
    const set = (k: keyof PaymentInstructions) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
    const save = async () => {
        setSaving(true);
        try {
            await requestJson(`${PLATFORM_BILLING_URL}/settings`, jsonBody('PUT', form));
            toast.success('Payment details saved.');
            onSaved();
        } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save.'); }
        finally { setSaving(false); }
    };
    return (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Smartphone className="size-4 text-primary" aria-hidden />Where schools pay</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Paybill" htmlFor="pb"><InputField id="pb" inputMode="numeric" value={form.paybill} onChange={set('paybill')} /></FormField>
                <FormField label="Account (blank: school name)" htmlFor="acc"><InputField id="acc" value={form.account} onChange={set('account')} /></FormField>
                <FormField label="Till" htmlFor="till"><InputField id="till" inputMode="numeric" value={form.till} onChange={set('till')} /></FormField>
                <FormField label="Phone for questions" htmlFor="ph"><InputField id="ph" type="tel" value={form.phone} onChange={set('phone')} /></FormField>
                <FormField label="Bank" htmlFor="bank" className="sm:col-span-2 lg:col-span-4"><TextareaField id="bank" rows={2} value={form.bank} onChange={set('bank')} placeholder="Bank, branch, account name and number" /></FormField>
            </div>
            <div className="mt-3 flex justify-end"><Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
        </section>
    );
}

/** One school's current invoice and the owner's buttons: paid, waive, void. */
function SchoolRow({ school, onDone }: { school: PlatformSchoolBilling; onDone: () => void }) {
    const invoice: SchoolInvoice | null = school.state.kind === 'none' ? null : school.state.invoice;
    const [paying, setPaying] = useState(false);
    const [ref, setRef] = useState('');
    const [amount, setAmount] = useState(String(invoice?.amount ?? 0));
    const [busy, setBusy] = useState(false);
    const act = async (action: InvoiceAction, done: string) => {
        if (!invoice) return;
        setBusy(true);
        try {
            await requestJson(`${PLATFORM_BILLING_URL}/${invoice.id}`, jsonBody('POST', action));
            toast.success(done);
            setPaying(false);
            onDone();
        } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save.'); }
        finally { setBusy(false); }
    };
    return (
        <li className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-bold">{school.schoolName}</h3>
                <StatusPill state={school.state} />
            </div>
            <p className="text-sm text-muted-foreground">
                {school.learners.toLocaleString()} learners
                {invoice && <> · {invoice.label} · <span className="font-semibold text-foreground">{formatKes(invoice.amount)}</span> · due {formatIsoDate(invoice.dueDate, { day: 'numeric', month: 'short' })}</>}
            </p>
            {invoice?.status === 'DUE' && !paying && (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setPaying(true)}>Mark paid</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void act({ action: 'waive' }, 'Waived.')}>Waive</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act({ action: 'void' }, 'Voided.')}>Void</Button>
                </div>
            )}
            {paying && invoice && (
                <div className="grid gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                    <FormField label="M-Pesa code or bank reference" htmlFor={`ref-${invoice.id}`}><InputField id={`ref-${invoice.id}`} value={ref} onChange={e => setRef(e.target.value)} autoFocus /></FormField>
                    <FormField label="Amount (KES)" htmlFor={`amt-${invoice.id}`}><InputField id={`amt-${invoice.id}`} inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} /></FormField>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setPaying(false)}>Cancel</Button>
                        <Button disabled={busy || ref.trim().length < 3} onClick={() => void act({ action: 'paid', payment_ref: ref.trim(), amount: Number(amount) || 0 }, 'Marked paid.')}>Save</Button>
                    </div>
                </div>
            )}
        </li>
    );
}

/** The platform owner's billing: where schools pay, and each school's invoice for this term. */
export default function PlatformBillingPage() {
    const [load, setLoad] = useState<Load>({ state: 'loading' });
    const reload = useCallback(async () => {
        try {
            const res = await fetch(PLATFORM_BILLING_URL, { cache: 'no-store' });
            if (res.status === 401 || res.status === 403) { setLoad({ state: 'forbidden' }); return; }
            const body = (await res.json().catch(() => null)) as { data?: Data; error?: string } | null;
            if (!res.ok || !body?.data) throw new Error(body?.error ?? 'Could not load billing.');
            setLoad({ state: 'ready', data: body.data });
        } catch (err) {
            setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Could not load billing.' });
        }
    }, []);
    useEffect(() => { void reload(); }, [reload]);

    const due = load.state === 'ready' ? load.data.schools.filter(s => s.state.kind === 'due' || s.state.kind === 'overdue' || s.state.kind === 'locked') : [];
    const owed = due.reduce((n, s) => n + (s.state.kind === 'none' ? 0 : s.state.invoice.amount), 0);

    return (
        <div className="mx-auto w-full max-w-7xl pb-10">
            <PageHeader title="School billing" eyebrow="Platform" icon={Receipt} hue="emerald"
                action={<Link href="/dashboard/pending-schools" className="btn-secondary h-9">Pending schools</Link>} />
            {load.state === 'loading' && <div className="skeleton-bone h-64 rounded-2xl" />}
            {load.state === 'forbidden' && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Only the platform owner can see this.</p>}
            {load.state === 'error' && <LoadError title="Couldn't load billing" message={load.message} onRetry={() => void reload()} />}
            {load.state === 'ready' && (
                <div className="flex flex-col gap-4">
                    <PaymentDetails initial={load.data.instructions} onSaved={() => void reload()} />
                    <p className="text-sm"><span className="font-semibold">{due.length} unpaid</span> · {formatKes(owed)} owed</p>
                    <ul className="grid gap-3 md:grid-cols-2">
                        {load.data.schools.map(s => <SchoolRow key={s.schoolId} school={s} onDone={() => void reload()} />)}
                    </ul>
                </div>
            )}
        </div>
    );
}
