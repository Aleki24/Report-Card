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

/**
 * Maps subject codes to the CBC sub-level grade ranges they belong to.
 * This prevents e.g. Junior School subjects appearing in Grade 10 exams.
 * Key: subject code (as stored in DB). Value: array of allowed grade name patterns.
 */
const CBC_SUBJECT_GRADE_RANGES: Record<string, { minGrade: number; maxGrade: number }> = {
  // Lower Primary codes (Grades 1-3)
  'IND_LP': { minGrade: 1, maxGrade: 3 },
  'KISW_LP': { minGrade: 1, maxGrade: 3 },
  'KSL_LP': { minGrade: 1, maxGrade: 3 },
  'ENG_LP': { minGrade: 1, maxGrade: 3 },
  'MATH_LP': { minGrade: 1, maxGrade: 3 },
  'RE_LP': { minGrade: 1, maxGrade: 3 },
  'ENV_LP': { minGrade: 1, maxGrade: 3 },
  'MCA_LP': { minGrade: 1, maxGrade: 3 },
  // Legacy lower primary codes (from old definitions)
  'IND': { minGrade: 1, maxGrade: 3 },
  'ENV': { minGrade: 1, maxGrade: 3 },
  'MCA': { minGrade: 1, maxGrade: 3 },

  // Upper Primary codes (Grades 4-6)
  'ENG_UP': { minGrade: 4, maxGrade: 6 },
  'KISW_UP': { minGrade: 4, maxGrade: 6 },
  'KSL_UP': { minGrade: 4, maxGrade: 6 },
  'MATH_UP': { minGrade: 4, maxGrade: 6 },
  'SCI_UP': { minGrade: 4, maxGrade: 6 },
  'SS_UP': { minGrade: 4, maxGrade: 6 },
  'RE_UP': { minGrade: 4, maxGrade: 6 },
  'CMA_UP': { minGrade: 4, maxGrade: 6 },

  // Junior School codes (Grades 7-9)
  'ENG_JS': { minGrade: 7, maxGrade: 9 },
  'KISW_JS': { minGrade: 7, maxGrade: 9 },
  'KSL_JS': { minGrade: 7, maxGrade: 9 },
  'MATH_JS': { minGrade: 7, maxGrade: 9 },
  'RE_JS': { minGrade: 7, maxGrade: 9 },
  'SS_JS': { minGrade: 7, maxGrade: 9 },
  'SCI_JS': { minGrade: 7, maxGrade: 9 },
  'PTS_JS': { minGrade: 7, maxGrade: 9 },
  'AGRI_JS': { minGrade: 7, maxGrade: 9 },
  'CAS_JS': { minGrade: 7, maxGrade: 9 },

  // Senior School codes (Grades 10-12) — core
  'ENG_SS': { minGrade: 10, maxGrade: 12 },
  'KISW_SS': { minGrade: 10, maxGrade: 12 },
  'KSL_SS': { minGrade: 10, maxGrade: 12 },
  'CSL_SS': { minGrade: 10, maxGrade: 12 },
  'PE_SS': { minGrade: 10, maxGrade: 12 },
  'ICT_SS': { minGrade: 10, maxGrade: 12 },
  // Senior School — STEM
  'MATH_SS': { minGrade: 10, maxGrade: 12 },
  'BIO_SS': { minGrade: 10, maxGrade: 12 },
  'CHEM_SS': { minGrade: 10, maxGrade: 12 },
  'PHY_SS': { minGrade: 10, maxGrade: 12 },
  'GSCI_SS': { minGrade: 10, maxGrade: 12 },
  'COMP_SS': { minGrade: 10, maxGrade: 12 },
  'AGRI_SS': { minGrade: 10, maxGrade: 12 },
  'HOME_SS': { minGrade: 10, maxGrade: 12 },
  'DD_SS': { minGrade: 10, maxGrade: 12 },
  'AVI_SS': { minGrade: 10, maxGrade: 12 },
  'BC_SS': { minGrade: 10, maxGrade: 12 },
  'ELEC_SS': { minGrade: 10, maxGrade: 12 },
  'MET_SS': { minGrade: 10, maxGrade: 12 },
  'PM_SS': { minGrade: 10, maxGrade: 12 },
  'WOOD_SS': { minGrade: 10, maxGrade: 12 },
  'MED_SS': { minGrade: 10, maxGrade: 12 },
  'MAR_SS': { minGrade: 10, maxGrade: 12 },
  // Senior School — Arts & Sports
  'SR_SS': { minGrade: 10, maxGrade: 12 },
  'MD_SS': { minGrade: 10, maxGrade: 12 },
  'TF_SS': { minGrade: 10, maxGrade: 12 },
  'FA_SS': { minGrade: 10, maxGrade: 12 },
  // Senior School — Social Sciences
  'AENG_SS': { minGrade: 10, maxGrade: 12 },
  'LIT_SS': { minGrade: 10, maxGrade: 12 },
  'IND_SS': { minGrade: 10, maxGrade: 12 },
  'KK_SS': { minGrade: 10, maxGrade: 12 },
  'FL_SS': { minGrade: 10, maxGrade: 12 },
  'HC_SS': { minGrade: 10, maxGrade: 12 },
  'GEO_SS': { minGrade: 10, maxGrade: 12 },
  'BS_SS': { minGrade: 10, maxGrade: 12 },
  'RE_SS': { minGrade: 10, maxGrade: 12 },
};

