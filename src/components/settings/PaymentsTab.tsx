"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Trash2, Star } from 'lucide-react';
import { InfoGuide } from '@/components/ui/InfoGuide';
import type { FeePayment, PaymentProvider, SchoolBankAccount } from '@/lib/fees';

const KENYA_BANKS = [
    'KCB Bank', 'Equity Bank', 'Co-operative Bank', 'NCBA Bank', 'Absa Bank Kenya',
    'Standard Chartered Bank', 'Stanbic Bank', 'Diamond Trust Bank (DTB)', 'Family Bank',
    'I&M Bank', 'National Bank of Kenya', 'Sidian Bank', 'Prime Bank', 'Bank of Africa',
    'Housing Finance Company (HFC)', 'Other',
];

interface PaymentSettings {
    activeProvider: PaymentProvider;
    bankEnabled: boolean;
    // Daraja
    environment: 'sandbox' | 'production';
    shortcode: string;
    consumerKey: string;
    hasPasskey: boolean;
    hasConsumerSecret: boolean;
    configured: boolean;
    // Pesapal
    pesapalEnvironment: 'sandbox' | 'live';
    pesapalConsumerKey: string;
    hasPesapalConsumerSecret: boolean;
    pesapalConfigured: boolean;
}

interface TermOption { id: string; name: string; }

const PROVIDERS: { value: PaymentProvider; label: string; description: string }[] = [
    { value: 'NONE', label: 'None', description: 'No online payments — record fees manually only.' },
    { value: 'DARAJA', label: 'M-Pesa (Direct)', description: 'Your own Safaricom Paybill/Till via the Daraja API.' },
    { value: 'PESAPAL', label: 'Pesapal', description: 'M-Pesa, cards, and more via a Pesapal merchant account — no Safaricom developer app needed.' },
];

