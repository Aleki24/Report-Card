import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { computeFeeStatus } from '@/lib/fees';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
            .maybeSingle();

        if (!userProfile || !['ADMIN', 'CLASS_TEACHER'].includes(userProfile.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        
        // Verify ownership
        const { data: currentFee } = await supabase
            .from('student_fees')
            .select('school_id')
            .eq('id', id)
            .maybeSingle();

        if (!currentFee || currentFee.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();

        const updateData: Record<string, any> = {};
        if (body.total_fee != null) {
            updateData.total_fee = Number(body.total_fee);
            if (isNaN(updateData.total_fee)) {
                return NextResponse.json({ error: 'total_fee must be a number' }, { status: 400 });
            }
            if (updateData.total_fee < 0) {
                return NextResponse.json({ error: 'total_fee cannot be negative' }, { status: 400 });
            }
        }
        if (body.paid_amount != null) {
            updateData.paid_amount = Number(body.paid_amount);
            if (isNaN(updateData.paid_amount)) {
                return NextResponse.json({ error: 'paid_amount must be a number' }, { status: 400 });
            }
            if (updateData.paid_amount < 0) {
                return NextResponse.json({ error: 'paid_amount cannot be negative' }, { status: 400 });
            }
        }
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
                const total = body.total_fee != null ? Number(body.total_fee) : Number(current.total_fee);
                const paid = body.paid_amount != null ? Number(body.paid_amount) : Number(current.paid_amount);
                updateData.status = computeFeeStatus(total, paid);
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
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('role, school_id')
            .eq('id', userId)
            .maybeSingle();

        if (!userProfile || userProfile.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;

        // Verify ownership
        const { data: currentFee } = await supabase
            .from('student_fees')
            .select('school_id')
            .eq('id', id)
            .maybeSingle();

        if (!currentFee || currentFee.school_id !== userProfile.school_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { error } = await supabase.from('student_fees').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
