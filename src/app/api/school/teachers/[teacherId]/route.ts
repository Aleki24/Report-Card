import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teacherId = (await params).teacherId;
    const supabase = createSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('school_id, role').eq('id', userId).maybeSingle();
    const schoolId = userData?.school_id as string | null;
    if (!schoolId) return NextResponse.json({ error: 'No school associated' }, { status: 403 });

    if (userData?.role !== 'ADMIN' && userId !== teacherId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, phone, role, is_active, created_at, school_id, avatar_url')
      .eq('id', teacherId)
      .maybeSingle();

    if (!user || user.school_id !== schoolId) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const [classTeacherRes, subjectTeacherRes, examsRes] = await Promise.all([
      supabase
        .from('class_teachers')
        .select(`
          id, current_grade_stream_id, academic_year_id,
          grade_streams ( full_name ),
          academic_years ( name )
        `)
        .eq('user_id', teacherId),
      supabase
        .from('subject_teachers')
        .select('id')
      .eq('user_id', teacherId)
      .maybeSingle(),
      supabase
        .from('exams')
        .select('id, name, exam_type, exam_date, max_score, grade_stream_id, grade_id, subjects(name), grades(name_display)')
        .eq('created_by_teacher_id', teacherId)
        .order('exam_date', { ascending: false })
        .limit(20),
    ]);

    const classAssignments = classTeacherRes.data || [];
    const stEntry = subjectTeacherRes.data;

    let subjectAssignments: any[] = [];
    let markCount = 0;
    let reportCount = 0;

    if (stEntry) {
      const { data: sas } = await supabase
        .from('subject_teacher_assignments')
        .select(`
          subjects ( id, name, code, category ),
          grades ( id, name_display ),
          grade_streams ( id, full_name ),
          academic_years ( name )
        `)
        .eq('subject_teacher_id', stEntry.id)
        .order('created_at', { ascending: false });

      subjectAssignments = sas || [];

      const examIds = (examsRes.data || []).map(e => e.id);

      if (examIds.length > 0) {
        const { count: mc } = await supabase
          .from('exam_marks')
          .select('id', { count: 'exact', head: true })
          .in('exam_id', examIds);
        markCount = mc ?? 0;
      }

      if (classAssignments.length > 0) {
        const streamIds = classAssignments.map(ca => ca.current_grade_stream_id);
        const { count: rc } = await supabase
          .from('report_cards')
          .select('id', { count: 'exact', head: true })
          .in('grade_stream_id', streamIds);
        reportCount = rc ?? 0;
      }
    }

    return NextResponse.json({
      profile: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone || '—',
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
      },
      classAssignments: classAssignments.map((ca: any) => ({
        id: ca.id,
        stream: (ca.grade_streams as any)?.full_name || '—',
        year: (ca.academic_years as any)?.name || '—',
      })),
      subjectAssignments: subjectAssignments.map((sa: any) => ({
        subject: (sa.subjects as any)?.name || '—',
        subject_code: (sa.subjects as any)?.code || '',
        category: (sa.subjects as any)?.category || '',
        grade: (sa.grades as any)?.name_display || '—',
        stream: (sa.grade_streams as any)?.full_name || null,
        year: (sa.academic_years as any)?.name || '—',
      })),
      recentExams: (examsRes.data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.exam_type,
        date: e.exam_date,
        subject: e.subjects?.name || '—',
        grade: e.grades?.name_display || '—',
      })),
      stats: {
        markCount,
        reportCount,
        examCount: examsRes.data?.length || 0,
        classCount: classAssignments.length,
        subjectCount: subjectAssignments.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
