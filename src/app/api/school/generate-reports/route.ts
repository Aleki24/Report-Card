import { NextRequest, NextResponse } from 'next/server';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller();
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schoolId, role } = caller;
    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated' }, { status: 403 });
    }
    // This RPC deletes and regenerates a stream's report cards — staff only.
    if (role !== 'ADMIN' && role !== 'CLASS_TEACHER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    const body = await request.json();
    const term_id = body.term_id || body.p_term_id;
    const grade_stream_id = body.grade_stream_id || body.p_grade_stream_id;

    if (!term_id || !grade_stream_id) {
      return NextResponse.json({ error: 'term_id and grade_stream_id are required' }, { status: 400 });
    }

    // Verify stream belongs to the correct school
    const { data: stream, error: streamError } = await supabase
      .from('grade_streams')
      .select('school_id, grade_id')
      .eq('id', grade_stream_id)
      .maybeSingle();

    if (streamError || stream?.school_id !== schoolId) {
      return NextResponse.json({ error: 'Invalid grade stream' }, { status: 400 });
    }

    // A class teacher may only regenerate their own stream's reports; the RPC's
    // internal guard is bypassed under the service-role client.
    if (role === 'CLASS_TEACHER') {
      if (!caller.classStreamIds.includes(grade_stream_id)) {
        return NextResponse.json({ error: 'You can only generate reports for your own class.' }, { status: 403 });
      }

      /*
        A class teacher generating their own class's reports no longer waits on
        an admin. The release flag still gates the public QR page a parent
        scans; it no longer gates the school's own staff.
      */
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
