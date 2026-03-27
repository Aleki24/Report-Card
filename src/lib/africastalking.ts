import AfricasTalking from 'africastalking';

const credentials = {
    apiKey: process.env.AT_API_KEY || '',
    username: process.env.AT_USERNAME || 'sandbox',
};

const at = AfricasTalking(credentials);
const sms = at.SMS;

export interface SMSResult {
    success: boolean;
    to: string;
    messageId?: string;
    error?: string;
}

/**
 * Send a single SMS via Africa's Talking
 */
export async function sendSMS(to: string, message: string): Promise<SMSResult> {
    // Normalise Kenyan numbers: ensure +254 prefix
    const phone = normalizeKenyanPhone(to);
    if (!phone) {
        return { success: false, to, error: 'Invalid phone number' };
    }

    try {
        const options: any = {
            to: [phone],
            message,
        };

        // Only set sender ID if configured (sandbox doesn't support custom sender IDs)
        if (process.env.AT_SENDER_ID && credentials.username !== 'sandbox') {
            options.from = process.env.AT_SENDER_ID;
        }

        const result = await sms.send(options);
        console.log('[SMS] AT response:', JSON.stringify(result, null, 2));

        const recipient = result.SMSMessageData?.Recipients?.[0];
        if (recipient && (recipient.statusCode === 100 || recipient.statusCode === 101)) {
            return { success: true, to: phone, messageId: recipient.messageId };
        }

        console.error('[SMS] Send failed for', phone, ':', recipient?.status, '| statusCode:', recipient?.statusCode, '| full:', JSON.stringify(result.SMSMessageData));
        return {
            success: false,
            to: phone,
            error: recipient?.status || 'Unknown error',
        };
    } catch (err: any) {
        console.error('[SMS] Exception sending to', phone, ':', err.message || err);
        return { success: false, to: phone, error: err.message || 'SMS send failed' };
    }
}

/**
 * Send SMS to multiple recipients
 */
export async function sendBulkSMS(
    recipients: { phone: string; message: string }[]
): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
    const results: SMSResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
        const result = await sendSMS(r.phone, r.message);
        results.push(result);
        if (result.success) sent++;
        else failed++;
    }

    return { sent, failed, results };
}

/**
 * Normalise a Kenyan phone number to +254XXXXXXXXX format
 */
function normalizeKenyanPhone(phone: string): string | null {
    if (!phone) return null;

    // Strip spaces, dashes, parentheses
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Handle various formats
    if (cleaned.startsWith('+254')) {
        // Already correct international format
    } else if (cleaned.startsWith('254')) {
        cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
        cleaned = '+254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        cleaned = '+254' + cleaned;
    } else {
        return null; // Unrecognised format
    }

    // Validate length: +254 (4) + 9 digits = 13 chars
    if (cleaned.length !== 13 || !/^\+254\d{9}$/.test(cleaned)) {
        return null;
    }

    return cleaned;
}
