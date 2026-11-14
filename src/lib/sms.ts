/**
 * SMS through Top Media SMS (https://topmediasms.com/docs): one REST call
 * carries up to 1,000 numbers. Set TOPMEDIA_SMS_API_KEY (a bsms_live_… key
 * sends for real, a bsms_test_… key returns mocks) and, once approved,
 * TOPMEDIA_SMS_SENDER_ID.
 */
import { z } from 'zod';

const API_URL = 'https://api.topmediasms.com/v1/api-send-sms';
/** Numbers per request; the API takes 1–1,000. */
const BATCH_SIZE = 500;
/** Requests in flight at once; each key gets 60 requests a minute. */
const CONCURRENCY = 4;
const TIMEOUT_MS = 20_000;
/** The longest wait honoured on a 429 before trying once more. */
const MAX_RETRY_WAIT_MS = 10_000;

const CREDENTIALS_ERROR = 'SMS provider rejected the credentials (check TOPMEDIA_SMS_API_KEY). No messages were sent.';
const NOT_CONFIGURED_ERROR = 'SMS is not set up (TOPMEDIA_SMS_API_KEY is missing). No messages were sent.';
const NO_BALANCE_ERROR = 'The SMS account has no units left. Top it up, then send again.';
/** Errors that fail every request the same way, so the rest of a blast is skipped. */
const STOP_ERRORS = new Set([CREDENTIALS_ERROR, NOT_CONFIGURED_ERROR, NO_BALANCE_ERROR]);

const sendResponseSchema = z.object({
    success: z.boolean().optional(),
    message_id: z.string().optional(),
    accepted: z.array(z.string()).default([]),
    rejected: z.array(z.string()).default([]),
    blocked_dnd: z.array(z.string()).default([]),
});
const errorBodySchema = z.object({ error: z.string().optional(), retry_after: z.number().optional() }).passthrough();

export interface SMSResult {
    success: boolean;
    to: string;
    messageId?: string;
    error?: string;
}

/** Any Kenyan number as +2547XXXXXXXX / +2541XXXXXXXX, or null. */
export function normalizeKenyanPhone(phone: string): string | null {
    if (!phone) return null;
    // Guardian numbers arrive with spaces, dashes, dots, parens and spreadsheet
    // artefacts (a leading apostrophe kept to save the leading zero).
    const digits = phone.replace(/\D/g, '');
    const local = digits.startsWith('254') ? digits.slice(3)
        : digits.startsWith('0') ? digits.slice(1)
            : digits;
    return /^[17]\d{8}$/.test(local) ? `+254${local}` : null;
}

/** The API answers with numbers as 2547…; key them as we sent them. */
const asSent = (n: string) => normalizeKenyanPhone(n) ?? n;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One POST, retried once when the per-minute limit is hit. */
async function post(body: Record<string, unknown>, apiKey: string): Promise<Response> {
    const send = () => fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const res = await send();
    if (res.status !== 429) return res;
    const parsed = errorBodySchema.safeParse(await res.json().catch(() => null));
    const waitMs = Math.min(MAX_RETRY_WAIT_MS, Math.max(1_000, (parsed.success ? parsed.data.retry_after ?? 5 : 5) * 1_000));
    await sleep(waitMs);
    return send();
}

function errorFor(status: number, body: unknown): string {
    if (status === 401 || (status === 403 && !/sender id/i.test(JSON.stringify(body ?? '')))) return CREDENTIALS_ERROR;
    if (status === 402) return NO_BALANCE_ERROR;
    const parsed = errorBodySchema.safeParse(body);
    const message = parsed.success ? parsed.data.error : undefined;
    if (status === 422) return 'The number has opted out of SMS';
    return message || `SMS send failed (HTTP ${status})`;
}

/** Sends one message to many (already normalised) numbers in a single request. */
async function sendBatch(phones: readonly string[], message: string): Promise<Map<string, SMSResult>> {
    const outcome = new Map<string, SMSResult>();
    const failAll = (error: string) => { for (const p of phones) outcome.set(p, { success: false, to: p, error }); };

    const apiKey = process.env.TOPMEDIA_SMS_API_KEY;
    if (!apiKey) {
        failAll(NOT_CONFIGURED_ERROR);
        return outcome;
    }
    const senderId = process.env.TOPMEDIA_SMS_SENDER_ID?.trim();

    try {
        const res = await post({ to: [...phones], message, ...(senderId ? { sender_id: senderId } : {}) }, apiKey);
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok) {
            const error = errorFor(res.status, body);
            console.error('[SMS] Send failed for', phones.length, 'numbers:', res.status, error);
            failAll(error);
            return outcome;
        }
        const parsed = sendResponseSchema.safeParse(body);
        if (!parsed.success) {
            console.error('[SMS] Unexpected response for', phones.length, 'numbers');
            failAll('Unexpected reply from the SMS provider');
            return outcome;
        }
        const { message_id: messageId, accepted, rejected, blocked_dnd: blocked } = parsed.data;
        for (const n of accepted) outcome.set(asSent(n), { success: true, to: asSent(n), messageId });
        for (const n of rejected) outcome.set(asSent(n), { success: false, to: asSent(n), error: 'Rejected by the SMS provider' });
        for (const n of blocked) outcome.set(asSent(n), { success: false, to: asSent(n), error: 'The number has opted out of SMS' });
        const missing = phones.filter((p) => !outcome.has(p));
        if (missing.length > 0) {
            console.error('[SMS] No status for', missing.length, 'of', phones.length, 'numbers');
            for (const p of missing) outcome.set(p, { success: false, to: p, error: 'Not accepted by the SMS provider' });
        }
    } catch (err: unknown) {
        const error = err instanceof Error && err.name === 'TimeoutError' ? 'The SMS provider did not answer in time' : 'SMS send failed';
        console.error('[SMS] Send failed for', phones.length, 'numbers:', err instanceof Error ? err.message : err);
        failAll(error);
    }
    return outcome;
}

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
    const phone = normalizeKenyanPhone(to);
    if (!phone) return { success: false, to, error: 'Invalid phone number' };
    return (await sendBatch([phone], message)).get(phone) ?? { success: false, to: phone, error: 'SMS send failed' };
}

/**
 * Sends each recipient their message. Recipients sharing a message go out
 * together, BATCH_SIZE numbers per request and CONCURRENCY requests at a
 * time. `results[i]` is the outcome for `recipients[i]`.
 */
export async function sendBulkSMS(
    recipients: { phone: string; message: string }[],
): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
    const normalised = recipients.map((r) => normalizeKenyanPhone(r.phone));

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
    let stopError: string | null = null;
    const worker = async () => {
        while (next < jobs.length) {
            const job = jobs[next++];
            // A bad key or an empty wallet fails every request the same way: stop sending.
            const outcome = stopError
                ? new Map(job.phones.map((p) => [p, { success: false, to: p, error: stopError ?? undefined } satisfies SMSResult]))
                : await sendBatch(job.phones, job.message);
            const fatal = [...outcome.values()].find((r) => r.error && STOP_ERRORS.has(r.error));
            if (fatal?.error) stopError = fatal.error;
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
