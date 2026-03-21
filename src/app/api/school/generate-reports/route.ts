import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated' }, { status: 403 });
    }

    const body = await request.json();
    const term_id = body.term_id || body.p_term_id;
    const grade_stream_id = body.grade_stream_id || body.p_grade_stream_id;

    if (!term_id || !grade_stream_id) {
      return NextResponse.json({ error: 'term_id and grade_stream_id are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify stream belongs to the correct school
    const { data: stream, error: streamError } = await supabase
      .from('grade_streams')
      .select('school_id')
      .eq('id', grade_stream_id)
      .single();

    if (streamError || stream?.school_id !== schoolId) {
      return NextResponse.json({ error: 'Invalid grade stream' }, { status: 400 });
    }

    // Call the RPC function
    const { error: rpcError } = await supabase.rpc('generate_term_reports', {
      p_term_id: term_id,
      p_grade_stream_id: grade_stream_id,
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Reports generated successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
