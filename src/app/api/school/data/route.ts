import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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
  | 'subjects'
  | 'class_teacher_assignments'
  | 'subject_combinations';

async function getSessionSchoolId(): Promise<{ schoolId: string; userId: string; role: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  
  const supabaseAdmin = createSupabaseAdmin();
  const { data } = await supabaseAdmin.from('users').select('school_id, role, is_active').eq('id', userId).maybeSingle();

  if (!data || data.is_active === false) return null;

  return {
    schoolId: data.school_id as string,
    userId,
    role: data.role,
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
            pathway, track, subject_combination_id,
            users!inner (first_name, last_name, email, school_id),
            grade_streams (id, full_name, grade_id),
            subject_combinations (id, code, name, pathway, track)
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

        // Optional subject roster filter (mark entry): when any of these
        // students are explicitly enrolled in the subject (8-4-4 electives
        // like CRE, or CBC pathway electives via student_subjects), return
        // only the enrolled takers. Subjects with no enrollment data keep
        // returning the whole class (backwards compatible).
        const subjectId = searchParams.get('subject_id');
        if (subjectId && filteredStudents.length > 0) {
          const { data: enrollments } = await supabase
            .from('student_subjects')
            .select('student_id')
            .eq('subject_id', subjectId)
            .in('student_id', filteredStudents.map((s: any) => s.id));
          const enrolledIds = new Set((enrollments ?? []).map(e => e.student_id));
          if (enrolledIds.size > 0) {
            filteredStudents = filteredStudents.filter((s: any) => enrolledIds.has(s.id));
          }
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
        const usersRes = await supabase.from('users').select('id, first_name, last_name, email, phone, role, is_active, avatar_url').eq('school_id', schoolId).in('role', ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER']).order('created_at', { ascending: false });
        if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 400 });

        const teachers = usersRes.data || [];
        const teacherIds = teachers.map(t => t.id);

        const [ctRes, stRes] = await Promise.all([
          supabase.from('class_teachers').select('user_id, current_grade_stream_id, grade_streams(full_name)').in('user_id', teacherIds),
          supabase.from('subject_teachers').select('id, user_id').in('user_id', teacherIds),
        ]);

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
        const { ALL_EXAM_TYPES } = require('@/lib/exam-types');
        const formattedTypes = ALL_EXAM_TYPES.map((et: any) => ({
          id: et.code,
          name: et.name
        }));
        return NextResponse.json({ data: formattedTypes });
      }

      case 'exam_slots': {
        let query = supabase.from('exams').select('id, name, subject_id, grade_stream_id, grade_id, max_score, exam_date, exam_type, subjects(name)').eq('school_id', schoolId);
        const gsId = searchParams.get('grade_stream_id');
        const examType = searchParams.get('exam_type_id');
        
        if (gsId) {
          // Find the grade_id of the stream so we can include whole-grade exams
          const { data: stream } = await supabase.from('grade_streams').select('grade_id').eq('id', gsId).single();
          if (stream?.grade_id) {
            query = query.or(`grade_stream_id.eq.${gsId},and(grade_id.eq.${stream.grade_id},grade_stream_id.is.null)`);
          } else {
            query = query.eq('grade_stream_id', gsId);
          }
        }
        
        if (examType) query = query.eq('exam_type', examType);
        
        const { data, error } = await query.order('exam_date', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: (data ?? []).map((e: any) => ({ id: e.id, name: e.name, subject_name: e.subjects?.name, max_score: e.max_score, date: e.exam_date })) });
      }

      case 'exam_marks': {
        const examSlotId = searchParams.get('exam_slot_id');
        if (!examSlotId) return NextResponse.json({ error: 'exam_slot_id required' }, { status: 400 });
        const { data: schoolUsers } = await supabase.from('users').select('id').eq('school_id', schoolId).eq('role', 'STUDENT');
        const studentIds = (schoolUsers || []).map(u => u.id);
        if (studentIds.length === 0) return NextResponse.json({ data: [] });
        const { data, error } = await supabase.from('exam_marks').select('id, exam_id, student_id, raw_score, percentage, students!inner(admission_number, users(first_name, last_name))').in('exam_id', [examSlotId]).in('student_id', studentIds);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const maxScore = searchParams.get('max_score') ? parseInt(searchParams.get('max_score')!) : 100;
        return NextResponse.json({ data: (data ?? []).map((m: any) => ({ id: m.id, exam_id: m.exam_id, student_id: m.student_id, student_name: `${m.students?.users?.first_name || ''} ${m.students?.users?.last_name || ''}`.trim(), admission_number: m.students?.admission_number || '', score: m.raw_score, max_score: maxScore })) });
      }

      case 'subjects': {
        // All subjects taught at the school, unrestricted by role — matches
        // /api/admin/academic-structure, which stopped filtering subjects so
        // any teacher can see newly created ones in dropdowns. Unlike
        // my_subjects, this isn't scoped to a specific teacher's assignments.
        const { data, error } = await supabase
          .from('subjects')
          .select('id, code, name, academic_level_id, category, display_order')
          .eq('school_id', schoolId)
          .order('display_order');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
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
          .select(`
            id, first_name, last_name, email, username, phone, role, is_active, created_at, school_id,
            students!left ( admission_number )
          `)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        // Flatten nested students.admission_number
        const mapped = (data ?? []).map((u: any) => ({
          ...u,
          admission_number: u.students?.admission_number ?? null,
          students: undefined
        }));
        return NextResponse.json({ data: mapped });
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
          .select('id, name, address, phone, email, logo_url, teacher_invite_code, student_invite_code, min_combination_group_size')
          .eq('id', schoolId)
          .maybeSingle();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data });
      }

      case 'grading_scales': {
        const { data, error } = await supabase
          .from('grading_systems')
          .select(`
            id, name,
            grading_scales (id, symbol, min_percentage, max_percentage, points, label)
          `);

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'exams': {
        const { data, error } = await supabase
          .from('exams')
          .select('id, name, exam_type, max_score, academic_year_id, term_id, status, published_by, approved_by, created_at, grade_stream_id, grade_id, subject_id, created_by_teacher_id, subjects(academic_level_id, grading_system_id), grades(academic_level_id)')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        let filteredExams = data ?? [];
        if (auth.role !== 'ADMIN') {
           const perms = await getTeacherPermissions(auth.userId);
           filteredExams = filteredExams.filter(exam => isExamVisibleToTeacher(exam, perms, auth.userId));
        }
        
        return NextResponse.json({ data: filteredExams });
      }

      case 'my_subjects': {
        // Returns subjects assigned to the current user
        const perms = await getTeacherPermissions(auth.userId);
        
        if (perms.subjectTeacherAssignments.length === 0) {
          return NextResponse.json({ data: [] });
        }

        // Get subject IDs from assignments
        const subjectIds = [...new Set(perms.subjectTeacherAssignments.map(a => a.subject_id))];
        if (subjectIds.length === 0) {
          return NextResponse.json({ data: [] });
        }

        const { data, error } = await supabase
          .from('subjects')
          .select('id, code, name, academic_level_id, category, display_order')
          .in('id', subjectIds)
          .order('display_order');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'class_teacher_assignments': {
        // Get all class teacher assignments for the school (for filtering users)
        const { data: classTeachers, error } = await supabase
          .from('class_teachers')
          .select('user_id, current_grade_stream_id, academic_year_id, grade_streams!inner(full_name, school_id)')
          .eq('grade_streams.school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        
        // Get current academic year to filter
          const { data: currentYear } = await supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', schoolId)
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        // Filter to only current year assignments
        const filtered = currentYear 
          ? (classTeachers ?? []).filter(ct => ct.academic_year_id === currentYear.id)
          : classTeachers ?? [];
        
        return NextResponse.json({ data: filtered });
      }

      case 'subject_combinations': {
        const { data, error } = await supabase
          .from('subject_combinations')
          .select('id, code, name, pathway, track, is_active, subject_combination_subjects ( subject_id, subjects ( id, name, code ) )')
          .eq('school_id', schoolId)
          .order('code');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const mapped = (data ?? []).map((c: any) => ({
          ...c,
          subjects: (c.subject_combination_subjects ?? []).map((row: any) => row.subjects).filter(Boolean),
          subject_combination_subjects: undefined,
        }));
        return NextResponse.json({ data: mapped });
      }

      default:
        return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}