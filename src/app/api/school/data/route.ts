// src/app/api/school/data/route.ts
// ============================================================
// SCHOOL-SCOPED DATA API
//
// Replaces all direct browser Supabase queries for school data.
// Reads the NextAuth session server-side to get the real schoolId,
// then uses the admin client with explicit school_id filters.
//
// Frontend components should call: GET /api/school/data?type=students
// instead of querying Supabase directly from the browser.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getTeacherPermissions, isStudentVisibleToTeacher, isStreamVisibleToTeacher, isExamVisibleToTeacher } from '@/lib/teacher-utils';

type DataType =
  | 'students'
  | 'parents'
  | 'teachers'
  | 'exam_slots'
  | 'exam_types'
  | 'exam_marks'
  | 'grade_streams'
  | 'academic_years'
  | 'terms'
  | 'users'
  | 'pending_invites'
  | 'school_profile'
  | 'grading_scales'
  | 'exams'
  | 'my_subjects'
  | 'class_teacher_assignments';

async function getSessionSchoolId(): Promise<{ schoolId: string; userId: string; role: string } | null> {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) return null;
  
  const supabaseAdmin = createSupabaseAdmin();
  const { data } = await supabaseAdmin.from('users').select('school_id').eq('id', session.user.id).single();

  return {
    schoolId: (data?.school_id || session.user.schoolId) as string,
    userId: session.user.id,
    role: session.user.role,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSessionSchoolId();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as DataType;
    const schoolId = auth.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: 'No school associated with your account' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (type) {
      case 'students': {
        let query = supabase
          .from('students')
          .select(`
            id, admission_number, status, academic_level_id, current_grade_stream_id,
            guardian_phone, guardian_name, guardian_email, gender, date_of_birth, date_enrolled, avatar_url,
            users!inner (first_name, last_name, email, school_id),
            grade_streams (id, full_name, grade_id)
          `)
          .eq('users.school_id', schoolId);

        const gradeStreamId = searchParams.get('grade_stream_id');
        if (gradeStreamId) {
          query = query.eq('current_grade_stream_id', gradeStreamId);
        }

        const { data, error } = await query.order('admission_number');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        let filteredStudents = data ?? [];
        if (auth.role !== 'ADMIN') {
          const perms = await getTeacherPermissions(auth.userId);
          filteredStudents = filteredStudents.filter(student => isStudentVisibleToTeacher(student, perms));
        }
        
        return NextResponse.json({ data: filteredStudents });
      }

      case 'parents': {
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select(`
            id, admission_number, guardian_name, guardian_phone, guardian_email,
            status, current_grade_stream_id,
            users!inner (first_name, last_name, school_id),
            grade_streams (id, full_name)
          `)
          .eq('users.school_id', schoolId)
          .not('guardian_name', 'is', null)
          .order('guardian_name');

        if (studentsError) return NextResponse.json({ error: studentsError.message }, { status: 400 });

        const parentMap = new Map<string, { id: string; name: string; phone: string; email: string; students: any[] }>();
        for (const s of studentsData ?? []) {
          const key = s.guardian_phone || s.guardian_email || s.guardian_name || 'unknown';
          if (!parentMap.has(key)) {
            parentMap.set(key, { id: `parent_${key.replace(/[^a-zA-Z0-9]/g, '_')}`, name: s.guardian_name || 'Unknown', phone: s.guardian_phone || '', email: s.guardian_email || '', students: [] });
          }
          parentMap.get(key)!.students.push({
            id: s.id, admission_number: s.admission_number,
            first_name: (s.users as any)?.first_name || '', last_name: (s.users as any)?.last_name || '',
            status: s.status, grade_stream: s.grade_streams,
          });
        }

        const parents = Array.from(parentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        return NextResponse.json({ data: parents });
      }

      case 'teachers': {
        const [usersRes, ctRes, stRes] = await Promise.all([
          supabase.from('users').select('id, first_name, last_name, email, phone, role, is_active, avatar_url').eq('school_id', schoolId).in('role', ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER']).order('created_at', { ascending: false }),
          supabase.from('class_teachers').select('user_id, current_grade_stream_id, grade_streams(full_name)'),
          supabase.from('subject_teachers').select('id, user_id'),
        ]);
        if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 400 });

        const teachers = usersRes.data || [];
        const teacherIds = teachers.map(t => t.id);
        const classTeachers = ctRes.data || [];
        const subjectTeachers = stRes.data || [];
        const stIds = subjectTeachers.map(st => st.id);

        let assignments: any[] = [];
        if (stIds.length > 0) {
          const { data } = await supabase.from('subject_teacher_assignments').select('subject_teacher_id, subject_id, grade_id, subjects(name), grades(name_display)').in('subject_teacher_id', stIds);
          assignments = data || [];
        }

        const result = teachers.map(t => {
          const ct = classTeachers.filter(c => c.user_id === t.id);
          const st = subjectTeachers.find(s => s.user_id === t.id);
          const sa = st ? assignments.filter(a => a.subject_teacher_id === st.id) : [];
          const subs = [...new Set(sa.map((a: any) => a.subjects?.name).filter(Boolean))] as string[];
          const cls = [...new Set([...sa.map((a: any) => a.grades?.name_display).filter(Boolean), ...ct.map(c => (c.grade_streams as any)?.full_name).filter(Boolean)])] as string[];
          return {
            id: t.id, employee_id: `TCH-${String(teachers.indexOf(t)+1).padStart(4,'0')}`,
            profile: { first_name: t.first_name, last_name: t.last_name, email: t.email, phone: t.phone || '', avatar_url: t.avatar_url, is_active: t.is_active, role: t.role },
            subjects: subs.join(', '), classes: cls.join(', '),
            stats: { subjectCount: subs.length, classCount: cls.length, examCount: 0, markCount: 0 },
          };
        });
        return NextResponse.json({ data: result });
      }

      case 'exam_types': {
        const { data, error } = await supabase.from('exam_types').select('id, name').eq('school_id', schoolId).order('name');
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'exam_slots': {
        let query = supabase.from('exams').select('id, name, subject_id, grade_stream_id, max_score, date, subjects(name)').eq('school_id', schoolId);
        const gsId = searchParams.get('grade_stream_id');
        const etId = searchParams.get('exam_type_id');
        if (gsId) query = query.eq('grade_stream_id', gsId);
        if (etId) query = query.eq('exam_type_id', etId);
        const { data, error } = await query.order('date', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: (data ?? []).map((e: any) => ({ id: e.id, name: e.name, subject_name: e.subjects?.name, max_score: e.max_score, date: e.date })) });
      }

      case 'exam_marks': {
        const examSlotId = searchParams.get('exam_slot_id');
        if (!examSlotId) return NextResponse.json({ error: 'exam_slot_id required' }, { status: 400 });
        const { data: schoolUsers } = await supabase.from('users').select('id').eq('school_id', schoolId).eq('role', 'STUDENT');
        const studentIds = (schoolUsers || []).map(u => u.id);
        if (studentIds.length === 0) return NextResponse.json({ data: [] });
        const { data, error } = await supabase.from('exam_marks').select('id, student_id, raw_score, percentage, students!inner(admission_number, users(first_name, last_name))').eq('exam_slot_id', examSlotId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const maxScore = searchParams.get('max_score') ? parseInt(searchParams.get('max_score')!) : 100;
        return NextResponse.json({ data: (data ?? []).map((m: any) => ({ id: m.student_id, student_name: `${m.students?.users?.first_name || ''} ${m.students?.users?.last_name || ''}`.trim(), admission_number: m.students?.admission_number || '', score: m.raw_score, max_score: maxScore })) });
      }

      case 'grade_streams': {
        const { data, error } = await supabase
          .from('grade_streams')
          .select('id, name, full_name, grade_id, school_id, grades ( academic_level_id, name_display )')
          .eq('school_id', schoolId)
          .order('full_name');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        let filteredStreams = data || [];

        if (auth.role !== 'ADMIN') {
          const perms = await getTeacherPermissions(auth.userId);
          filteredStreams = filteredStreams.filter(stream => isStreamVisibleToTeacher(stream, perms));
        }

        return NextResponse.json({ data: filteredStreams });
      }

      case 'academic_years': {
        const { data, error } = await supabase
          .from('academic_years')
          .select('id, name, start_date, end_date')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'terms': {
        const { data, error } = await supabase
          .from('terms')
          .select('id, name, academic_year_id, start_date, end_date, is_current')
          .eq('school_id', schoolId)
          .order('start_date');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'users': {
        const { data, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, username, phone, role, is_active, created_at, school_id, plain_password')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'pending_invites': {
        if (auth.role !== 'ADMIN') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { data, error } = await supabase
          .from('pending_invites')
          .select('id, first_name, last_name, phone, role, invite_code, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'school_profile': {
        const { data, error } = await supabase
          .from('schools')
          .select('id, name, address, phone, email, logo_url')
          .eq('id', schoolId)
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data });
      }

      case 'grading_scales': {
        const { data: school } = await supabase
          .from('schools')
          .select('grading_system_cbc_id, grading_system_844_id')
          .eq('id', schoolId)
          .single();

        const systemIds = [];
        if (school?.grading_system_cbc_id) systemIds.push(school.grading_system_cbc_id);
        if (school?.grading_system_844_id) systemIds.push(school.grading_system_844_id);

        let query = supabase
          .from('grading_systems')
          .select(`
            id, name,
            grading_scales (id, symbol, min_percentage, max_percentage, points, label)
          `);
        
        if (systemIds.length > 0) {
          query = query.in('id', systemIds);
        }

        const { data, error } = await query;

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'exams': {
        const { data, error } = await supabase
          .from('exams')
          .select('id, name, max_score, academic_year_id, term_id, status, created_at, grade_stream_id, grade_id, subject_id, subjects(academic_level_id, grading_system_id), grades(academic_level_id)')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        let filteredExams = data ?? [];
        if (auth.role !== 'ADMIN') {
           const perms = await getTeacherPermissions(auth.userId);
           filteredExams = filteredExams.filter(exam => isExamVisibleToTeacher(exam, perms));
        }
        
        return NextResponse.json({ data: filteredExams });
      }

      case 'my_subjects': {
        // Returns subjects assigned to the current user (for subject teachers)
        const perms = await getTeacherPermissions(auth.userId);
        
        if (!perms.isSubjectTeacher) {
          return NextResponse.json({ data: [] });
        }

        // Get subject IDs from assignments
        const subjectIds = [...new Set(perms.subjectTeacherAssignments.map(a => a.subject_id))];
        if (subjectIds.length === 0) {
          return NextResponse.json({ data: [] });
        }

        const { data, error } = await supabase
          .from('subjects')
          .select('id, code, name, academic_level_id, category, is_compulsory, display_order')
          .in('id', subjectIds)
          .order('display_order');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'class_teacher_assignments': {
        // Get all class teacher assignments for the school (for filtering users)
        const { data: classTeachers, error } = await supabase
          .from('class_teachers')
          .select('user_id, current_grade_stream_id, academic_year_id, grade_streams(full_name)')
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        // Get current academic year to filter
        const { data: currentYear } = await supabase
          .from('academic_years')
          .select('id')
          .eq('school_id', schoolId)
          .order('start_date', { ascending: false })
          .limit(1)
          .single();
        
        // Filter to only current year assignments
        const filtered = currentYear 
          ? (classTeachers ?? []).filter(ct => ct.academic_year_id === currentYear.id)
          : classTeachers ?? [];
        
        return NextResponse.json({ data: filtered });
      }

      default:
        return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}