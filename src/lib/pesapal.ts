/**
 * pesapal.ts
 * Minimal Pesapal API 3.0 client: auth, IPN registration, hosted-checkout
 * order submission, and transaction status lookup. Each school supplies its
 * own Pesapal merchant consumer key/secret (from their Pesapal business
 * account) — there is no shared/global Pesapal account for this
 * multi-tenant app.
 *
 * Unlike Daraja's STK Push (a native phone prompt), Pesapal's flow is a
 * hosted checkout page: SubmitOrderRequest returns a redirect_url the payer
 * is sent to, where they pick M-Pesa, card, etc. and complete payment on
 * Pesapal's own page, which then calls our IPN webhook and redirects the
 * payer's browser back to our callback_url.
 *
 * Reference: https://developer.pesapal.com/ (API 3.0, stable since ~2022).
 */

export type PesapalEnvironment = 'sandbox' | 'live';

export interface PesapalCredentials {
    environment: PesapalEnvironment;
    consumerKey: string;
    consumerSecret: string;
}

function baseUrl(environment: PesapalEnvironment): string {
    return environment === 'live' ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3';
}

export async function getPesapalAccessToken(creds: PesapalCredentials): Promise<string> {
    const res = await fetch(`${baseUrl(creds.environment)}/api/Auth/RequestToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ consumer_key: creds.consumerKey, consumer_secret: creds.consumerSecret }),
    });
    const json = await res.json();
    if (!res.ok || !json.token) {
        throw new Error(json.message || json.error?.message || 'Pesapal authentication failed');
    }
    return json.token as string;
}

export async function registerPesapalIPN(creds: PesapalCredentials, ipnUrl: string): Promise<string> {
    const token = await getPesapalAccessToken(creds);
    const res = await fetch(`${baseUrl(creds.environment)}/api/URLSetup/RegisterIPN`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url: ipnUrl, ipn_notification_type: 'GET' }),
    });
    const json = await res.json();
    if (!res.ok || !json.ipn_id) {
        throw new Error(json.message || json.error?.message || 'Failed to register IPN URL with Pesapal');
    }
    return json.ipn_id as string;
}

export interface SubmitOrderRequest {
    creds: PesapalCredentials;
    ipnId: string;
    merchantReference: string;
    amount: number;
    description: string;
    callbackUrl: string;
    payerEmail?: string;
    payerPhone?: string;
    payerFirstName?: string;
    payerLastName?: string;
}

export interface SubmitOrderResponse {
    order_tracking_id: string;
    merchant_reference: string;
    redirect_url: string;
    error: { error_type: string; code: string; message: string } | null;
    status: string;
}

export async function submitPesapalOrder(req: SubmitOrderRequest): Promise<SubmitOrderResponse> {
    const token = await getPesapalAccessToken(req.creds);
    const res = await fetch(`${baseUrl(req.creds.environment)}/api/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            id: req.merchantReference,
            currency: 'KES',
            amount: req.amount,
            description: req.description.slice(0, 100),
            callback_url: req.callbackUrl,
            notification_id: req.ipnId,
            billing_address: {
                email_address: req.payerEmail || undefined,
                phone_number: req.payerPhone || undefined,
                country_code: 'KE',
                first_name: req.payerFirstName || undefined,
                last_name: req.payerLastName || undefined,
            },
        }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
        throw new Error(json.error?.message || json.message || 'Pesapal order submission failed');
    }
    return json as SubmitOrderResponse;
}

export type PesapalStatusCode = 0 | 1 | 2 | 3; // 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED

export interface TransactionStatusResponse {
    payment_method: string;
    amount: number;
    created_date: string;
    confirmation_code: string;
    payment_status_description: string;
    status_code: PesapalStatusCode;
    merchant_reference: string;
    currency: string;
    error: { error_type: string; code: string; message: string } | null;
}

export async function getPesapalTransactionStatus(creds: PesapalCredentials, orderTrackingId: string): Promise<TransactionStatusResponse> {
    const token = await getPesapalAccessToken(creds);
    const res = await fetch(`${baseUrl(creds.environment)}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok || json.error) {
        throw new Error(json.error?.message || json.message || 'Failed to fetch Pesapal transaction status');
    }
    return json as TransactionStatusResponse;
}

/** Maps Pesapal's numeric status_code to our own fee_payments status. */
export function mapPesapalStatus(statusCode: PesapalStatusCode): 'COMPLETED' | 'FAILED' | 'PENDING' {
    if (statusCode === 1) return 'COMPLETED';
    // FAILED (2), INVALID (0), and REVERSED (3) all mean the money isn't
    // (or no longer is) ours — none should count toward paid_amount.
    if (statusCode === 2 || statusCode === 0 || statusCode === 3) return 'FAILED';
    return 'PENDING'; // anything unrecognized — don't guess, re-check later
}
