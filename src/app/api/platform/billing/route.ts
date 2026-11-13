import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/platform/access';
import { requirePlatformOwner } from '@/lib/platform-owner';
import { allSchoolsBilling, loadPaymentInstructions } from '@/lib/school-billing-server';

export const runtime = 'nodejs';

/** GET — every approved school's subscription and invoices, and where schools pay: the platform owner only. */
export async function GET() {
    try {
        await requirePlatformOwner();
        const [schools, instructions] = await Promise.all([allSchoolsBilling(), loadPaymentInstructions()]);
        return NextResponse.json({ data: { schools, instructions } });
    } catch (err) {
        return errorResponse('platform billing', err);
    }
}
