"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { InfoGuide } from '@/components/ui/InfoGuide';
import type { FeePayment, PaymentProvider } from '@/lib/fees';

interface PaymentSettings {
    activeProvider: PaymentProvider;
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
        fetch('/api/school/data?type=terms').then(r => r.json()).then(j => setTerms((j.data || []).map((t: any) => ({ id: t.id, name: t.name })))).catch(() => {});
    }, [fetchSettings, fetchUnmatched]);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/school/payment-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    active_provider: activeProvider,
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
                    <li>Pick one provider at a time — students see a single &quot;Pay&quot; option matching whichever is active.</li>
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

            <div className="flex">
                <button className="btn-primary" onClick={saveSettings} disabled={saving}>
                    {saving ? 'Saving...' : activeProvider === 'NONE' ? 'Save (Disable Online Payments)' : 'Save Settings'}
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
