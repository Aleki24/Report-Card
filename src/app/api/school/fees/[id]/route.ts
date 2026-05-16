import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || !['ADMIN', 'CLASS_TEACHER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const supabase = createSupabaseAdmin();

        const updateData: Record<string, any> = {};
        if (body.total_fee != null) updateData.total_fee = body.total_fee;
        if (body.paid_amount != null) updateData.paid_amount = body.paid_amount;
        if (body.due_date !== undefined) updateData.due_date = body.due_date;
        if (body.notes !== undefined) updateData.notes = body.notes;
        updateData.updated_at = new Date().toISOString();

        if (body.total_fee != null || body.paid_amount != null) {
            const { data: current } = await supabase
                .from('student_fees')
                .select('total_fee, paid_amount')
                .eq('id', id)
                .single();

            if (current) {
                const total = body.total_fee ?? Number(current.total_fee);
                const paid = body.paid_amount ?? Number(current.paid_amount);
                updateData.status = paid <= 0 ? 'PENDING' : paid >= total ? (paid > total ? 'OVERPAID' : 'PAID') : 'PARTIAL';
            }
        }

        const { data, error } = await supabase
            .from('student_fees')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions) as any;
        if (!session?.user?.id || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const supabase = createSupabaseAdmin();

        const { error } = await supabase.from('student_fees').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
