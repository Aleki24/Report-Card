import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import * as XLSX from 'xlsx';
import { accessOrResponse } from '@/lib/platform/access';
import { loadPaymentLog, parsePaymentLogFilters, recorderNames } from '@/lib/fees-payment-log';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const caller = await accessOrResponse('fees.view');
        if (caller instanceof NextResponse) return caller;

        const supabase = createSupabaseAdmin();
        const schoolId = caller.schoolId;

        const { entries } = await loadPaymentLog(supabase, schoolId, parsePaymentLogFilters(new URL(request.url).searchParams));
        const names = await recorderNames(supabase, entries);

        const rows = entries.map(p => ({
            'Date': p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : '',
            'Receipt No.': p.receiptNumber,
            'Student': p.studentName && p.studentName !== '—' ? p.studentName : (p.unmatchedReference ? `(Unmatched: ${p.unmatchedReference})` : ''),
            'Admission No.': p.admissionNumber || '',
            'Term': p.termName || '',
            'Amount (KES)': p.amount,
            'Method': p.method,
            'Source': p.source === 'AUTO' ? 'Auto' : 'Manual',
            'Status': p.status,
            'M-Pesa/Pesapal Ref': p.mpesaReceiptNumber || p.pesapalConfirmationCode || '',
            'Recorded By': p.recordedBy ? names[p.recordedBy] || '' : '',
            'Notes': p.notes || '',
        }));

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
        return internalError('payments export', err);
    }
}
