import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { rateLimitShared } from '@/lib/rate-limit';
import { escapeHtml } from '@/lib/html';
import { CONTACT_DETAILS, contactSchema } from '@/lib/contact';
import { sendSMS } from '@/lib/sms';
import { platformOwnerPhones } from '@/lib/school-approval';

const CONTACT_INBOX = CONTACT_DETAILS.email;

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limit = await rateLimitShared(`contact:${ip}`, { maxRequests: 5, windowMs: 60_000 });
        if (!limit) {
            return NextResponse.json({ error: 'Too many messages sent. Please wait a minute and try again.' }, { status: 429 });
        }

        const parsed = contactSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }, { status: 400 });
        }
        // Typed by an anonymous visitor and placed in an HTML email, so every
        // value is escaped below.
        const { name, email, phone, schoolName, message } = parsed.data;

        await sendEmail({
            to: CONTACT_INBOX,
            subject: `Skulbase contact form: ${name}${schoolName ? ` (${schoolName})` : ''}`,
            replyTo: email,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #1a1a2e; font-size: 20px;">New contact form submission</h1>
                <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
                ${schoolName ? `<p><strong>School:</strong> ${escapeHtml(schoolName)}</p>` : ''}
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
              </div>
            `,
        });

        // A text too, so an enquiry is seen at once. Best effort: the email is the record.
        const excerpt = message.length > 90 ? `${message.slice(0, 90)}…` : message;
        const sms = `Skulbase enquiry from ${name}${schoolName ? ` (${schoolName})` : ''}, ${phone || email}: "${excerpt}"`;
        const texts = await Promise.allSettled(platformOwnerPhones().map(to => sendSMS(to, sms)));
        for (const t of texts) if (t.status === 'rejected' || !t.value.success) console.warn('contact form SMS not sent:', t.status === 'rejected' ? t.reason : t.value.error);

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error('contact form error:', err);
        return NextResponse.json({ error: 'Failed to send your message. Please try again or email us directly.' }, { status: 500 });
    }
}
