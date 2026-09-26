import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/postgrest';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const caller = await getCaller();
        if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (caller.role !== 'ADMIN' && caller.role !== 'CLASS_TEACHER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const schoolId = caller.schoolId;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });

        const supabase = createSupabaseAdmin();

        const { searchParams } = new URL(request.url);
        const termId = searchParams.get('term_id');
        const status = searchParams.get('status');
        const gradeStreamId = searchParams.get('grade_stream_id');

        // Paged like the list it exports: one request stops at 1,000 rows.
        const { rows: data, error } = await fetchAllRows(() => {
            let query = supabase
                .from('student_fees')
                .select(`
                    id, total_fee, paid_amount, due_date, status, notes, updated_at,
                    terms ( name ),
                    students!inner ( admission_number, current_grade_stream_id, users ( first_name, last_name ), grade_streams ( full_name ) )
                `)
                .eq('school_id', schoolId);

            if (termId) query = query.eq('term_id', termId);
            if (status) query = query.eq('status', status);
            if (gradeStreamId) query = query.eq('students.current_grade_stream_id', gradeStreamId);
            // A class teacher's export covers their own class only.
            if (caller.role === 'CLASS_TEACHER') query = query.in('students.current_grade_stream_id', caller.classStreamIds);

            return query.order('created_at', { ascending: false }).order('id');
        });
        if (error) throw error;

        const rows = data.map((f: any) => ({
            'Student': f.students?.users ? `${f.students.users.first_name} ${f.students.users.last_name}` : '',
            'Admission No.': f.students?.admission_number || '',
            'Class': f.students?.grade_streams?.full_name || '',
            'Term': f.terms?.name || '',
            'Total Fee (KES)': Number(f.total_fee),
            'Paid (KES)': Number(f.paid_amount),
            'Balance (KES)': Number(f.total_fee) - Number(f.paid_amount),
            'Status': f.status,
            'Due Date': f.due_date || '',
            'Last Updated': f.updated_at ? new Date(f.updated_at).toISOString().slice(0, 10) : '',
            'Notes': f.notes || '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet['!cols'] = [
            { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
            { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
            { wch: 12 }, { wch: 12 }, { wch: 30 },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Fees');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const dateStamp = new Date().toISOString().slice(0, 10);

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="fees-export-${dateStamp}.xlsx"`,
            },
        });
    } catch (err: unknown) {
        return internalError('fees export', err);
    }
}
