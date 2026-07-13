import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('school_id').eq('id', userId).maybeSingle();
    const schoolId = userData?.school_id as string | null;
    if (!schoolId) return NextResponse.json({ data: [] });

    const [usersRes, currentYearRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, first_name, last_name, email, phone, role, is_active, created_at, avatar_url')
        .eq('school_id', schoolId)
        .in('role', ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'])
        .order('created_at', { ascending: false }),
      supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const currentYear = currentYearRes.data;
    const teachers = usersRes.data || [];

    const teacherIds = teachers.map(t => t.id);

    const [classTeachersRes, subjectTeachersRes] = await Promise.all([
      supabase
        .from('class_teachers')
        .select('user_id, current_grade_stream_id, grade_streams(full_name)')
        .in('user_id', teacherIds),
      supabase
        .from('subject_teachers')
        .select('id, user_id')
        .in('user_id', teacherIds),
    ]);

    const classTeachers = classTeachersRes.data || [];
    const subjectTeachers = subjectTeachersRes.data || [];
    const subjectTeacherIds = subjectTeachers.map(st => st.id);

    let assignments: any[] = [];
    if (subjectTeacherIds.length > 0) {
      let query = supabase
        .from('subject_teacher_assignments')
        .select(`
          subject_teacher_id, subject_id, grade_id, grade_stream_id,
          subjects ( name ),
          grade_streams ( full_name ),
          grades ( name_display )
        `)
        .in('subject_teacher_id', subjectTeacherIds);

      if (currentYear) {
        query = query.eq('academic_year_id', currentYear.id);
      }

      const { data } = await query;
      assignments = data || [];
    }

    const result = teachers.map(t => {
      const ctEntries = classTeachers.filter(ct => ct.user_id === t.id);
      const stEntry = subjectTeachers.find(st => st.user_id === t.id);
      const stAssignments = stEntry
        ? assignments.filter(a => a.subject_teacher_id === stEntry.id)
        : [];

      const subjects = stAssignments
        .map((a: any) => a.subjects?.name)
        .filter(Boolean);
      const uniqueSubjects = [...new Set(subjects)];

      const classes = stAssignments
        .map((a: any) => a.grade_streams?.full_name || a.grades?.name_display)
        .filter(Boolean);
      ctEntries.forEach(ct => {
        const name = (ct.grade_streams as any)?.full_name;
        if (name) classes.push(name);
      });
      const uniqueClasses = [...new Set(classes)];

      const employeeId = `TCH-${String(teachers.indexOf(t) + 1).padStart(4, '0')}`;

      let displayRole = t.role === 'ADMIN' ? 'Admin' : '';
      if (t.role === 'CLASS_TEACHER') displayRole = 'Class Teacher';
      if (t.role === 'SUBJECT_TEACHER') displayRole = 'Subject Teacher';
      // Check if teacher has both class and subject assignments
      if (ctEntries.length > 0 && stAssignments.length > 0) displayRole = 'Class & Subject Teacher';

      const status = t.is_active ? 'Active' : 'Inactive';

      return {
        id: t.id,
        name: `${t.first_name} ${t.last_name}`,
        email: t.email,
        phone: t.phone || '—',
        employeeId,
        role: t.role,
        displayRole,
        subjects: uniqueSubjects,
        classes: uniqueClasses,
        status,
        workload: `${stAssignments.length} subject(s), ${ctEntries.length > 0 ? '1 homeroom' : '0 homeroom'}`,
        is_active: t.is_active,
        created_at: t.created_at,
        hasClass: ctEntries.length > 0,
        hasSubjects: uniqueSubjects.length > 0,
      };
    });

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
