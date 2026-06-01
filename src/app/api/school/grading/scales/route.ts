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
      .select('school_id')
      .eq('id', userId)
      .single();

    const schoolId = userProfile?.school_id;
    if (!schoolId) return NextResponse.json({ data: [] });

    // Fetch scales. Assuming grading systems are linked to the school.
    const { data, error } = await supabase
        .from('grading_scales')
        .select('symbol, label, min_percentage, max_percentage, points, grading_systems!inner(name, school_id)')
        .eq('grading_systems.school_id', schoolId)
        .order('order_index');

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
