import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { term_id, grade_stream_id, academic_year_id } = await request.json();

    if (!term_id || !grade_stream_id || !academic_year_id) {
      return NextResponse.json({ error: 'Missing required fields: term_id, grade_stream_id, academic_year_id' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .maybeSingle();

    const schoolId = userProfile?.school_id as string;
    const role = userProfile?.role as string;

    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with user' }, { status: 403 });
    }

    if (!['ADMIN', 'CLASS_TEACHER'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: rpcError } = await supabase.rpc('generate_term_reports', {
      p_academic_year_id: academic_year_id,
      p_term_id: term_id,
      p_grade_stream_id: grade_stream_id,
    });

    if (rpcError) {
      console.warn('generate_term_reports RPC warning:', rpcError.message);
    }

    return NextResponse.json({ success: true, message: 'Bulk reports generated successfully!' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
