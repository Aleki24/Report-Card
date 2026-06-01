import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentStudent } from '@/lib/student/get-current-student';

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id, role')
            .eq('id', userId)
            .single();

        const schoolId = userProfile?.school_id;
        const role = userProfile?.role;
        if (!schoolId) return NextResponse.json({ data: [] });

        let query = supabase
            .from('student_fees')
            .select(`
                id, total_fee, paid_amount, due_date, status, notes, created_at, updated_at,
                terms ( id, name ),
                students ( id, users ( first_name, last_name, admission_number ) )
            `)
            .eq('school_id', schoolId);

        // Students see only their own fees
        if (role === 'STUDENT') {
            query = query.eq('student_id', userId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (data ?? []).map((f: any) => ({
            id: f.id,
            totalFee: Number(f.total_fee),
            paidAmount: Number(f.paid_amount),
            balance: Number(f.total_fee) - Number(f.paid_amount),
            dueDate: f.due_date,
            status: f.status,
            notes: f.notes,
            termName: f.terms?.name,
            studentName: f.students?.users ? `${f.students.users.first_name} ${f.students.users.last_name}` : null,
            admissionNumber: f.students?.users?.admission_number,
            createdAt: f.created_at,
            updatedAt: f.updated_at,
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .single();

        if (!userProfile || !['ADMIN', 'CLASS_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const schoolId = userProfile.school_id;
        if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 });

        const body = await request.json();
        const { student_id, term_id, total_fee, paid_amount, due_date, notes } = body;

        if (!student_id || !term_id || total_fee == null) {
            return NextResponse.json({ error: 'student_id, term_id, and total_fee are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('student_fees')
            .upsert({
                school_id: schoolId,
                student_id,
                term_id,
                total_fee,
                paid_amount: paid_amount ?? 0,
                due_date: due_date || null,
                notes: notes || null,
                status: getFeeStatus(total_fee, paid_amount ?? 0),
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

function getFeeStatus(total: number, paid: number): string {
    if (paid <= 0) return 'PENDING';
    if (paid >= total) return paid > total ? 'OVERPAID' : 'PAID';
    return 'PARTIAL';
}
