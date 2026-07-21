import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

/** Any signed-in user in the school can check whether M-Pesa is switched on — no secrets here. */
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
        if (!userProfile?.school_id) return NextResponse.json({ data: { active: false } });

        const { data } = await supabase
            .from('school_payment_settings')
            .select('is_active')
            .eq('school_id', userProfile.school_id)
            .maybeSingle();

        return NextResponse.json({ data: { active: !!data?.is_active } });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
