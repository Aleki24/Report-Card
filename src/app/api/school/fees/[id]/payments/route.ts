import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { FEE_PAYMENT_METHODS, mapFeePaymentRow, type FeePaymentMethod } from '@/lib/fees';

interface FeeRecordAccess {
    ok: true;
    role: string;
    fee: { id: string; school_id: string; student_id: string; total_fee: number; paid_amount: number; status: string };
}
interface FeeRecordAccessError {
    ok: false;
    response: NextResponse;
}

async function getFeeRecordForCaller(
    supabase: ReturnType<typeof createSupabaseAdmin>,
    feeId: string,
    userId: string
): Promise<FeeRecordAccess | FeeRecordAccessError> {
    const { data: userProfile } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('id', userId)
        .maybeSingle();
    if (!userProfile) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const { data: fee } = await supabase
        .from('student_fees')
        .select('id, school_id, student_id, total_fee, paid_amount, status')
        .eq('id', feeId)
        .maybeSingle();

    if (!fee || fee.school_id !== userProfile.school_id) {
        return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    }
    if (userProfile.role === 'STUDENT' && fee.student_id !== userId) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    if (!['ADMIN', 'CLASS_TEACHER', 'STUDENT'].includes(userProfile.role)) {
        return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { ok: true, role: userProfile.role, fee };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { id } = await params;
        const result = await getFeeRecordForCaller(supabase, id, userId);
        if (!result.ok) return result.response;

        const { data, error } = await supabase
            .from('fee_payments')
            .select('*')
            .eq('student_fee_id', id)
            .order('paid_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data: (data ?? []).map(mapFeePaymentRow) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { id } = await params;

        const result = await getFeeRecordForCaller(supabase, id, userId);
        if (!result.ok) return result.response;
        if (result.role === 'STUDENT') {
            return NextResponse.json({ error: 'Only staff can record payments' }, { status: 403 });
        }
        const { fee } = result;

        const body = await request.json();
        const { amount, method, paid_at, notes, payer_name, phone_number, mpesa_receipt_number } = body;

        const amountValue = Number(amount);
        if (!amount || isNaN(amountValue) || amountValue <= 0) {
            return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
        }
        const methodValue: FeePaymentMethod = FEE_PAYMENT_METHODS.includes(method) ? method : 'CASH';

        const { data, error: insertError } = await supabase
            .from('fee_payments')
            .insert({
                school_id: fee.school_id,
                student_fee_id: id,
                amount: amountValue,
                method: methodValue,
                status: 'COMPLETED',
                paid_at: paid_at || new Date().toISOString(),
                notes: notes || null,
                payer_name: payer_name || null,
                phone_number: phone_number || null,
                mpesa_receipt_number: methodValue === 'MPESA' ? (mpesa_receipt_number || null) : null,
                recorded_by: userId,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // The DB trigger already rolled paid_amount/status up onto student_fees —
        // return the fresh parent row so the client can update in one round trip.
        const { data: updatedFee } = await supabase
            .from('student_fees')
            .select('id, total_fee, paid_amount, status')
            .eq('id', id)
            .single();

        return NextResponse.json({ data: mapFeePaymentRow(data), fee: updatedFee });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
