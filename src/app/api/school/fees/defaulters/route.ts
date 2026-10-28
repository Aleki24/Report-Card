import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { internalError } from '@/lib/api-errors';
import { accessOrResponse } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/postgrest';
import { loadDefaulters } from '@/lib/fee-reports-server';
import { daysSince, type DefaultersResponse } from '@/lib/fee-reports';

export const runtime = 'nodejs';

/**
 * GET ?grade_stream_id=&min_balance=&format=xlsx — learners owing across all
 * their terms, most owed first, with a parent to call. `format=xlsx`
 * downloads the list.
 */
export async function GET(request: NextRequest) {
    try {
        const caller = await accessOrResponse('fees.view');
        if (caller instanceof NextResponse) return caller;
        const params = new URL(request.url).searchParams;
        const streamId = params.get('grade_stream_id');
        if (streamId && !isUuid(streamId)) return NextResponse.json({ error: 'Invalid class' }, { status: 400 });
        const minBalance = Number(params.get('min_balance') ?? 1);

        const data = await loadDefaulters(createSupabaseAdmin(), caller.schoolId, {
            gradeStreamId: streamId,
            minBalance: Number.isFinite(minBalance) ? minBalance : 1,
        });

        if (params.get('format') === 'xlsx') {
            const sheet = XLSX.utils.json_to_sheet(data.map(d => ({
                'Learner': d.name,
                'Admission No.': d.admissionNumber ?? '',
                'Class': d.className ?? '',
                'Owed (KES)': d.owed,
                'Terms owing': d.termsOwing,
                'Oldest due': d.oldestDue ?? '',
                'Days overdue': d.oldestDue ? daysSince(d.oldestDue) : '',
                'Last payment': d.lastPaymentAt ? d.lastPaymentAt.slice(0, 10) : 'Never',
                'Parent / guardian': d.guardianName ?? '',
                'Phone': d.guardianPhone ?? '',
            })));
            sheet['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 22 }, { wch: 15 }];
            const book = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(book, sheet, 'Defaulters');
            const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
            return new NextResponse(new Uint8Array(buffer), {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="fee-defaulters-${new Date().toISOString().slice(0, 10)}.xlsx"`,
                },
            });
        }
        return NextResponse.json({ data, totalOwed: Math.round(data.reduce((n, d) => n + d.owed, 0) * 100) / 100 } satisfies DefaultersResponse);
    } catch (err: unknown) {
        return internalError('fee defaulters', err);
    }
}