/**
 * Subjects with generic codes (no suffix) that the user may have created.
 * Map by subject NAME to the grade range where they belong.
 * This handles DB entries like "Integrated Science (SCI)" which should only be for Junior School.
 */
const CBC_NAME_GRADE_RANGES: Record<string, { minGrade: number; maxGrade: number }> = {
  'Integrated Science': { minGrade: 4, maxGrade: 9 },      // Upper Primary + Junior School only
  'Social Studies': { minGrade: 4, maxGrade: 9 },           // Upper Primary + Junior School only
  'Pre-Technical Studies': { minGrade: 7, maxGrade: 9 },    // Junior School only
  'Creative Arts and Sports': { minGrade: 7, maxGrade: 9 }, // Junior School only
  'Environmental Activities': { minGrade: 1, maxGrade: 3 }, // Lower Primary only
  'Movement and Creative Activities': { minGrade: 1, maxGrade: 3 }, // Lower Primary only
  'Creative and Movement Activities': { minGrade: 4, maxGrade: 6 }, // Upper Primary only
  'Indigenous Language': { minGrade: 1, maxGrade: 3 },      // Lower Primary only
  'Community Service Learning': { minGrade: 10, maxGrade: 12 }, // Senior School only
  'ICT Skills': { minGrade: 10, maxGrade: 12 },             // Senior School only
};

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

  /**
   * Extract the grade number from a grade name like "Grade 7", "Grade 10", etc.
   * Returns null for non-CBC grade names like "Form 1", "Standard 3", "Pre-Primary 1".
   */
  const extractGradeNumber = (gradeName: string): number | null => {
    const n = (gradeName || '').toLowerCase().trim();
    // Match "grade N" pattern
    const m = n.match(/^grade\s+(\d+)$/);
    if (m) return parseInt(m[1], 10);
    // Pre-Primary = 0 (before Grade 1)
    if (n.includes('pre-primary') || n.includes('pre primary')) return 0;
    return null;
  };

  /**
   * Check if a CBC subject is allowed for a specific grade.
   * Uses the subject code first, then falls back to subject name matching.
   */
  const isCBCSubjectAllowedForGrade = (gradeName: string, subjectName: string, subjectCode: string): boolean => {
    const gradeNum = extractGradeNumber(gradeName);
    if (gradeNum === null) return true; // Not a CBC "Grade N" format, allow (e.g. 8-4-4 forms)

    // 1. Check by exact subject code
    const codeRange = CBC_SUBJECT_GRADE_RANGES[subjectCode];
    if (codeRange) {
      return gradeNum >= codeRange.minGrade && gradeNum <= codeRange.maxGrade;
    }

    // 2. Check by subject name (for generic codes like "SCI", "MATH", "ENG" without suffix)
    const nameRange = CBC_NAME_GRADE_RANGES[subjectName];
    if (nameRange) {
      return gradeNum >= nameRange.minGrade && gradeNum <= nameRange.maxGrade;
    }

    // 3. Generic subjects (e.g. English, Kiswahili, Mathematics, Agriculture, Religious Education)
    //    with non-suffixed codes: allow for all CBC grades by default
    return true;
  };

  for (const gradeId of gradeIds) {
    const grade = gradeMap.get(gradeId);
    if (!grade) continue;

    const gradeSubjects = subjects.filter(s => s.academic_level_id === grade.academic_level_id);

    for (const subject of gradeSubjects) {
      // Filter out mismatched grades for CBC subjects
      if (!isCBCSubjectAllowedForGrade(grade.name_display, subject.name, subject.code)) {
        continue;
      }

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
