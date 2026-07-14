let smsInstance: any = null;

function getSms() {
  if (smsInstance) return smsInstance;
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME || 'sandbox';
  if (!apiKey) {
    throw new Error('AT_API_KEY environment variable is not set');
  }
  const AfricasTalking = require('africastalking');
  const at = AfricasTalking({ apiKey, username });
  smsInstance = at.SMS;
  return smsInstance;
}

export interface SMSResult {
    success: boolean;
    to: string;
    messageId?: string;
    error?: string;
}

function normalizeKenyanPhone(phone: string): string | null {
    if (!phone) return null;
    // Strip everything but digits (and a leading '+') — real guardian_phone
    // values arrive with all sorts of noise: spaces, dashes, dots, parens,
    // and spreadsheet artifacts like a leading apostrophe used to keep the
    // leading zero when pasted from Excel/Sheets.
    const hasPlus = phone.trim().startsWith('+');
    let cleaned = (hasPlus ? '+' : '') + phone.replace(/\D/g, '');
    if (cleaned.startsWith('+254')) {
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

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
    const phone = normalizeKenyanPhone(to);
    if (!phone) {
        return { success: false, to, error: 'Invalid phone number' };
    }
    try {
        const sms = getSms();
        const options: any = { to: [phone], message };
        if (process.env.AT_SENDER_ID && process.env.AT_USERNAME !== 'sandbox') {
            options.from = process.env.AT_SENDER_ID;
        }
        const result = await sms.send(options);
        console.log('[SMS] AT response:', JSON.stringify(result, null, 2));
        const recipient = result.SMSMessageData?.Recipients?.[0];
        if (recipient && (recipient.statusCode === 100 || recipient.statusCode === 101)) {
            return { success: true, to: phone, messageId: recipient.messageId };
        }
        console.error('[SMS] Send failed for', phone, ':', recipient?.status, '| statusCode:', recipient?.statusCode, '| full:', JSON.stringify(result.SMSMessageData));
        return { success: false, to: phone, error: recipient?.status || 'Unknown error' };
    } catch (err: any) {
        console.error('[SMS] Exception sending to', phone, ':', err.message || err);
        return { success: false, to: phone, error: err.message || 'SMS send failed' };
    }
}

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
