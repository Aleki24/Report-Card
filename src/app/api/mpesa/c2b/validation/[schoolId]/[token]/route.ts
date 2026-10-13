import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyWebhookToken } from '@/lib/crypto';

export const runtime = 'nodejs';

/**
 * Safaricom's C2B validation call, made before a Paybill payment completes
 * (only for shortcodes that opted into validation). It accepts every payment
 * and records nothing: the money has not moved yet, so the payment is written
 * by the confirmation call that follows. It used to share the confirmation
 * URL, which would have recorded a COMPLETED payment for a customer who then
 * cancelled at the PIN prompt.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ schoolId: string; token: string }> }) {
    const { schoolId, token } = await params;
    const { data: settings } = await createSupabaseAdmin()
        .from('school_payment_settings')
        .select('webhook_token')
        .eq('school_id', schoolId)
        .maybeSingle();
    if (!verifyWebhookToken(token, settings?.webhook_token)) {
        return NextResponse.json({ ResultCode: 'C2B00016', ResultDesc: 'Rejected' }, { status: 403 });
    }
    return NextResponse.json({ ResultCode: '0', ResultDesc: 'Accepted' });
}
