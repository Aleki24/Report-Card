import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, parseBody } from '@/lib/platform/access';
import { requirePlatformOwner } from '@/lib/platform-owner';
import { savePaymentInstructions } from '@/lib/school-billing-server';
import { paymentInstructionsSchema } from '@/lib/school-billing';

export const runtime = 'nodejs';

/** PUT — where schools send payment (Paybill, till, bank): the platform owner only. */
export async function PUT(request: NextRequest) {
    try {
        const ownerId = await requirePlatformOwner();
        const instructions = await parseBody(request, paymentInstructionsSchema);
        return NextResponse.json({ data: await savePaymentInstructions(instructions, ownerId) });
    } catch (err) {
        return errorResponse('platform billing settings', err);
    }
}
