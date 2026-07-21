import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { generateFeeReceiptPDF } from '@/lib/pdf/feeReceiptServer';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();
        if (!userProfile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { paymentId } = await params;

        const { data: payment, error } = await supabase
            .from('fee_payments')
            .select(`
                id, receipt_number, amount, method, mpesa_receipt_number, payer_name, phone_number, notes, paid_at, recorded_by, status,
                student_fees (
                    id, total_fee, paid_amount, school_id, student_id,
                    terms ( name ),
                    students ( admission_number, current_grade_stream_id, users ( first_name, last_name ), grade_streams ( full_name ) )
                )
            `)
            .eq('id', paymentId)
            .maybeSingle();

        if (error) throw error;

        const fee = payment?.student_fees as any;
        if (!payment || !fee || fee.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (userProfile.role === 'STUDENT' && fee.student_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!['ADMIN', 'CLASS_TEACHER', 'STUDENT'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (payment.status === 'CANCELLED') {
            return NextResponse.json({ error: 'This payment was voided and has no valid receipt' }, { status: 400 });
        }

        const { data: school } = await supabase
            .from('schools')
            .select('name, logo_url, address')
            .eq('id', fee.school_id)
            .maybeSingle();

        let recordedByName: string | null = null;
        if (payment.recorded_by) {
            const { data: recorder } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', payment.recorded_by)
                .maybeSingle();
            if (recorder) recordedByName = `${recorder.first_name} ${recorder.last_name}`;
        }

        const student = fee.students;
        const pdfBuffer = await generateFeeReceiptPDF({
            schoolName: school?.name || 'School',
            schoolLogoUrl: school?.logo_url || undefined,
            schoolAddress: school?.address || undefined,
            receiptNumber: payment.receipt_number,
            paidAt: payment.paid_at,
            studentName: student?.users ? `${student.users.first_name} ${student.users.last_name}` : 'Student',
            admissionNumber: student?.admission_number || '',
            className: student?.grade_streams?.full_name,
            termName: fee.terms?.name,
            amount: Number(payment.amount),
            method: payment.method,
            mpesaReceiptNumber: payment.mpesa_receipt_number,
            payerName: payment.payer_name,
            phoneNumber: payment.phone_number,
            notes: payment.notes,
            recordedByName,
            totalFee: Number(fee.total_fee),
            totalPaidToDate: Number(fee.paid_amount),
            balance: Number(fee.total_fee) - Number(fee.paid_amount),
        });

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="receipt-${payment.receipt_number}.pdf"`,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