export function PaymentsTab() {
    const [settings, setSettings] = useState<PaymentSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [registering, setRegistering] = useState(false);

    const [activeProvider, setActiveProvider] = useState<PaymentProvider>('NONE');
    const [bankEnabled, setBankEnabled] = useState(false);

    // Bank transfer
    const [bankAccounts, setBankAccounts] = useState<SchoolBankAccount[]>([]);
    const [bankAccountsLoading, setBankAccountsLoading] = useState(true);
    const [newBankChoice, setNewBankChoice] = useState(KENYA_BANKS[0]);
    const [newBankOther, setNewBankOther] = useState('');
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountNumber, setNewAccountNumber] = useState('');
    const [newBranch, setNewBranch] = useState('');
    const [addingBankAccount, setAddingBankAccount] = useState(false);
    const [bankAccountBusyId, setBankAccountBusyId] = useState<string | null>(null);

    // Daraja
    const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
    const [shortcode, setShortcode] = useState('');
    const [consumerKey, setConsumerKey] = useState('');
    const [consumerSecret, setConsumerSecret] = useState('');
    const [passkey, setPasskey] = useState('');

    // Pesapal
    const [pesapalEnvironment, setPesapalEnvironment] = useState<'sandbox' | 'live'>('sandbox');
    const [pesapalConsumerKey, setPesapalConsumerKey] = useState('');
    const [pesapalConsumerSecret, setPesapalConsumerSecret] = useState('');

    const [unmatched, setUnmatched] = useState<FeePayment[]>([]);
    const [unmatchedLoading, setUnmatchedLoading] = useState(true);
    const [terms, setTerms] = useState<TermOption[]>([]);
    const [assignTerm, setAssignTerm] = useState<Record<string, string>>({});
    const [assignAdmission, setAssignAdmission] = useState<Record<string, string>>({});
    const [assigning, setAssigning] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/school/payment-settings');
            const json = await res.json();
            if (json.data) {
                setSettings(json.data);
                setActiveProvider(json.data.activeProvider);
                setBankEnabled(json.data.bankEnabled);
                setEnvironment(json.data.environment);
                setShortcode(json.data.shortcode);
                setConsumerKey(json.data.consumerKey);
                setPesapalEnvironment(json.data.pesapalEnvironment);
                setPesapalConsumerKey(json.data.pesapalConsumerKey);
            }
        } catch (err) {
            console.error('Failed to load payment settings:', err);
        }
        setLoading(false);
    }, []);

    const fetchBankAccounts = useCallback(async () => {
        setBankAccountsLoading(true);
        try {
            const res = await fetch('/api/school/payment-settings/bank-accounts');
            const json = await res.json();
            setBankAccounts(json.data || []);
        } catch (err) {
            console.error('Failed to load bank accounts:', err);
        }
        setBankAccountsLoading(false);
    }, []);

    const fetchUnmatched = useCallback(async () => {
        setUnmatchedLoading(true);
        try {
            const res = await fetch('/api/school/fees/unmatched');
            const json = await res.json();
            setUnmatched(json.data || []);
        } catch (err) {
            console.error('Failed to load unmatched payments:', err);
        }
        setUnmatchedLoading(false);
    }, []);

    useEffect(() => {
        fetchSettings();
        fetchUnmatched();
        fetchBankAccounts();
        fetch('/api/school/data?type=terms').then(r => r.json()).then(j => setTerms((j.data || []).map((t: any) => ({ id: t.id, name: t.name })))).catch(() => {});
    }, [fetchSettings, fetchUnmatched, fetchBankAccounts]);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/school/payment-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    active_provider: activeProvider,
                    bank_enabled: bankEnabled,
                    environment,
                    shortcode: shortcode || null,
                    consumer_key: consumerKey || undefined,
                    consumer_secret: consumerSecret || undefined,
                    passkey: passkey || undefined,
                    pesapal_environment: pesapalEnvironment,
                    pesapal_consumer_key: pesapalConsumerKey || undefined,
                    pesapal_consumer_secret: pesapalConsumerSecret || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to save');
            toast.success('Payment settings saved.');
            setConsumerSecret('');
            setPasskey('');
            setPesapalConsumerSecret('');
            await fetchSettings();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save settings');
        }
        setSaving(false);
    };

    const registerUrls = async () => {
        setRegistering(true);
        try {
            const res = await fetch('/api/school/payment-settings/register-urls', { method: 'POST' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to register URLs');
            toast.success('Callback URLs registered with Safaricom.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to register URLs');
        }
        setRegistering(false);
    };

    const addBankAccount = async () => {
        const bankName = newBankChoice === 'Other' ? newBankOther.trim() : newBankChoice;
        if (!bankName || !newAccountName.trim() || !newAccountNumber.trim()) {
            toast.error('Enter the bank, account name, and account number.');
            return;
        }
        setAddingBankAccount(true);
        try {
            const res = await fetch('/api/school/payment-settings/bank-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bank_name: bankName,
                    account_name: newAccountName.trim(),
                    account_number: newAccountNumber.trim(),
                    branch: newBranch.trim() || undefined,
                    is_primary: bankAccounts.length === 0,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to add bank account');
            toast.success('Bank account added.');
            setNewBankChoice(KENYA_BANKS[0]);
            setNewBankOther('');
            setNewAccountName('');
            setNewAccountNumber('');
            setNewBranch('');
            await fetchBankAccounts();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add bank account');
        }
        setAddingBankAccount(false);
    };

    const makeBankAccountPrimary = async (account: SchoolBankAccount) => {
        setBankAccountBusyId(account.id);
        try {
            const res = await fetch(`/api/school/payment-settings/bank-accounts/${account.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_primary: true }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to update bank account');
            await fetchBankAccounts();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update bank account');
        }
        setBankAccountBusyId(null);
    };

    const deleteBankAccount = async (account: SchoolBankAccount) => {
        if (!confirm(`Remove ${account.bankName} — ${account.accountNumber}? Parents will no longer see it as a pay-in option.`)) return;
        setBankAccountBusyId(account.id);
        try {
            const res = await fetch(`/api/school/payment-settings/bank-accounts/${account.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to remove bank account');
            await fetchBankAccounts();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to remove bank account');
        }
        setBankAccountBusyId(null);
    };

    const assignPayment = async (payment: FeePayment) => {
        const admission = (assignAdmission[payment.id] || '').trim();
        const termId = assignTerm[payment.id];
        if (!admission || !termId) {
            toast.error('Enter an admission number and pick a term.');
            return;
        }
        setAssigning(payment.id);
        try {
            const feesRes = await fetch(`/api/school/fees?term_id=${termId}`);
            const feesJson = await feesRes.json();
            const match = (feesJson.data || []).find(
                (f: any) => f.admissionNumber?.toLowerCase() === admission.toLowerCase()
            );
            if (!match) {
                toast.error('No fee record found for that admission number in this term. Create one from the Fees list first.');
                setAssigning(null);
                return;
            }
            const res = await fetch(`/api/school/fees/unmatched/${payment.id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_fee_id: match.id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to assign');
            toast.success('Payment assigned.');
            await fetchUnmatched();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to assign payment');
        }
        setAssigning(null);
    };

    if (loading) {
        return <div className="lg:col-span-3 p-12 text-center text-muted-foreground">Loading payment settings...</div>;
    }

    return (
        <div className="lg:col-span-3 flex flex-col gap-6">
            <InfoGuide title="How online fee collection works:">
                <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                    <li><strong>M-Pesa (Direct)</strong> uses your own Safaricom Paybill/Till via a Daraja API app — get these from <strong>developer.safaricom.co.ke</strong> and your Safaricom business account.</li>
                    <li><strong>Pesapal</strong> uses a Pesapal merchant account instead — supports M-Pesa, cards, and more, and doesn&apos;t require your own Safaricom developer app. Sign up at <strong>pesapal.com</strong>.</li>
                    <li>Pick one automated provider at a time — students see a single &quot;Pay&quot; button matching whichever is active.</li>
                    <li><strong>Bank Transfer</strong> is separate and can be switched on alongside either provider (or on its own) — it just shows your account details as pay-in instructions; the bursar records each deposit manually once it clears.</li>
                    <li>Payments that can&apos;t be matched to a student&apos;s current-term bill land below for manual assignment.</li>
                </ul>
            </InfoGuide>

            <div className="card p-5">
                <h3 className="font-bold text-sm mb-4">Payment Provider</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PROVIDERS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setActiveProvider(p.value)}
                            className={`rounded-xl border p-3 text-left transition-colors ${activeProvider === p.value ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'}`}
                        >
                            <div className="text-sm font-semibold">{p.label}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">{p.description}</div>
                        </button>
                    ))}
                </div>
            </div>

            {activeProvider === 'DARAJA' && (
                <div className="card p-5">
                    <h3 className="font-bold text-sm mb-4">M-Pesa Daraja Credentials</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Environment</label>
                            <select className="input-field w-full" value={environment} onChange={e => setEnvironment(e.target.value as 'sandbox' | 'production')}>
                                <option value="sandbox">Sandbox (testing)</option>
                                <option value="production">Production (live)</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Paybill / Till Number (Shortcode)</label>
                            <input type="text" className="input-field w-full" value={shortcode} onChange={e => setShortcode(e.target.value)} placeholder="e.g. 174379" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Consumer Key</label>
                            <input type="text" className="input-field w-full" value={consumerKey} onChange={e => setConsumerKey(e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Consumer Secret</label>
                            <input
                                type="password"
                                className="input-field w-full"
                                value={consumerSecret}
                                onChange={e => setConsumerSecret(e.target.value)}
                                placeholder={settings?.hasConsumerSecret ? '•••••••• (set — leave blank to keep)' : 'Not set'}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Passkey</label>
                            <input
                                type="password"
                                className="input-field w-full"
                                value={passkey}
                                onChange={e => setPasskey(e.target.value)}
                                placeholder={settings?.hasPasskey ? '•••••••• (set — leave blank to keep)' : 'Not set'}
                            />
                        </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <button className="btn-secondary" onClick={registerUrls} disabled={registering || !settings?.configured}>
                            {registering ? 'Registering...' : 'Register Callback URLs with Safaricom'}
                        </button>
                    </div>
                    {!settings?.configured && (
                        <p className="mt-2 text-[11px] text-muted-foreground">Save a shortcode, consumer key/secret, and passkey before registering callback URLs.</p>
                    )}
                </div>
            )}

            {activeProvider === 'PESAPAL' && (
                <div className="card p-5">
                    <h3 className="font-bold text-sm mb-4">Pesapal Credentials</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Environment</label>
                            <select className="input-field w-full" value={pesapalEnvironment} onChange={e => setPesapalEnvironment(e.target.value as 'sandbox' | 'live')}>
                                <option value="sandbox">Sandbox (testing)</option>
                                <option value="live">Live</option>
                            </select>
                        </div>
                        <div />
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Pesapal Consumer Key</label>
                            <input type="text" className="input-field w-full" value={pesapalConsumerKey} onChange={e => setPesapalConsumerKey(e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Pesapal Consumer Secret</label>
                            <input
                                type="password"
                                className="input-field w-full"
                                value={pesapalConsumerSecret}
                                onChange={e => setPesapalConsumerSecret(e.target.value)}
                                placeholder={settings?.hasPesapalConsumerSecret ? '•••••••• (set — leave blank to keep)' : 'Not set'}
                            />
                        </div>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                        Saving with Pesapal selected automatically registers your payment-notification URL with Pesapal — no separate step needed.
                        {settings?.pesapalConfigured ? ' Currently registered and ready.' : ''}
                    </p>
                </div>
            )}

            <div className="card p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-sm">Bank Transfer</h3>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                            Show your bank account(s) as a pay-in option alongside {activeProvider === 'NONE' ? 'M-Pesa/Pesapal' : PROVIDERS.find(p => p.value === activeProvider)?.label}.
                            Deposits are always reconciled manually — there&apos;s no automatic bank webhook, so record each one under Fees once it clears.
                        </p>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={bankEnabled} onChange={e => setBankEnabled(e.target.checked)} />
                        <span className="text-xs font-semibold">{bankEnabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                </div>

                {bankAccountsLoading ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
                ) : (
                    <>
                        {bankAccounts.length > 0 && (
                            <div className="mb-4 flex flex-col gap-2">
                                {bankAccounts.map(a => (
                                    <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-3">
                                        <div className="min-w-[180px] flex-1">
                                            <div className="flex items-center gap-1.5 text-sm font-semibold">
                                                {a.isPrimary && <Star size={12} className="fill-amber-400 text-amber-400" />}
                                                {a.bankName}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {a.accountName} · {a.accountNumber}{a.branch ? ` · ${a.branch}` : ''}
                                            </div>
                                        </div>
                                        {!a.isPrimary && (
                                            <button
                                                className="btn-secondary"
                                                style={{ height: 30, fontSize: 11 }}
                                                onClick={() => makeBankAccountPrimary(a)}
                                                disabled={bankAccountBusyId === a.id}
                                            >
                                                Make Primary
                                            </button>
                                        )}
                                        <button
                                            className="btn-icon text-destructive/80 hover:text-destructive"
                                            onClick={() => deleteBankAccount(a)}
                                            disabled={bankAccountBusyId === a.id}
                                            title="Remove"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="rounded-xl border border-dashed border-border/60 p-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Bank</label>
                                    <select className="input-field w-full" value={newBankChoice} onChange={e => setNewBankChoice(e.target.value)}>
                                        {KENYA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                {newBankChoice === 'Other' && (
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Bank Name</label>
                                        <input type="text" className="input-field w-full" value={newBankOther} onChange={e => setNewBankOther(e.target.value)} placeholder="e.g. Sidian Bank" />
                                    </div>
                                )}
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Account Name</label>
                                    <input type="text" className="input-field w-full" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} placeholder="e.g. Green Hills Academy" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Account Number</label>
                                    <input type="text" className="input-field w-full" value={newAccountNumber} onChange={e => setNewAccountNumber(e.target.value)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Branch (optional)</label>
                                    <input type="text" className="input-field w-full" value={newBranch} onChange={e => setNewBranch(e.target.value)} placeholder="e.g. Westlands" />
                                </div>
                            </div>
                            <div className="mt-3 flex">
                                <button className="btn-secondary" onClick={addBankAccount} disabled={addingBankAccount}>
                                    {addingBankAccount ? 'Adding...' : 'Add Bank Account'}
                                </button>
                            </div>
                        </div>
                        {bankEnabled && bankAccounts.length === 0 && (
                            <p className="mt-2 text-[11px] text-destructive">Add at least one bank account above before saving with bank transfer enabled.</p>
                        )}
                    </>
                )}
            </div>

            <div className="flex">
                <button className="btn-primary" onClick={saveSettings} disabled={saving}>
                    {saving ? 'Saving...' : (activeProvider === 'NONE' && !bankEnabled) ? 'Save (Disable Online Payments)' : 'Save Settings'}
                </button>
            </div>

            <div className="card p-5">
                <h3 className="font-bold text-sm mb-1">Unmatched Payments</h3>
                <p className="text-xs text-muted-foreground mb-4">Money confirmed but not yet matched to a student&apos;s current-term bill.</p>
                {unmatchedLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
                ) : unmatched.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nothing to reconcile — all payments matched automatically.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {unmatched.map(p => (
                            <div key={p.id} className="rounded-xl border border-border/60 p-3 flex flex-wrap items-end gap-3">
                                <div className="min-w-[160px]">
                                    <div className="text-sm font-semibold">KSh {p.amount.toLocaleString()}</div>
                                    <div className="text-[11px] text-muted-foreground">
                                        Ref &quot;{p.unmatchedAccountReference}&quot; · {p.phoneNumber || '—'} · {new Date(p.paidAt).toLocaleDateString('en-GB')}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-[140px]">
                                    <input
                                        type="text"
                                        className="input-field w-full"
                                        style={{ height: 32, fontSize: 12 }}
                                        placeholder="Admission number"
                                        value={assignAdmission[p.id] || ''}
                                        onChange={e => setAssignAdmission(prev => ({ ...prev, [p.id]: e.target.value }))}
                                    />
                                </div>
                                <div className="flex-1 min-w-[140px]">
                                    <select
                                        className="input-field w-full"
                                        style={{ height: 32, fontSize: 12 }}
                                        value={assignTerm[p.id] || ''}
                                        onChange={e => setAssignTerm(prev => ({ ...prev, [p.id]: e.target.value }))}
                                    >
                                        <option value="">Term...</option>
                                        {terms.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button className="btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => assignPayment(p)} disabled={assigning === p.id}>
                                    {assigning === p.id ? 'Assigning...' : 'Assign'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
