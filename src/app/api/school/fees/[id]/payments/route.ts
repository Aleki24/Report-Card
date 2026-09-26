import { NextRequest, NextResponse } from 'next/server';
import { MPESA_RECEIPT_UNIQUE_INDEX, internalError, isUniqueViolation, writeErrorMessage } from '@/lib/api-errors';
import { canViewStudentFees, getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { FEE_PAYMENT_METHODS, mapFeePaymentRow, type FeePaymentMethod } from '@/lib/fees';

interface FeeRecordAccess {
    ok: true;
    role: string;
    userId: string;
    fee: { id: string; school_id: string; student_id: string; total_fee: number; paid_amount: number; status: string };
}
interface FeeRecordAccessError {
    ok: false;
    response: NextResponse;
}

async function getFeeRecordForCaller(
    supabase: ReturnType<typeof createSupabaseAdmin>,
    feeId: string,
): Promise<FeeRecordAccess | FeeRecordAccessError> {
    const caller = await getCaller();
    if (!caller) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const { data: fee } = await supabase
        .from('student_fees')
        .select('id, school_id, student_id, total_fee, paid_amount, status')
        .eq('id', feeId)
        .maybeSingle();

    if (!fee || fee.school_id !== caller.schoolId) {
        return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    }
    // Students see their own fees, the admin everyone's; teachers none.
    if (!(await canViewStudentFees(caller, fee.student_id))) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { ok: true, role: caller.role, userId: caller.userId, fee };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = createSupabaseAdmin();
        const { id } = await params;
        const result = await getFeeRecordForCaller(supabase, id);
        if (!result.ok) return result.response;

        const { data, error } = await supabase
            .from('fee_payments')
            .select('*')
            .eq('student_fee_id', id)
            .order('paid_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: (data ?? []).map(mapFeePaymentRow) });
    } catch (err: unknown) {
        return internalError('fee payments', err);
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = createSupabaseAdmin();
        const { id } = await params;

        const result = await getFeeRecordForCaller(supabase, id);
        if (!result.ok) return result.response;
        if (result.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Only the admin can record payments' }, { status: 403 });
        }
        const { fee } = result;

        const body = await request.json();
        const { amount, method, paid_at, notes, payer_name, phone_number, mpesa_receipt_number } = body;

        const amountValue = Number(amount);
        if (!amount || isNaN(amountValue) || amountValue <= 0) {
            return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
        }
        const methodValue: FeePaymentMethod = FEE_PAYMENT_METHODS.includes(method) ? method : 'CASH';

        // Backdating is legitimate (recording an old deposit slip); a future
        // date is always a typo — catch it here instead of polluting the ledger.
        let paidAtValue: string | undefined;
        if (paid_at) {
            const paidAtDate = new Date(paid_at);
            if (isNaN(paidAtDate.getTime())) {
                return NextResponse.json({ error: 'paid_at is not a valid date' }, { status: 400 });
            }
            if (paidAtDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
                return NextResponse.json({ error: 'paid_at cannot be in the future' }, { status: 400 });
            }
            paidAtValue = paidAtDate.toISOString();
        }

        const { data, error: insertError } = await supabase
            .from('fee_payments')
            .insert({
                school_id: fee.school_id,
                student_fee_id: id,
                amount: amountValue,
                method: methodValue,
                status: 'COMPLETED',
                paid_at: paidAtValue || new Date().toISOString(),
                notes: notes || null,
                payer_name: payer_name || null,
                phone_number: phone_number || null,
                // M-Pesa codes are upper-case; normalise what a bursar types so
                // "qhk1..." and "QHK1..." are the same receipt to the unique index.
                mpesa_receipt_number: methodValue === 'MPESA' && typeof mpesa_receipt_number === 'string' && mpesa_receipt_number.trim()
                    ? mpesa_receipt_number.trim().toUpperCase()
                    : null,
                recorded_by: result.userId,
            })
            .select()
            .single();

        if (insertError) {
            // Usually a payment the Paybill already recorded on its own.
            if (isUniqueViolation(insertError, MPESA_RECEIPT_UNIQUE_INDEX)) {
                return NextResponse.json(
                    { error: writeErrorMessage(insertError, 'That M-Pesa receipt number has already been recorded.') },
                    { status: 409 },
                );
            }
            throw insertError;
        }

        // The DB trigger already rolled paid_amount/status up onto student_fees —
        // return the fresh parent row so the client can update in one round trip.
        const { data: updatedFee } = await supabase
            .from('student_fees')
            .select('id, total_fee, paid_amount, status')
            .eq('id', id)
            .single();

        return NextResponse.json({ data: mapFeePaymentRow(data), fee: updatedFee });
    } catch (err: unknown) {
        return internalError('fee payments', err);
    }
}
