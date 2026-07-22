import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { mapBankAccountRow } from '@/lib/fees';

async function requireAdmin() {
    const { userId } = await auth();
    if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
        .from('users')
        .select('role, school_id, is_active')
        .eq('id', userId)
        .maybeSingle();

    if (!userProfile || userProfile.is_active === false) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (userProfile.role !== 'ADMIN') {
        return { error: NextResponse.json({ error: 'Only an admin can manage bank accounts' }, { status: 403 }) };
    }
    if (!userProfile.school_id) {
        return { error: NextResponse.json({ error: 'No school' }, { status: 400 }) };
    }
    return { supabase, schoolId: userProfile.school_id as string };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const result = await requireAdmin();
        if ('error' in result) return result.error;
        const { supabase, schoolId } = result;
        const { id } = await params;

        const { data: existing } = await supabase
            .from('school_bank_accounts')
            .select('id, school_id')
            .eq('id', id)
            .maybeSingle();
        if (!existing || existing.school_id !== schoolId) {
            return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
        }

        const body = await request.json();
        const update: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.bank_name !== undefined) update.bank_name = String(body.bank_name).trim();
        if (body.account_name !== undefined) update.account_name = String(body.account_name).trim();
        if (body.account_number !== undefined) update.account_number = String(body.account_number).trim();
        if (body.branch !== undefined) update.branch = String(body.branch).trim() || null;
        if (body.is_primary !== undefined) update.is_primary = !!body.is_primary;

        if (update.bank_name === '' || update.account_name === '' || update.account_number === '') {
            return NextResponse.json({ error: 'Bank name, account name, and account number cannot be blank' }, { status: 400 });
        }

        if (update.is_primary === true) {
            await supabase.from('school_bank_accounts').update({ is_primary: false }).eq('school_id', schoolId).neq('id', id);
        }

        const { data, error } = await supabase
            .from('school_bank_accounts')
            .update(update)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;
        return NextResponse.json({ data: mapBankAccountRow(data) });
    } catch (err: unknown) {
        return internalError('bank account id', err);
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const result = await requireAdmin();
        if ('error' in result) return result.error;
        const { supabase, schoolId } = result;
        const { id } = await params;

        const { data: existing } = await supabase
            .from('school_bank_accounts')
            .select('id, school_id')
            .eq('id', id)
            .maybeSingle();
        if (!existing || existing.school_id !== schoolId) {
            return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
        }

        const { error } = await supabase.from('school_bank_accounts').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return internalError('bank account id', err);
    }
}
