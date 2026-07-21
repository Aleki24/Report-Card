/**
 * mpesa.ts
 * Minimal Safaricom Daraja API client: OAuth, STK Push (Lipa na M-Pesa
 * Online), and C2B URL registration. Each school supplies its own
 * Paybill/Till + app credentials (see school_payment_settings) — there is
 * no global M-Pesa account for this multi-tenant app.
 *
 * Reference: https://developer.safaricom.co.ke/ (Daraja API docs).
 * This API has been stable and unchanged in shape since ~2018.
 */

export type MpesaEnvironment = 'sandbox' | 'production';

export interface MpesaCredentials {
    environment: MpesaEnvironment;
    shortcode: string;
    passkey: string;
    consumerKey: string;
    consumerSecret: string;
}

function baseUrl(environment: MpesaEnvironment): string {
    return environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

/** YYYYMMDDHHmmss in the school's local time, as Daraja expects. */
function getTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

/**
 * Normalizes Kenyan phone numbers to the 2547XXXXXXXX / 2541XXXXXXXX form
 * Daraja requires, accepting the common local formats (07.., +2547.., 2547..).
 */
export function normalizeMpesaPhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
    if (/^254[17]\d{8}$/.test(digits)) return digits;
    if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
    return null;
}

export async function getMpesaAccessToken(creds: Pick<MpesaCredentials, 'environment' | 'consumerKey' | 'consumerSecret'>): Promise<string> {
    const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64');
    const res = await fetch(`${baseUrl(creds.environment)}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
        throw new Error(`M-Pesa auth failed (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();
    if (!json.access_token) throw new Error('M-Pesa auth response missing access_token');
    return json.access_token as string;
}

export interface StkPushRequest {
    creds: MpesaCredentials;
    phoneNumber: string;
    amount: number;
    accountReference: string;
    transactionDesc: string;
    callbackUrl: string;
}

export interface StkPushResponse {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResponseCode: string;
    ResponseDescription: string;
    CustomerMessage: string;
}

export async function initiateStkPush(req: StkPushRequest): Promise<StkPushResponse> {
    const phone = normalizeMpesaPhone(req.phoneNumber);
    if (!phone) throw new Error('Invalid phone number for M-Pesa STK Push');

    const token = await getMpesaAccessToken(req.creds);
    const timestamp = getTimestamp();
    const password = generatePassword(req.creds.shortcode, req.creds.passkey, timestamp);

    const res = await fetch(`${baseUrl(req.creds.environment)}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            BusinessShortCode: req.creds.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(req.amount),
            PartyA: phone,
            PartyB: req.creds.shortcode,
            PhoneNumber: phone,
            CallBackURL: req.callbackUrl,
            AccountReference: req.accountReference.slice(0, 12),
            TransactionDesc: req.transactionDesc.slice(0, 13),
        }),
    });

    const json = await res.json();
    if (!res.ok || json.ResponseCode !== '0') {
        throw new Error(json.errorMessage || json.ResponseDescription || 'STK Push request failed');
    }
    return json as StkPushResponse;
}

/** The shape Safaricom POSTs to CallBackURL after an STK Push completes. */
export interface StkCallbackBody {
    Body: {
        stkCallback: {
            MerchantRequestID: string;
            CheckoutRequestID: string;
            ResultCode: number;
            ResultDesc: string;
            CallbackMetadata?: {
                Item: Array<{ Name: string; Value?: string | number }>;
            };
        };
    };
}

export function parseStkCallback(body: StkCallbackBody) {
    const cb = body?.Body?.stkCallback;
    if (!cb) return null;

    const items = cb.CallbackMetadata?.Item ?? [];
    const get = (name: string) => items.find(i => i.Name === name)?.Value;

    return {
        merchantRequestId: cb.MerchantRequestID,
        checkoutRequestId: cb.CheckoutRequestID,
        success: cb.ResultCode === 0,
        resultCode: cb.ResultCode,
        resultDesc: cb.ResultDesc,
        amount: get('Amount') != null ? Number(get('Amount')) : undefined,
        mpesaReceiptNumber: get('MpesaReceiptNumber') as string | undefined,
        phoneNumber: get('PhoneNumber') != null ? String(get('PhoneNumber')) : undefined,
    };
}

/** The shape Safaricom POSTs to the C2B Confirmation URL for Paybill payments made directly (not via our STK Push). */
export interface C2BConfirmationBody {
    TransactionType: string;
    TransID: string;
    TransTime: string;
    TransAmount: string;
    BusinessShortCode: string;
    BillRefNumber: string;
    MSISDN: string;
    FirstName?: string;
    MiddleName?: string;
    LastName?: string;
}

export async function registerC2BUrls(creds: Pick<MpesaCredentials, 'environment' | 'shortcode' | 'consumerKey' | 'consumerSecret'>, confirmationUrl: string, validationUrl: string) {
    const token = await getMpesaAccessToken(creds);
    const res = await fetch(`${baseUrl(creds.environment)}/mpesa/c2b/v1/registerurl`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ShortCode: creds.shortcode,
            ResponseType: 'Completed',
            ConfirmationURL: confirmationUrl,
            ValidationURL: validationUrl,
        }),
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json.errorMessage || 'Failed to register C2B URLs with Safaricom');
    }
    return json;
}
