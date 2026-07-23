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

export async function GET() {
    try {
        const result = await requireAdmin();
        if ('error' in result) return result.error;
        const { supabase, schoolId } = result;

        const { data, error } = await supabase
            .from('school_bank_accounts')
            .select('*')
            .eq('school_id', schoolId)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ data: (data ?? []).map(mapBankAccountRow) });
    } catch (err: unknown) {
        return internalError('bank accounts', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const result = await requireAdmin();
        if ('error' in result) return result.error;
        const { supabase, schoolId } = result;

        const body = await request.json();
        const bankName = (body.bank_name || '').trim();
        const accountName = (body.account_name || '').trim();
        const accountNumber = (body.account_number || '').trim();
        const branch = (body.branch || '').trim() || null;
        const isPrimary = !!body.is_primary;

        if (!bankName || !accountName || !accountNumber) {
            return NextResponse.json({ error: 'Bank name, account name, and account number are required' }, { status: 400 });
        }

        // Only one account can be primary per school — demote the rest first
        // so the invariant holds without a DB-level constraint.
        if (isPrimary) {
            await supabase.from('school_bank_accounts').update({ is_primary: false }).eq('school_id', schoolId);
        }

        const { data, error } = await supabase
            .from('school_bank_accounts')
            .insert({
                school_id: schoolId,
                bank_name: bankName,
                account_name: accountName,
                account_number: accountNumber,
                branch,
                is_primary: isPrimary,
            })
            .select('*')
            .single();

        if (error) throw error;
        return NextResponse.json({ data: mapBankAccountRow(data) });
    } catch (err: unknown) {
        return internalError('bank accounts', err);
    }
}
