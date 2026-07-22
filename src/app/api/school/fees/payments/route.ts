import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * School-wide payment transactions log — every entry in fee_payments,
 * across every student, for bursars/admins to reconcile in one place
 * instead of drilling into each student's fee record individually.
 */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        // ADMIN (bursar) only: this is the school-wide log with payer phone
        // numbers across every student — class teachers still see per-student
        // history through the fee-record endpoints.
        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const schoolId = userProfile.school_id;
        if (!schoolId) return NextResponse.json({ data: [] });

        const { searchParams } = new URL(request.url);
        const termId = searchParams.get('term_id');
        const method = searchParams.get('method');
        const status = searchParams.get('status');
        const source = searchParams.get('source');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const search = searchParams.get('search')?.trim().toLowerCase();

        let query = supabase
            .from('fee_payments')
            .select(`
                id, student_fee_id, receipt_number, amount, method, status, phone_number, payer_name,
                mpesa_receipt_number, mpesa_checkout_request_id, pesapal_order_tracking_id,
                pesapal_confirmation_code, unmatched_account_reference, notes, recorded_by,
                paid_at, created_at,
                student_fees ( term_id, terms ( name ), students ( admission_number, users ( first_name, last_name ) ) )
            `)
            .eq('school_id', schoolId)
            .order('paid_at', { ascending: false })
            .limit(500);

        if (method) query = query.eq('method', method);
        if (status) query = query.eq('status', status);
        if (dateFrom) query = query.gte('paid_at', dateFrom);
        if (dateTo) query = query.lte('paid_at', `${dateTo}T23:59:59.999Z`);

        const { data, error } = await query;
        if (error) throw error;

        const recorderIds = Array.from(new Set((data ?? []).map((p: any) => p.recorded_by).filter(Boolean)));
        const recorderNames: Record<string, string> = {};
        if (recorderIds.length > 0) {
            const { data: recorders } = await supabase.from('users').select('id, first_name, last_name').in('id', recorderIds);
            for (const r of recorders ?? []) recorderNames[r.id] = `${r.first_name} ${r.last_name}`;
        }

        let mapped = (data ?? []).map((p: any) => {
            const fee = p.student_fees;
            const student = fee?.students;
            const isAuto = !!(p.mpesa_checkout_request_id || p.pesapal_order_tracking_id || p.unmatched_account_reference);
            return {
                id: p.id,
                studentFeeId: p.student_fee_id,
                receiptNumber: p.receipt_number,
                amount: Number(p.amount),
                method: p.method,
                status: p.status,
                source: isAuto ? 'AUTO' : 'MANUAL',
                studentName: student?.users ? `${student.users.first_name} ${student.users.last_name}` : (p.unmatched_account_reference ? null : '—'),
                admissionNumber: student?.admission_number ?? null,
                unmatchedReference: p.unmatched_account_reference,
                termId: fee?.term_id ?? null,
                termName: fee?.terms?.name ?? null,
                phoneNumber: p.phone_number,
                payerName: p.payer_name,
                mpesaReceiptNumber: p.mpesa_receipt_number,
                pesapalConfirmationCode: p.pesapal_confirmation_code,
                notes: p.notes,
                recordedByName: p.recorded_by ? (recorderNames[p.recorded_by] || null) : null,
                paidAt: p.paid_at,
                createdAt: p.created_at,
            };
        });

        if (termId) mapped = mapped.filter(p => p.termId === termId);
        if (source) mapped = mapped.filter(p => p.source === source);
        if (search) {
            mapped = mapped.filter(p =>
                p.studentName?.toLowerCase().includes(search) ||
                p.admissionNumber?.toLowerCase().includes(search) ||
                p.receiptNumber?.toLowerCase().includes(search) ||
                p.mpesaReceiptNumber?.toLowerCase().includes(search)
            );
        }

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        return internalError('payments log', err);
    }
}
