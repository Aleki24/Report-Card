import { normalizeMpesaPhone } from './phone';

/**
 * WhatsApp through Meta's WhatsApp Cloud API. Off until WHATSAPP_ACCESS_TOKEN
 * and WHATSAPP_PHONE_NUMBER_ID are set; every send then reports "not
 * configured" instead of failing, so SMS and email still go out.
 *
 * Messages a business starts must use templates Meta has approved. Their
 * names default to the ones below and can be changed with env vars; each
 * template's body takes the numbered parameters documented beside it.
 * Server-only.
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';

export const WHATSAPP_TEMPLATES = {
    /** "New school request: {{1}}, from {{2}} ({{3}}). Review it: {{4}}" */
    schoolRequest: process.env.WHATSAPP_TEMPLATE_SCHOOL_REQUEST?.trim() || 'school_request',
    /** "Hi {{1}}, {{2}} has been approved on Skulbase. Sign in at {{3}} to add your classes and invite your teachers." */
    schoolApproved: process.env.WHATSAPP_TEMPLATE_SCHOOL_APPROVED?.trim() || 'school_approved',
} as const;

const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en';

export type WhatsAppResult =
    | { ok: true; to: string; messageId: string | null }
    | { ok: false; to: string; error: string };

export function isWhatsAppConfigured(): boolean {
    return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Sends an approved template to a Kenyan mobile number. Never throws: the
 * result says whether it went, and why not.
 */
export async function sendWhatsAppTemplate(phone: string, template: string, params: readonly string[]): Promise<WhatsAppResult> {
    const to = normalizeMpesaPhone(phone) ?? phone;
    if (!isWhatsAppConfigured()) return { ok: false, to, error: 'WhatsApp is not configured' };
    if (!normalizeMpesaPhone(phone)) return { ok: false, to, error: 'Not a Kenyan mobile number' };

    try {
        const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to,
                type: 'template',
                template: {
                    name: template,
                    language: { code: TEMPLATE_LANGUAGE },
                    components: params.length
                        ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: text.slice(0, 1000) })) }]
                        : [],
                },
            }),
        });
        const json = (await res.json().catch(() => null)) as { messages?: { id?: string }[]; error?: { message?: string } } | null;
        if (!res.ok) {
            const error = json?.error?.message ?? `WhatsApp API answered ${res.status}`;
            console.error('[whatsapp] send failed', { to, template, error });
            return { ok: false, to, error };
        }
        return { ok: true, to, messageId: json?.messages?.[0]?.id ?? null };
    } catch (err) {
        const error = err instanceof Error ? err.message : 'WhatsApp request failed';
        console.error('[whatsapp] send threw', { to, template, error });
        return { ok: false, to, error };
    }
}
