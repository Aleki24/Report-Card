import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const supabase = createSupabaseAdmin();
    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (!userProfile || userProfile.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = userProfile?.school_id;
    if (!schoolId) return NextResponse.json({ data: [] });

    const { data: schoolData } = await supabase
      .from('schools')
      .select('grading_system_cbc_id, grading_system_844_id')
      .eq('id', schoolId)
      .maybeSingle();

    const systemIds = [schoolData?.grading_system_cbc_id, schoolData?.grading_system_844_id].filter(Boolean);
    if (systemIds.length === 0) return NextResponse.json({ data: [] });

    // Fetch scales for the school's configured grading systems
    const { data, error } = await supabase
        .from('grading_scales')
        .select('symbol, label, min_percentage, max_percentage, points, grading_system_id')
        .in('grading_system_id', systemIds)
        .order('order_index');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
