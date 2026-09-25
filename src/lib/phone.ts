/**
 * Safaricom numbers in the 2547XXXXXXXX / 2541XXXXXXXX form Daraja expects,
 * from what people type (07…, 01…, +254…, 254…, spaces and dashes). Null when
 * it isn't a Kenyan mobile number. No Node APIs, so the browser can check a
 * number before a payment prompt is sent.
 */
export function normalizeMpesaPhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
    if (/^254[17]\d{8}$/.test(digits)) return digits;
    if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
    return null;
}
