/** The part of the africastalking SDK's SMS service used here. */
interface ATRecipient {
    statusCode?: number;
    number?: string;
    status?: string;
    messageId?: string;
}
interface ATSendResult {
    SMSMessageData?: { Message?: string; Recipients?: ATRecipient[] };
}
interface ATSms {
    send(options: { to: string[]; message: string; from?: string }): Promise<ATSendResult>;
}

let smsInstance: ATSms | null = null;

function getSms(): ATSms {
    if (smsInstance) return smsInstance;
    const apiKey = process.env.AT_API_KEY;
    const username = process.env.AT_USERNAME || 'sandbox';
    if (!apiKey) {
        throw new Error('AT_API_KEY environment variable is not set');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the SDK ships no types or ESM entry
    const AfricasTalking = require('africastalking') as (opts: { apiKey: string; username: string }) => { SMS: ATSms };
    smsInstance = AfricasTalking({ apiKey, username }).SMS;
    return smsInstance;
}

export interface SMSResult {
    success: boolean;
    to: string;
    messageId?: string;
    error?: string;
}

/** Numbers per Africa's Talking request: one call carries a whole batch. */
const BATCH_SIZE = 100;
/** Requests in flight at once, so a school-wide blast finishes in seconds, not minutes. */
const CONCURRENCY = 4;
/** Africa's Talking: 100 = processed, 101 = sent. */
const ACCEPTED = new Set([100, 101]);
const CREDENTIALS_ERROR = 'SMS provider rejected the credentials (check AT_API_KEY / AT_USERNAME). No messages were sent.';

function normalizeKenyanPhone(phone: string): string | null {
    if (!phone) return null;
    // Strip everything but digits (and a leading '+') — real guardian_phone
    // values arrive with all sorts of noise: spaces, dashes, dots, parens,
    // and spreadsheet artifacts like a leading apostrophe used to keep the
    // leading zero when pasted from Excel/Sheets.
    const hasPlus = phone.trim().startsWith('+');
    let cleaned = (hasPlus ? '+' : '') + phone.replace(/\D/g, '');
    if (cleaned.startsWith('+254')) {
        // already international
    } else if (cleaned.startsWith('254')) {
        cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
        cleaned = '+254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        cleaned = '+254' + cleaned;
    } else {
        return null;
    }
    if (cleaned.length !== 13 || !/^\+254\d{9}$/.test(cleaned)) {
        return null;
    }
    return cleaned;
}

/** A 401/403 means the key or username is wrong, not a problem with one number. */
function describeSendError(err: unknown): string {
    const e = err as { message?: unknown; response?: { status?: number } } | null;
    const message = typeof e?.message === 'string' ? e.message : '';
    const status = e?.response?.status ?? (/\b40[13]\b/.test(message) ? 401 : undefined);
    if (status === 401 || status === 403) return CREDENTIALS_ERROR;
    return message || 'SMS send failed';
}

/**
 * Sends one message to many (already normalised) numbers in a single
 * Africa's Talking request, and returns each number's outcome.
 */
async function sendBatch(phones: readonly string[], message: string): Promise<Map<string, SMSResult>> {
    const outcome = new Map<string, SMSResult>();
    try {
        const from = process.env.AT_SENDER_ID && process.env.AT_USERNAME !== 'sandbox' ? process.env.AT_SENDER_ID : undefined;
        const result = await getSms().send({ to: [...phones], message, ...(from ? { from } : {}) });
        for (const r of result.SMSMessageData?.Recipients ?? []) {
            if (!r.number) continue;
            const ok = r.statusCode !== undefined && ACCEPTED.has(r.statusCode);
            outcome.set(r.number, ok
                ? { success: true, to: r.number, messageId: r.messageId }
                : { success: false, to: r.number, error: r.status || 'Unknown error' });
        }
        const missing = phones.filter(p => !outcome.has(p));
        if (missing.length > 0) {
            console.error('[SMS] No delivery status for', missing.length, 'of', phones.length, 'numbers:', result.SMSMessageData?.Message);
            for (const p of missing) outcome.set(p, { success: false, to: p, error: 'Not accepted by the SMS provider' });
        }
    } catch (err: unknown) {
        const error = describeSendError(err);
        console.error('[SMS] Send failed for', phones.length, 'numbers:', error);
        for (const p of phones) outcome.set(p, { success: false, to: p, error });
    }
    return outcome;
}

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
    const phone = normalizeKenyanPhone(to);
    if (!phone) {
        return { success: false, to, error: 'Invalid phone number' };
    }
    return (await sendBatch([phone], message)).get(phone) ?? { success: false, to: phone, error: 'SMS send failed' };
}

/**
 * Sends each recipient their message. Recipients sharing a message go out
 * together, BATCH_SIZE numbers per request and CONCURRENCY requests at a
 * time. `results[i]` is the outcome for `recipients[i]`.
 */
export async function sendBulkSMS(
    recipients: { phone: string; message: string }[]
): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
    const normalised = recipients.map(r => normalizeKenyanPhone(r.phone));

    // One job per (message, batch of distinct numbers).
    const byMessage = new Map<string, Set<string>>();
    normalised.forEach((phone, i) => {
        if (!phone) return;
        const numbers = byMessage.get(recipients[i].message) ?? new Set<string>();
        numbers.add(phone);
        byMessage.set(recipients[i].message, numbers);
    });
    const jobs: { message: string; phones: string[] }[] = [];
    for (const [message, numbers] of byMessage) {
        const all = [...numbers];
        for (let i = 0; i < all.length; i += BATCH_SIZE) jobs.push({ message, phones: all.slice(i, i + BATCH_SIZE) });
    }

    const outcomes = new Map<string, Map<string, SMSResult>>();
    let next = 0;
    let credentialsRejected = false;
    const worker = async () => {
        while (next < jobs.length) {
            const job = jobs[next++];
            // Wrong credentials fail every request the same way: stop sending.
            const outcome = credentialsRejected
                ? new Map(job.phones.map(p => [p, { success: false, to: p, error: CREDENTIALS_ERROR } satisfies SMSResult]))
                : await sendBatch(job.phones, job.message);
            if ([...outcome.values()].some(r => r.error === CREDENTIALS_ERROR)) credentialsRejected = true;
            const forMessage = outcomes.get(job.message) ?? new Map<string, SMSResult>();
            outcome.forEach((r, p) => forMessage.set(p, r));
            outcomes.set(job.message, forMessage);
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

    let sent = 0;
    let failed = 0;
    const results = recipients.map((r, i): SMSResult => {
        const phone = normalised[i];
        const result = phone
            ? outcomes.get(r.message)?.get(phone) ?? { success: false, to: phone, error: 'SMS send failed' }
            : { success: false, to: r.phone, error: 'Invalid phone number' };
        if (result.success) sent++;
        else failed++;
        return result;
    });
    return { sent, failed, results };
}
