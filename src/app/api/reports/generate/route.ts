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
      .select('school_id, role, is_active')
      .eq('id', userId)
      .maybeSingle();

    const schoolId = userProfile?.school_id as string;
    const role = userProfile?.role as string;

    if (!userProfile || userProfile.is_active === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with user' }, { status: 403 });
    }

    if (!['ADMIN', 'CLASS_TEACHER'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // All caller-supplied IDs must belong to the caller's school
    const [streamCheck, termCheck, yearCheck] = await Promise.all([
      supabase.from('grade_streams').select('id').eq('id', grade_stream_id).eq('school_id', schoolId).maybeSingle(),
      supabase.from('terms').select('id').eq('id', term_id).eq('school_id', schoolId).maybeSingle(),
      supabase.from('academic_years').select('id').eq('id', academic_year_id).eq('school_id', schoolId).maybeSingle(),
    ]);
    if (!streamCheck.data || !termCheck.data || !yearCheck.data) {
      return NextResponse.json({ error: 'Class, term, or academic year not found for this school' }, { status: 403 });
    }

    // A class teacher may only (re)generate reports for a stream they're
    // assigned to. The RPC's own guard is neutralized under the service-role
    // client (auth.uid() is null → its role check is skipped), so this must be
    // enforced here or a teacher could wipe+regenerate any stream's reports.
    if (role === 'CLASS_TEACHER') {
      const { data: assignment } = await supabase
        .from('class_teachers')
        .select('user_id')
        .eq('user_id', userId)
        .eq('current_grade_stream_id', grade_stream_id)
        .maybeSingle();
      if (!assignment) {
        return NextResponse.json({ error: 'You can only generate reports for your own class.' }, { status: 403 });
      }
    }

    const { error: rpcError } = await supabase.rpc('generate_term_reports', {
      p_academic_year_id: academic_year_id,
      p_term_id: term_id,
      p_grade_stream_id: grade_stream_id,
    });

    if (rpcError) {
      console.error('generate_term_reports RPC failed:', rpcError.message);
      return NextResponse.json({ error: 'Failed to generate reports. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Bulk reports generated successfully!' });
  } catch (err: unknown) {
    console.error('reports/generate error:', err);
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 });
  }
}
