import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

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

        if (!userProfile || !['ADMIN', 'CLASS_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const schoolId = userProfile.school_id;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const termId = searchParams.get('term_id');
        const method = searchParams.get('method');
        const status = searchParams.get('status');
        const source = searchParams.get('source');
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');

        let query = supabase
            .from('fee_payments')
            .select(`
                receipt_number, amount, method, status, phone_number, payer_name,
                mpesa_receipt_number, mpesa_checkout_request_id, pesapal_order_tracking_id,
                pesapal_confirmation_code, unmatched_account_reference, notes, recorded_by, paid_at,
                student_fees ( term_id, terms ( name ), students ( admission_number, users ( first_name, last_name ) ) )
            `)
            .eq('school_id', schoolId)
            .order('paid_at', { ascending: false })
            .limit(2000);

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

        let filtered = data ?? [];
        if (termId) filtered = filtered.filter((p: any) => p.student_fees?.term_id === termId);
        if (source) {
            filtered = filtered.filter((p: any) => {
                const isAuto = !!(p.mpesa_checkout_request_id || p.pesapal_order_tracking_id || p.unmatched_account_reference);
                return source === 'AUTO' ? isAuto : !isAuto;
            });
        }

        const rows = filtered.map((p: any) => {
            const fee = p.student_fees;
            const student = fee?.students;
            const isAuto = !!(p.mpesa_checkout_request_id || p.pesapal_order_tracking_id || p.unmatched_account_reference);
            return {
                'Date': p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : '',
                'Receipt No.': p.receipt_number,
                'Student': student?.users ? `${student.users.first_name} ${student.users.last_name}` : (p.unmatched_account_reference ? `(Unmatched: ${p.unmatched_account_reference})` : ''),
                'Admission No.': student?.admission_number || '',
                'Term': fee?.terms?.name || '',
                'Amount (KES)': Number(p.amount),
                'Method': p.method,
                'Source': isAuto ? 'Auto' : 'Manual',
                'Status': p.status,
                'M-Pesa/Pesapal Ref': p.mpesa_receipt_number || p.pesapal_confirmation_code || '',
                'Recorded By': p.recorded_by ? (recorderNames[p.recorded_by] || '') : '',
                'Notes': p.notes || '',
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet['!cols'] = [
            { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
            { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
            { wch: 10 }, { wch: 16 }, { wch: 20 }, { wch: 30 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const dateStamp = new Date().toISOString().slice(0, 10);

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="payments-export-${dateStamp}.xlsx"`,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
