import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, parseBody } from '@/lib/platform/access';
import { requirePlatformOwner } from '@/lib/platform-owner';
import { actOnInvoice } from '@/lib/school-billing-server';
import { invoiceActionSchema } from '@/lib/school-billing';

export const runtime = 'nodejs';

/** POST — mark an invoice paid (with its M-Pesa or bank reference), void it, or waive it: the platform owner only. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const ownerId = await requirePlatformOwner();
        const { id } = await params;
        const action = await parseBody(request, invoiceActionSchema);
        await actOnInvoice(id, action, ownerId);
        return NextResponse.json({ data: { ok: true } });
    } catch (err) {
        return errorResponse('platform billing invoice', err);
    }
}
