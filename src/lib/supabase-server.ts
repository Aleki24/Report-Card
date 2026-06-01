// Data-fetching utilities for school data
// Auth functions live in @/lib/auth-server — re-exported here for convenience
import { createSupabaseAdmin } from '@/lib/supabase-admin';
export { getAuthSession, requireAuth, requireAdmin } from '@/lib/auth-server';
export type { ServerSession } from '@/lib/auth-server';

export async function getSchoolStudents(schoolId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('students')
    .select('id, admission_number, status, academic_level_id, current_grade_stream_id, users!inner (first_name, last_name, email, school_id), grade_streams (full_name)')
    .eq('users.school_id', schoolId)
    .order('admission_number');
  if (error) throw error;
  return data ?? [];
}

export async function getSchoolGradeStreams(schoolId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('grade_streams')
    .select('id, name, full_name, grade_id, school_id')
    .eq('school_id', schoolId)
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

export async function getSchoolAcademicYears(schoolId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSchoolTerms(schoolId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, academic_year_id, start_date, end_date, is_current, school_id')
    .eq('school_id', schoolId)
    .order('start_date');
  if (error) throw error;
  return data ?? [];
}

export async function getSchoolExamMarks(schoolId: string, examId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('exam_marks')
    .select('id, student_id, raw_score, percentage, grade_symbol, remarks, students!inner (admission_number, users!inner (first_name, last_name, school_id))')
    .eq('exam_id', examId)
    .eq('students.users.school_id', schoolId);
  if (error) throw error;
  return data ?? [];
}
