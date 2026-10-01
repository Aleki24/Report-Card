import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { SchoolBankAccount } from '@shared/fees';
import {
    EMPTY_BANK_ACCOUNT, KENYA_BANKS, PAYMENT_PROVIDERS, bankAccountPayload, paymentFormFrom, paymentSettingsPayload,
    type BankAccountForm, type PaymentForm, type PaymentSettings,
} from '@shared/payments/settings';
import { Badge, Button, ButtonRow, Card, ChipSelect, ListCard, ListRow, LoadingView, SectionLabel, TextField, ToggleRow } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { SelectField } from '@/components/ops/SelectField';
import { useApi } from '@/lib/api';
import { confirmAlert } from '@/lib/confirm';
import { errorMessage } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';

const SETTINGS = '/api/school/payment-settings';
const ACCOUNTS = '/api/school/payment-settings/bank-accounts';

const stored = (has: boolean) => (has ? 'Saved — leave blank to keep' : undefined);

/**
 * How parents pay: the online provider and its keys, bank transfer and the
 * school's accounts — the web's Payments tab. Keys travel over HTTPS and are
 * never shown back; the server only says whether one is stored.
 */
export function PaymentsSetup() {
    const api = useApi();
    const toast = useToast();
    const [settings, setSettings] = useState<PaymentSettings | null>(null);
    const [form, setForm] = useState<PaymentForm | null>(null);
    const [accounts, setAccounts] = useState<SchoolBankAccount[]>([]);
    const [bank, setBank] = useState<BankAccountForm>(EMPTY_BANK_ACCOUNT);
    const [busy, setBusy] = useState<string | null>(null);

    const loadSettings = useCallback(async () => {
        try {
            const r = await api.get<{ data?: PaymentSettings }>(SETTINGS);
            if (r.data) { setSettings(r.data); setForm(paymentFormFrom(r.data)); }
        } catch (err) { toast.error(errorMessage(err, 'Could not load payment settings')); }
    }, [api, toast]);
    const loadAccounts = useCallback(async () => {
        try { setAccounts((await api.get<{ data?: SchoolBankAccount[] }>(ACCOUNTS)).data ?? []); }
        catch (err) { toast.error(errorMessage(err, 'Could not load bank accounts')); }
    }, [api, toast]);
    useEffect(() => { void loadSettings(); void loadAccounts(); }, [loadSettings, loadAccounts]);

    const run = async (key: string, work: () => Promise<unknown>, success: string, after?: () => Promise<void>) => {
        setBusy(key);
        try { await work(); toast.success(success); await after?.(); }
        catch (err) { toast.error(errorMessage(err, 'Something went wrong')); }
        finally { setBusy(null); }
    };

    if (!form || !settings) return <LoadingView />;
    const set = <K extends keyof PaymentForm>(k: K) => (v: PaymentForm[K]) => setForm((f) => f && ({ ...f, [k]: v }));
    const setBankField = (k: keyof BankAccountForm) => (v: string) => setBank((b) => ({ ...b, [k]: v }));

    const save = () => void run('save', () => api.put(SETTINGS, paymentSettingsPayload(form)), 'Payment settings saved.', loadSettings);
    const addAccount = () => {
        const body = bankAccountPayload(bank, accounts.length === 0);
        if (!body) { toast.error('Enter the bank, account name, and account number.'); return; }
        void run('add', () => api.post(ACCOUNTS, body), 'Bank account added.', async () => { setBank(EMPTY_BANK_ACCOUNT); await loadAccounts(); });
    };

    return (
        <View>
            <Card style={{ marginBottom: spacing.md }}>
                <ChipSelect label="Online payments" wrap options={PAYMENT_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))} value={form.activeProvider} onChange={set('activeProvider')} />
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: spacing.md }}>{PAYMENT_PROVIDERS.find((p) => p.value === form.activeProvider)?.description}</Text>

                {form.activeProvider === 'DARAJA' ? (
                    <>
                        <ChipSelect label="Environment" options={[{ value: 'sandbox', label: 'Sandbox' }, { value: 'production', label: 'Production' }]} value={form.environment} onChange={set('environment')} />
                        <TextField label="Paybill / Till number" value={form.shortcode} onChangeText={set('shortcode')} keyboardType="number-pad" />
                        <TextField label="Consumer key" value={form.consumerKey} onChangeText={set('consumerKey')} autoCapitalize="none" />
                        <TextField label="Consumer secret" value={form.consumerSecret} onChangeText={set('consumerSecret')} secureTextEntry placeholder={stored(settings.hasConsumerSecret)} autoCapitalize="none" />
                        <TextField label="Passkey" value={form.passkey} onChangeText={set('passkey')} secureTextEntry placeholder={stored(settings.hasPasskey)} autoCapitalize="none" />
                        <Badge variant={settings.configured ? 'success' : 'warning'} label={settings.configured ? 'Daraja configured' : 'Daraja not configured yet'} />
                    </>
                ) : null}

                {form.activeProvider === 'PESAPAL' ? (
                    <>
                        <ChipSelect label="Environment" options={[{ value: 'sandbox', label: 'Sandbox' }, { value: 'live', label: 'Live' }]} value={form.pesapalEnvironment} onChange={set('pesapalEnvironment')} />
                        <TextField label="Consumer key" value={form.pesapalConsumerKey} onChangeText={set('pesapalConsumerKey')} autoCapitalize="none" />
                        <TextField label="Consumer secret" value={form.pesapalConsumerSecret} onChangeText={set('pesapalConsumerSecret')} secureTextEntry placeholder={stored(settings.hasPesapalConsumerSecret)} autoCapitalize="none" />
                        <Badge variant={settings.pesapalConfigured ? 'success' : 'warning'} label={settings.pesapalConfigured ? 'Pesapal configured' : 'Pesapal not configured yet'} />
                    </>
                ) : null}

                <ToggleRow label="Bank transfers" description="Show the school's bank accounts to parents on the fees page." value={form.bankEnabled} onValueChange={set('bankEnabled')} />
                <ButtonRow>
                    {form.activeProvider === 'DARAJA' && settings.configured ? (
                        <Button
                            variant="secondary"
                            label="Register callback URLs"
                            loading={busy === 'register'}
                            onPress={() => void run('register', () => api.post(`${SETTINGS}/register-urls`), 'Callback URLs registered with Safaricom.')}
                        />
                    ) : null}
                    <Button label="Save" loading={busy === 'save'} onPress={save} />
                </ButtonRow>
            </Card>

            <SectionLabel>Bank accounts</SectionLabel>
            {accounts.length > 0 ? (
                <ListCard>
                    {accounts.map((a) => (
                        <ListRow
                            key={a.id}
                            title={`${a.bankName} · ${a.accountNumber}`}
                            subtitle={`${a.accountName}${a.branch ? ` · ${a.branch}` : ''}`}
                            right={(
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    {a.isPrimary ? <Badge label="Primary" variant="info" /> : (
                                        <Button size="sm" variant="ghost" label="Make primary" disabled={busy !== null}
                                            onPress={() => void run(a.id, () => api.put(`${ACCOUNTS}/${a.id}`, { is_primary: true }), 'Primary account updated.', loadAccounts)} />
                                    )}
                                    <Button size="sm" variant="ghost" label="Remove" disabled={busy !== null}
                                        onPress={() => confirmAlert('Remove this bank account?', `${a.bankName} · ${a.accountNumber}`, [
                                            { text: 'Cancel', style: 'cancel' },
                                            { text: 'Remove', style: 'destructive', onPress: () => void run(a.id, () => api.del(`${ACCOUNTS}/${a.id}`), `${a.bankName} account removed`, loadAccounts) },
                                        ])} />
                                </View>
                            )}
                        />
                    ))}
                </ListCard>
            ) : <Text style={{ color: colors.muted, fontSize: 13 }}>No bank accounts yet.</Text>}

            <Card style={{ marginTop: spacing.md }}>
                <Text style={{ fontWeight: '700', color: colors.foreground, marginBottom: spacing.sm }}>Add a bank account</Text>
                <SelectField label="Bank" value={bank.bank} onChange={setBankField('bank')} options={KENYA_BANKS.map((b) => ({ id: b, label: b }))} />
                {bank.bank === 'Other' ? <TextField label="Bank name" value={bank.otherBank} onChangeText={setBankField('otherBank')} /> : null}
                <TextField label="Account name" value={bank.accountName} onChangeText={setBankField('accountName')} />
                <TextField label="Account number" value={bank.accountNumber} onChangeText={setBankField('accountNumber')} keyboardType="number-pad" />
                <TextField label="Branch (optional)" value={bank.branch} onChangeText={setBankField('branch')} />
                <Button label="Add account" loading={busy === 'add'} onPress={addAccount} block />
            </Card>
        </View>
    );
}
