/**
 * The school's payment setup as the settings screens edit it: provider,
 * Daraja and Pesapal keys (secrets are write-only: the server only says
 * whether one is stored), and bank accounts. Platform-neutral: the web
 * Payments tab and the mobile app share it.
 */
import type { PaymentProvider } from '../fees';

export const KENYA_BANKS = [
    'KCB Bank', 'Equity Bank', 'Co-operative Bank', 'NCBA Bank', 'Absa Bank Kenya',
    'Standard Chartered Bank', 'Stanbic Bank', 'Diamond Trust Bank (DTB)', 'Family Bank',
    'I&M Bank', 'National Bank of Kenya', 'Sidian Bank', 'Prime Bank', 'Bank of Africa',
    'Housing Finance Company (HFC)', 'Other',
] as const;

export interface PaymentSettings {
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

export const PAYMENT_PROVIDERS: readonly { value: PaymentProvider; label: string; description: string }[] = [
    { value: 'NONE', label: 'None', description: 'No online payments — record fees manually only.' },
    { value: 'DARAJA', label: 'M-Pesa (Direct)', description: 'Your own Safaricom Paybill/Till via the Daraja API.' },
    { value: 'PESAPAL', label: 'Pesapal', description: 'M-Pesa, cards, and more via a Pesapal merchant account — no Safaricom developer app needed.' },
];

/** What the settings form edits; secrets start blank and are only sent when typed. */
export interface PaymentForm {
    activeProvider: PaymentProvider;
    bankEnabled: boolean;
    environment: 'sandbox' | 'production';
    shortcode: string;
    consumerKey: string;
    consumerSecret: string;
    passkey: string;
    pesapalEnvironment: 'sandbox' | 'live';
    pesapalConsumerKey: string;
    pesapalConsumerSecret: string;
}

export const paymentFormFrom = (s: PaymentSettings): PaymentForm => ({
    activeProvider: s.activeProvider,
    bankEnabled: s.bankEnabled,
    environment: s.environment,
    shortcode: s.shortcode,
    consumerKey: s.consumerKey,
    consumerSecret: '',
    passkey: '',
    pesapalEnvironment: s.pesapalEnvironment,
    pesapalConsumerKey: s.pesapalConsumerKey,
    pesapalConsumerSecret: '',
});

/** The PUT body: blank secrets are left out so the stored ones are kept. */
export const paymentSettingsPayload = (f: PaymentForm) => ({
    active_provider: f.activeProvider,
    bank_enabled: f.bankEnabled,
    environment: f.environment,
    shortcode: f.shortcode || null,
    consumer_key: f.consumerKey || undefined,
    consumer_secret: f.consumerSecret || undefined,
    passkey: f.passkey || undefined,
    pesapal_environment: f.pesapalEnvironment,
    pesapal_consumer_key: f.pesapalConsumerKey || undefined,
    pesapal_consumer_secret: f.pesapalConsumerSecret || undefined,
});

export interface BankAccountForm { bank: string; otherBank: string; accountName: string; accountNumber: string; branch: string }
export const EMPTY_BANK_ACCOUNT: BankAccountForm = { bank: KENYA_BANKS[0], otherBank: '', accountName: '', accountNumber: '', branch: '' };

/** The POST body for a new account, or null when something required is missing. The first account becomes primary. */
export function bankAccountPayload(f: BankAccountForm, isFirst: boolean) {
    const bankName = f.bank === 'Other' ? f.otherBank.trim() : f.bank;
    if (!bankName || !f.accountName.trim() || !f.accountNumber.trim()) return null;
    return { bank_name: bankName, account_name: f.accountName.trim(), account_number: f.accountNumber.trim(), branch: f.branch.trim() || undefined, is_primary: isFirst };
}
