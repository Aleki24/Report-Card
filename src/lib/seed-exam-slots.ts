/**
 * seed-exam-slots.ts
 * Creates pre-defined exam "slots" for a given term.
 * Slots are created for each subject × grade combination.
 * Exam types: OPENER, MIDTERM, ENDTERM (auto-created)
 * CATs: teachers add manually as needed
 */
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export const STANDARD_EXAM_TYPES = ['OPENER', 'MIDTERM', 'ENDTERM'] as const;
export type StandardExamType = typeof STANDARD_EXAM_TYPES[number];

interface SeedOptions {
  termId: string;
  schoolId: string;
  academicYearId: string;
  examTypes?: string[];  // defaults to all 3
}

export async function seedExamSlots(options: SeedOptions) {
  const { termId, schoolId, academicYearId, examTypes } = options;
  const types = examTypes || [...STANDARD_EXAM_TYPES];
  const supabase = createSupabaseAdmin();

  // Get term info for exam naming and dates
  const { data: term } = await supabase
    .from('terms')
    .select('name, start_date, end_date')
    .eq('id', termId)
    .single();
  const termName = term?.name || 'Term';
  const termStart = term?.start_date ? new Date(term.start_date) : new Date();
  const termEnd = term?.end_date ? new Date(term.end_date) : new Date();

  // Get all grades for this school (via grade_streams)
  const { data: streams } = await supabase
    .from('grade_streams')
    .select('grade_id')
    .eq('school_id', schoolId);

  const gradeIds = [...new Set((streams || []).map(s => s.grade_id))];
  if (gradeIds.length === 0) return { created: 0, skipped: 0, error: 'No grades found for this school' };

  // Get all subjects
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, code, academic_level_id')
    .eq('school_id', schoolId);

  if (!subjects?.length) return { created: 0, skipped: 0, error: 'No subjects found' };

  // Get existing exams for this term to avoid duplicates
  const { data: existing } = await supabase
    .from('exams')
    .select('subject_id, grade_id, exam_type')
    .eq('term_id', termId)
    .eq('school_id', schoolId);

  const existingSet = new Set(
    (existing || []).map(e => `${e.subject_id}|${e.grade_id}|${e.exam_type}`)
  );

  // Get grade info for naming
  const { data: grades } = await supabase
    .from('grades')
    .select('id, name_display, academic_level_id')
    .in('id', gradeIds);

  const gradeMap = new Map((grades || []).map(g => [g.id, g]));

  // Build exam slots
  const slots: any[] = [];
  let skipped = 0;

  // Helper: calculate exam date based on type within the term
  const calcExamDate = (type: string): string => {
    const duration = termEnd.getTime() - termStart.getTime();
    let offset = 0.5; // default to midpoint
    switch (type) {
      case 'OPENER': offset = 0.1; break;      // ~week 1-2
      case 'CAT': case 'TOPICAL': offset = 0.3; break;
      case 'MIDTERM': offset = 0.5; break;      // midpoint
      case 'PRE_MOCK': offset = 0.6; break;
      case 'MOCK': offset = 0.7; break;
      case 'POST_MOCK': offset = 0.8; break;
      case 'ENDTERM': offset = 0.9; break;      // near end
      default: offset = 0.5; break;
    }
    const date = new Date(termStart.getTime() + duration * offset);
    return date.toISOString().split('T')[0];
  };

  for (const gradeId of gradeIds) {
    const grade = gradeMap.get(gradeId);
    if (!grade) continue;

    const gradeSubjects = subjects.filter(s => s.academic_level_id === grade.academic_level_id);

    for (const subject of gradeSubjects) {
      for (const examType of types) {
        const key = `${subject.id}|${gradeId}|${examType}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        slots.push({
          name: `${termName} ${examType.charAt(0) + examType.slice(1).toLowerCase().replace('_', '-')} - ${subject.name}`,
          exam_type: examType,
          subject_id: subject.id,
          grade_id: gradeId,
          grade_stream_id: null,
          academic_year_id: academicYearId,
          term_id: termId,
          school_id: schoolId,
          max_score: 100,
          exam_date: calcExamDate(examType),
          created_by_teacher_id: null,
        });
      }
    }
  }

  if (slots.length === 0) {
    return { created: 0, skipped, error: null };
  }

  // Insert in batches of 50
  let created = 0;
  for (let i = 0; i < slots.length; i += 50) {
    const batch = slots.slice(i, i + 50);
    const { error } = await supabase.from('exams').insert(batch);
    if (error) {
      return { created, skipped, error: error.message };
    }
    created += batch.length;
  }

  return { created, skipped, error: null };
}
