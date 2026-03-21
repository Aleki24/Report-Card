import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const schoolId = session.user.schoolId;
    if (!schoolId) return NextResponse.json({ data: [] });

    const supabase = createSupabaseAdmin();

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
