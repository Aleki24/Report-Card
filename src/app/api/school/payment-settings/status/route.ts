import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { mapBankAccountRow } from '@/lib/fees';

/** Any signed-in user in the school can check which payment channels are switched on — no secrets here. */
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabase = createSupabaseAdmin();
        const { data: userProfile } = await supabase
            .from('users')
            .select('school_id')
            .eq('id', userId)
            .maybeSingle();
        if (!userProfile?.school_id) {
            return NextResponse.json({ data: { active: false, provider: 'NONE', bankEnabled: false, bankAccounts: [] } });
        }

        const [{ data: settings }, { data: bankAccounts }] = await Promise.all([
            supabase
                .from('school_payment_settings')
                .select('active_provider, bank_enabled')
                .eq('school_id', userProfile.school_id)
                .maybeSingle(),
            supabase
                .from('school_bank_accounts')
                .select('*')
                .eq('school_id', userProfile.school_id)
                .order('is_primary', { ascending: false })
                .order('created_at', { ascending: true }),
        ]);

        const provider = settings?.active_provider ?? 'NONE';
        const bankEnabled = settings?.bank_enabled ?? false;
        return NextResponse.json({
            data: {
                active: provider !== 'NONE',
                provider,
                bankEnabled,
                bankAccounts: bankEnabled ? (bankAccounts ?? []).map(mapBankAccountRow) : [],
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
