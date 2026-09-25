import { NextRequest, NextResponse } from 'next/server';
import { subjectTakers } from '@/lib/subject-roster';
import { getCaller } from '@/lib/auth-server';
import { ALL_EXAM_TYPES } from '@/lib/exam-types';
import { STAFF_TEACHING_ROLES, isRoleIn } from '@/lib/roles';
import type { UserRole } from '@/types';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import { guardianKey, type ParentContact } from '@/lib/guardians';
import { SCHOOL_SUBJECT_VIEW, gradingSystemBySubject } from '@/lib/school-subjects';
import { canTeacherMarkStudent, getTeacherPermissions, isStudentVisibleToTeacher, isStreamVisibleToTeacher, isExamVisibleToTeacher } from '@/lib/teacher-utils';

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

async function getSessionSchoolId(): Promise<{ schoolId: string | null; userId: string; role: UserRole } | null> {
  const caller = await getCaller();
  return caller ? { schoolId: caller.schoolId, userId: caller.userId, role: caller.role } : null;
}

/**
 * Types that describe other people or the school's own setup. Every type used
 * to be readable by any signed-in account, so a student could list every user
 * with their phone and email, every guardian, and any exam's marks.
 */
const TYPE_ROLES: Partial<Record<DataType, readonly UserRole[]>> = {
  parents: ['ADMIN'],
  users: ['ADMIN'],
  pending_invites: ['ADMIN'],
  teachers: [...STAFF_TEACHING_ROLES, 'STAFF'],
  exam_slots: STAFF_TEACHING_ROLES,
  exam_marks: STAFF_TEACHING_ROLES,
  exams: STAFF_TEACHING_ROLES,
  class_teacher_assignments: STAFF_TEACHING_ROLES,
};

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

    const allowedRoles = TYPE_ROLES[type];
    if (allowedRoles && !isRoleIn(auth.role, allowedRoles)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();

    switch (type) {
      case 'students': {
        const gradeStreamId = searchParams.get('grade_stream_id');
        // Paged: a school past 1,000 learners was silently cut short.
        const { rows: data, error } = await fetchAllRows(() => {
          let query = supabase
            .from('students')
            .select(`
              id, admission_number, status, academic_level_id, current_grade_stream_id,
              guardian_phone, guardian_name, guardian_email, gender, date_of_birth, date_enrolled, avatar_url,
              pathway, track, subject_combination_id,
              users!inner (first_name, last_name, email, phone, school_id),
              grade_streams (id, full_name, grade_id),
              subject_combinations (id, code, name, pathway, track)
            `)
            .eq('users.school_id', schoolId);
          if (gradeStreamId) query = query.eq('current_grade_stream_id', gradeStreamId);
          // Admission numbers are optional, so id keeps the page order stable.
          return query.order('admission_number').order('id');
        });

        if (error) return NextResponse.json({ error: 'Could not load students.' }, { status: 400 });

        let filteredStudents = data;
        const subjectId = searchParams.get('subject_id');
        if (auth.role !== 'ADMIN') {
          const perms = await getTeacherPermissions(auth.userId);
          // Mark entry: only the streams this teacher teaches the subject in
          // (or their own class), not every learner they can see elsewhere.
          filteredStudents = subjectId
            ? filteredStudents.filter(student => canTeacherMarkStudent(perms, subjectId, {
                current_grade_stream_id: student.current_grade_stream_id,
                grade_id: (Array.isArray(student.grade_streams) ? student.grade_streams[0] : student.grade_streams)?.grade_id ?? null,
              }))
            : filteredStudents.filter(student => isStudentVisibleToTeacher(student, perms));
        }

        // Mark entry passes the exam's subject: only the learners who take it
        // are returned, and `roster` says why, so an empty elective list can
        // explain itself instead of looking like a bug.
        if (subjectId) {
          const { students: takers, mode } = await subjectTakers(supabase, subjectId, filteredStudents);
          return NextResponse.json({ data: takers, roster: mode });
        }

        return NextResponse.json({ data: filteredStudents });
      }

      case 'parents': {
        const { rows: studentsData, error: studentsError } = await fetchAllRows(() => supabase
          .from('students')
          .select(`
            id, admission_number, guardian_name, guardian_phone, guardian_email,
            status, current_grade_stream_id,
            users!inner (first_name, last_name, school_id),
            grade_streams (id, full_name)
          `)
          .eq('users.school_id', schoolId)
          // A guardian with a phone but no name is still someone to reach.
          .or('guardian_name.not.is.null,guardian_phone.not.is.null,guardian_email.not.is.null')
          .order('id'));

        if (studentsError) return NextResponse.json({ error: 'Could not load parents.' }, { status: 400 });

        const parentMap = new Map<string, ParentContact>();
        for (const s of studentsData) {
          const key = guardianKey(s.guardian_phone, s.guardian_email, s.guardian_name);
          if (!key) continue;
          const learner = embedOne(s.users);
          let parent = parentMap.get(key);
          if (!parent) {
            parent = { id: `parent_${key.replace(/[^a-zA-Z0-9]/g, '_')}`, name: s.guardian_name?.trim() || '', phone: s.guardian_phone?.trim() || '', email: s.guardian_email?.trim() || '', students: [] };
            parentMap.set(key, parent);
          }
          // Siblings' records may each hold only part of the contact.
          parent.name ||= s.guardian_name?.trim() || '';
          parent.phone ||= s.guardian_phone?.trim() || '';
          parent.email ||= s.guardian_email?.trim() || '';
          parent.students.push({
            id: s.id, admission_number: s.admission_number,
            first_name: learner?.first_name || '', last_name: learner?.last_name || '',
            status: s.status, grade_stream: embedOne(s.grade_streams),
          });
        }

        const parents = Array.from(parentMap.values(), p => ({
          ...p,
          name: p.name || `Guardian of ${p.students[0]?.first_name || 'a student'}`,
        })).sort((a, b) => a.name.localeCompare(b.name));
        return NextResponse.json({ data: parents });
      }

      case 'teachers': {
        const usersRes = await supabase.from('users').select('id, first_name, last_name, email, phone, role, is_active, avatar_url, job_title').eq('school_id', schoolId).in('role', ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF']).order('created_at', { ascending: false });
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
            profile: { first_name: t.first_name, last_name: t.last_name, email: t.email, phone: t.phone || '', avatar_url: t.avatar_url, is_active: t.is_active, role: t.role, job_title: t.job_title ?? null },
            subjects: subs.join(', '), classes: cls.join(', '),
            stats: { subjectCount: subs.length, classCount: cls.length, examCount: 0, markCount: 0 },
          };
        });
        return NextResponse.json({ data: result });
      }

      case 'exam_types': {
        const formattedTypes = ALL_EXAM_TYPES.map(et => ({
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
        // Scope by the exam's school rather than by listing every student id
        // in the school, which PostgREST caps at 1,000 rows.
        const { data: exam } = await supabase.from('exams').select('*').eq('id', examSlotId).eq('school_id', schoolId).maybeSingle();
        if (!exam) return NextResponse.json({ data: [] });
        if (auth.role !== 'ADMIN') {
          const perms = await getTeacherPermissions(auth.userId);
          if (!isExamVisibleToTeacher(exam, perms, auth.userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { data, error } = await supabase.from('exam_marks').select('id, exam_id, student_id, raw_score, percentage, students!inner(admission_number, users(first_name, last_name))').eq('exam_id', examSlotId);
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
          .from(SCHOOL_SUBJECT_VIEW)
          .select('id, code, name, academic_level_id, category, display_order, band')
          .eq('school_id', schoolId)
          .order('display_order');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'grade_streams': {
        const { data, error } = await supabase
          .from('grade_streams')
          .select('id, name, full_name, grade_id, school_id, grades ( academic_level_id, name_display, academic_levels ( code ) )')
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
          .select('id, name, academic_year_id, start_date, end_date, is_current, midterm_reopening_date, reopening_date, academic_years ( name )')
          .eq('school_id', schoolId)
          .order('start_date');

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        // "Term 1" repeats every year; the year name tells them apart.
        const terms = (data ?? []).map(({ academic_years, ...term }) => ({
          ...term,
          academic_year_name: embedOne(academic_years as { name: string } | { name: string }[] | null)?.name ?? null,
        }));
        return NextResponse.json({ data: terms });
      }

      case 'users': {
        const { data, error } = await supabase
          .from('users')
          .select(`
            id, first_name, last_name, email, username, phone, role, is_active, created_at, school_id, job_title, avatar_url,
            students!left ( admission_number, avatar_url, grade_streams ( full_name, grades ( name_display, numeric_order ) ) )
          `)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        // Flatten the one-to-one students row: a learner's photo lives on
        // students.avatar_url, everyone else's on users.avatar_url.
        const mapped = (data ?? []).map(({ students, ...u }) => {
          const student = embedOne(students);
          const stream = embedOne(student?.grade_streams);
          const grade = embedOne(stream?.grades);
          return {
            ...u,
            avatar_url: student?.avatar_url ?? u.avatar_url ?? null,
            admission_number: student?.admission_number ?? null,
            class_name: stream?.full_name ?? null,
            grade_name: grade?.name_display ?? null,
            grade_order: grade?.numeric_order ?? null,
          };
        });
        return NextResponse.json({ data: mapped });
      }

      case 'pending_invites': {
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
          .select('id, name, address, phone, email, logo_url, teacher_invite_code, student_invite_code, min_combination_group_size, overall_grading_system_id, cbc_ranking_enabled, senior_rank_group')
          .eq('id', schoolId)
          .maybeSingle();

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        // The school-wide invite codes are the admin's to hand out; everyone
        // else (the sidebar logo, report settings) only needs the profile.
        if (data && auth.role !== 'ADMIN') {
          return NextResponse.json({ data: { ...data, teacher_invite_code: undefined, student_invite_code: undefined } });
        }
        return NextResponse.json({ data });
      }

      case 'grading_scales': {
        // Scoped to this school plus the seeded defaults, which carry a null
        // school_id and are offered to everyone. Without the filter this
        // returned every school's grading systems to every signed-in user.
        const { data, error } = await supabase
          .from('grading_systems')
          .select(`
            id, name,
            grading_scales (id, symbol, min_percentage, max_percentage, points, label)
          `)
          .or(`school_id.eq.${schoolId},school_id.is.null`);

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ data: data ?? [] });
      }

      case 'exams': {
        const { data, error } = await supabase
          .from('exams')
          .select('id, name, exam_type, max_score, academic_year_id, term_id, status, published_by, approved_by, created_at, grade_stream_id, grade_id, subject_id, created_by_teacher_id, subjects(academic_level_id), grades(academic_level_id)')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        // The grading system moved off the subject onto the school's offering,
        // and PostgREST cannot reach a join table from inside an embed. Look it
        // up once and put it back under `subjects.grading_system_id`, the key
        // every caller of this endpoint already reads — the mark-entry grid,
        // the scan sheet, the bulk upload and the edit-mark modal all take the
        // subject's grading system from exactly there.
        const gradingBySubject = await gradingSystemBySubject(supabase, schoolId);
        const withGrading = (data ?? []).map(exam => {
          const subject = exam.subjects as { academic_level_id?: string } | null;
          return {
            ...exam,
            subjects: subject
              ? { ...subject, grading_system_id: gradingBySubject.get(exam.subject_id) ?? null }
              : subject,
          };
        });

        let filteredExams = withGrading;
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

        // Scoped by school as well as by assignment: an assignment can only
        // name a subject the school offers, and reading through the view keeps
        // that true even if an assignment goes stale.
        const { data, error } = await supabase
          .from(SCHOOL_SUBJECT_VIEW)
          .select('id, code, name, academic_level_id, category, display_order, band')
          .eq('school_id', schoolId)
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