import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** Any signed-in user in the school can check which payment provider (if any) is switched on — no secrets here. */
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
        if (!userProfile?.school_id) return NextResponse.json({ data: { active: false, provider: 'NONE' } });

        const { data } = await supabase
            .from('school_payment_settings')
            .select('active_provider')
            .eq('school_id', userProfile.school_id)
            .maybeSingle();

        const provider = data?.active_provider ?? 'NONE';
        return NextResponse.json({ data: { active: provider !== 'NONE', provider } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
