import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { canViewStudentFees } from '@/lib/auth-server';
import { getAccess } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadFeeReceipt } from '@/lib/fee-receipt-server';
import { FEE_SCHOOL_COLUMNS, feeSchool } from '@/lib/pdf/fees/FeeDocParts';
import { generateFeeReceiptPDF, receiptVerifyUrl } from '@/lib/pdf/feeReceiptServer';

export const runtime = 'nodejs';

/** GET — one payment's receipt (PDF), for finance staff, the learner and their linked parents. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
    try {
        const caller = await getAccess();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { paymentId } = await params;
        const receipt = await loadFeeReceipt(supabase, paymentId);
        if (!receipt || receipt.schoolId !== caller.schoolId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (!(await canViewStudentFees(caller, receipt.studentId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (receipt.status === 'CANCELLED') return NextResponse.json({ error: 'This payment was voided and has no valid receipt' }, { status: 400 });
        if (receipt.status !== 'COMPLETED') return NextResponse.json({ error: 'This payment has not been confirmed yet, so it has no receipt' }, { status: 400 });

        const { data: school } = await supabase.from('schools').select(FEE_SCHOOL_COLUMNS).eq('id', receipt.schoolId).maybeSingle();
        const pdf = await generateFeeReceiptPDF({
            school: feeSchool(school),
            receipt,
            verifyUrl: receiptVerifyUrl(new URL(request.url).origin, receipt.paymentId),
        });
        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="receipt-${receipt.receiptNumber}.pdf"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (err: unknown) {
        return internalError('payment receipt', err);
    }
}
