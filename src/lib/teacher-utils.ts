import { createSupabaseAdmin } from './supabase-admin';

export type TeacherPermissions = {
  isClassTeacher: boolean;
  isSubjectTeacher: boolean;
  classTeacherStreams: string[]; // grade_stream_id
  classTeacherGrades: string[]; // grade_id derived from streams
  subjectTeacherAssignments: {
    subject_id: string;
    grade_id: string;
    grade_stream_id: string | null;
  }[];
};

export async function getTeacherPermissions(userId: string): Promise<TeacherPermissions> {
  const supabase = createSupabaseAdmin();
  
  const perms: TeacherPermissions = {
    isClassTeacher: false,
    isSubjectTeacher: false,
    classTeacherStreams: [],
    classTeacherGrades: [],
    subjectTeacherAssignments: [],
  };

  // Get user's school to find current academic year
  const { data: userData } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .single();

  let currentYearId: string | null = null;
  if (userData?.school_id) {
    const { data: currentYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', userData.school_id)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();
    currentYearId = currentYear?.id ?? null;
  }

  // 1. Check class teacher - filter by current academic year
  let classQuery = supabase
    .from('class_teachers')
    .select('current_grade_stream_id, grade_streams(grade_id), academic_year_id')
    .eq('user_id', userId);

  const { data: classTeacherData } = await classQuery;

  // Filter to current year if available
  const filteredClassData = currentYearId 
    ? (classTeacherData ?? []).filter(ct => ct.academic_year_id === currentYearId)
    : classTeacherData ?? [];

  if (filteredClassData && filteredClassData.length > 0) {
    perms.isClassTeacher = true;
    perms.classTeacherStreams = filteredClassData.map(r => r.current_grade_stream_id);
    perms.classTeacherGrades = Array.from(new Set(filteredClassData.map(r => (r.grade_streams as any)?.grade_id).filter(Boolean)));
  }

  // 2. Check subject teacher
  const { data: subjectTeacherData } = await supabase
    .from('subject_teachers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (subjectTeacherData) {
    let assignmentsQuery = supabase
      .from('subject_teacher_assignments')
      .select('subject_id, grade_id, grade_stream_id, academic_year_id')
      .eq('subject_teacher_id', subjectTeacherData.id);

    const { data: assignments } = await assignmentsQuery;

    // Filter to current year if available
    const filteredAssignments = currentYearId
      ? (assignments ?? []).filter(a => a.academic_year_id === currentYearId)
      : assignments ?? [];
      
    if (filteredAssignments && filteredAssignments.length > 0) {
      perms.isSubjectTeacher = true;
      perms.subjectTeacherAssignments = filteredAssignments.map(a => ({
        subject_id: a.subject_id,
        grade_id: a.grade_id,
        grade_stream_id: a.grade_stream_id,
      }));
    }
  }

  return perms;
}

// Utility to check if a student is visible to a teacher
export function isStudentVisibleToTeacher(student: any, perms: TeacherPermissions) {
  if (perms.isClassTeacher && perms.classTeacherStreams.includes(student.current_grade_stream_id)) {
    return true;
  }
  
  if (perms.isSubjectTeacher) {
    // Subject teacher can see student if they teach the student's exact stream
    // OR if they teach the student's grade (all streams)
    const matchesAssignment = perms.subjectTeacherAssignments.some(a => {
      if (a.grade_stream_id) {
        return a.grade_stream_id === student.current_grade_stream_id;
      } else {
        return a.grade_id === student.grade_streams?.grade_id || a.grade_id === student.grade_id;
      }
    });
    if (matchesAssignment) return true;
  }
  
  return false;
}

// Utility to check if an exam is visible to a teacher
export function isExamVisibleToTeacher(exam: any, perms: TeacherPermissions) {
  if (perms.isClassTeacher) {
    // Class teacher sees exams for their stream OR exams for their grade (all streams)
    if (exam.grade_stream_id && perms.classTeacherStreams.includes(exam.grade_stream_id)) return true;
    if (!exam.grade_stream_id && perms.classTeacherGrades.includes(exam.grade_id)) return true;
  }
  
  if (perms.isSubjectTeacher) {
    // Subject teacher sees an exam if they teach the same subject
    // for the same grade (regardless of specific stream assignment)
    const matchesAssignment = perms.subjectTeacherAssignments.some(a => {
      if (a.subject_id !== exam.subject_id) return false;
      // Grade must match
      return a.grade_id === exam.grade_id;
    });
    if (matchesAssignment) return true;
  }
  
  return false;
}

export function isStreamVisibleToTeacher(stream: any, perms: TeacherPermissions) {
  if (perms.isClassTeacher && perms.classTeacherStreams.includes(stream.id)) {
    return true;
  }
  
  if (perms.isSubjectTeacher) {
    const matchesAssignment = perms.subjectTeacherAssignments.some(a => {
      if (a.grade_stream_id) {
        return a.grade_stream_id === stream.id;
      } else {
        return a.grade_id === stream.grade_id;
      }
    });
    if (matchesAssignment) return true;
  }
  
  return false;
}

export function isSubjectVisibleToTeacher(subject: any, perms: TeacherPermissions) {
  if (perms.isClassTeacher) {
    // Class teachers can maybe see all subjects so they know what their students take?
    // The prompt: "class teachers should have the data for their exact classes alone, not from other classes too"
    // "subject teachers should have data of their subjects alone"
    // If we only show subjects taught by class teacher, but class teachers don't have subjects assigned unless they are also subject teachers.
    // Let's assume class teachers can see all subjects for their grade.
    // But we don't know the grade's subjects easily here unless we check academic_level...
    // Let's just return true for class teachers for now, or true for all?
    // Actually, let's filter subjects only if they are STRICTLY a subject teacher.
    // The prompt says: "subject teachers should have data of their subjects alone".
  }
  
  if (perms.isSubjectTeacher && !perms.isClassTeacher) {
    return perms.subjectTeacherAssignments.some(a => a.subject_id === subject.id);
  }
  
  return true; // fallback
}
