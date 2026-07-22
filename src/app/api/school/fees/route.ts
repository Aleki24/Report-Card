import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { computeFeeStatus } from '@/lib/fees';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const termId = searchParams.get('term_id');

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id, role')
            .eq('id', userId)
            .maybeSingle();

        const schoolId = userProfile?.school_id;
        const role = userProfile?.role;
        if (!schoolId) return NextResponse.json({ data: [] });

        let query = supabase
            .from('student_fees')
            .select(`
                id, total_fee, paid_amount, due_date, status, notes, created_at, updated_at,
                terms ( id, name ),
                students ( id, admission_number, users ( first_name, last_name ) )
            `)
            .eq('school_id', schoolId);

        // Students see only their own fees
        if (role === 'STUDENT') {
            query = query.eq('student_id', userId);
        }

        if (termId) {
            query = query.eq('term_id', termId);
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
            termId: f.terms?.id ?? null,
            termName: f.terms?.name,
            studentName: f.students?.users ? `${f.students.users.first_name} ${f.students.users.last_name}` : null,
            admissionNumber: f.students?.admission_number,
            createdAt: f.created_at,
            updatedAt: f.updated_at,
        }));

        return NextResponse.json({ data: mapped });
    } catch (err: unknown) {
        return internalError('fees', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        const { student_id, term_id, total_fee, due_date, notes } = body;

        if (!student_id || !term_id || total_fee == null) {
            return NextResponse.json({ error: 'student_id, term_id, and total_fee are required' }, { status: 400 });
        }

        const total = Number(total_fee);

        if (isNaN(total)) {
            return NextResponse.json({ error: 'total_fee must be a number' }, { status: 400 });
        }
        if (total < 0) {
            return NextResponse.json({ error: 'total_fee cannot be negative' }, { status: 400 });
        }

        // Verify the student and term actually belong to this school — prevents
        // billing records being created against another school's records.
        const [{ data: studentRow }, { data: termRow }] = await Promise.all([
            supabase.from('students').select('id, users!inner(school_id)').eq('id', student_id).eq('users.school_id', schoolId).maybeSingle(),
            supabase.from('terms').select('id').eq('id', term_id).eq('school_id', schoolId).maybeSingle(),
        ]);
        if (!studentRow) {
            return NextResponse.json({ error: 'Student not found in your school' }, { status: 404 });
        }
        if (!termRow) {
            return NextResponse.json({ error: 'Term not found in your school' }, { status: 404 });
        }

        // paid_amount/status are derived from the fee_payments ledger (see
        // POST /api/school/fees/[id]/payments), so this only ever touches
        // total_fee/due_date/notes — never overwrite an existing row's
        // ledger-derived paid_amount by blindly upserting it.
        const { data: existing } = await supabase
            .from('student_fees')
            .select('id, paid_amount')
            .eq('student_id', student_id)
            .eq('term_id', term_id)
            .maybeSingle();

        let data;
        if (existing) {
            const { data: updated, error } = await supabase
                .from('student_fees')
                .update({
                    total_fee: total,
                    due_date: due_date || null,
                    notes: notes || null,
                    status: computeFeeStatus(total, Number(existing.paid_amount)),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            data = updated;
        } else {
            const { data: inserted, error } = await supabase
                .from('student_fees')
                .insert({
                    school_id: schoolId,
                    student_id,
                    term_id,
                    total_fee: total,
                    paid_amount: 0,
                    due_date: due_date || null,
                    notes: notes || null,
                    status: computeFeeStatus(total, 0),
                })
                .select()
                .single();
            if (error) throw error;
            data = inserted;
        }

        return NextResponse.json({ data });
    } catch (err: unknown) {
        return internalError('fees', err);
    }
}
