/**
 * exam-types.ts
 * Pre-defined exam types for Kenyan schools (8-4-4 and CBC).
 * Based on the Kenyan School Subjects and Exam Types specification.
 *
 * Teachers don't create exams — they select from these pre-defined types.
 * The system auto-creates exam slots for active terms.
 */

export interface ExamTypeDefinition {
  code: string;
  name: string;
  shortName: string;
  scope: 'SCHOOL' | 'ZONE' | 'SUB_COUNTY' | 'COUNTY' | 'REGIONAL' | 'NATIONAL';
  isSummative: boolean;
  description: string;
  icon: string;
  order: number;
}

// ── Internal school-based exams ──────────────────────────
export const INTERNAL_EXAM_TYPES: ExamTypeDefinition[] = [
  {
    code: 'OPENER',
    name: 'Opening Exam',
    shortName: 'Opener',
    scope: 'SCHOOL',
    isSummative: false,
    description: 'Beginning-of-term exam to gauge retention and readiness',
    icon: '📝',
    order: 1,
  },
  {
    code: 'MIDTERM',
    name: 'Mid-Term Exam',
    shortName: 'Midterm',
    scope: 'SCHOOL',
    isSummative: false,
    description: 'Mid-term examination covering the first half of term work',
    icon: '📋',
    order: 2,
  },
  {
    code: 'ENDTERM',
    name: 'End-Term Exam',
    shortName: 'Endterm',
    scope: 'SCHOOL',
    isSummative: true,
    description: 'Full-term summative exam for ranking, promotion, and report cards',
    icon: '📊',
    order: 3,
  },
  {
    code: 'CAT',
    name: 'Continuous Assessment Test',
    shortName: 'CAT',
    scope: 'SCHOOL',
    isSummative: false,
    description: 'Shorter periodic tests for formative assessment and continuous scoring',
    icon: '📌',
    order: 4,
  },
  {
    code: 'TOPICAL',
    name: 'Topical Test',
    shortName: 'Topical',
    scope: 'SCHOOL',
    isSummative: false,
    description: 'Teacher-made test after each topic or sub-topic',
    icon: '🏷️',
    order: 5,
  },
  {
    code: 'CBC',
    name: 'CBC Assessment',
    shortName: 'CBC',
    scope: 'SCHOOL',
    isSummative: true,
    description: 'Competency Based Curriculum Assessment',
    icon: '📗',
    order: 6,
  },
  {
    code: '844',
    name: '8-4-4 Exam',
    shortName: '844',
    scope: 'SCHOOL',
    isSummative: true,
    description: 'Standard 8-4-4 system exam',
    icon: '📘',
    order: 7,
  },
  {
    code: 'END TERM',
    name: 'End Term (Legacy)',
    shortName: 'End Term',
    scope: 'SCHOOL',
    isSummative: true,
    description: 'Legacy end term exam',
    icon: '📊',
    order: 8,
  },
];

// ── External / mock exams ────────────────────────────────
export const EXTERNAL_EXAM_TYPES: ExamTypeDefinition[] = [
  {
    code: 'ZONE',
    name: 'Zone Exam',
    shortName: 'Zone',
    scope: 'ZONE',
    isSummative: false,
    description: 'Tests organized at zonal level for schools in the same cluster',
    icon: '🔶',
    order: 10,
  },
  {
    code: 'SUB_COUNTY',
    name: 'Sub-County Exam',
    shortName: 'Sub-County',
    scope: 'SUB_COUNTY',
    isSummative: false,
    description: 'Exams administered at sub-county level for benchmarking',
    icon: '🔷',
    order: 11,
  },
  {
    code: 'COUNTY',
    name: 'County Exam',
    shortName: 'County',
    scope: 'COUNTY',
    isSummative: false,
    description: 'County-wide exams for benchmarking across the county',
    icon: '🟣',
    order: 12,
  },
  {
    code: 'REGIONAL',
    name: 'Regional Exam',
    shortName: 'Regional',
    scope: 'REGIONAL',
    isSummative: false,
    description: 'Exams covering multiple counties',
    icon: '🟡',
    order: 13,
  },
  {
    code: 'PRE_MOCK',
    name: 'Pre-Mock Exam',
    shortName: 'Pre-Mock',
    scope: 'SCHOOL',
    isSummative: false,
    description: 'Preliminary mock exam before the official mock exams',
    icon: '🔸',
    order: 14,
  },
  {
    code: 'MOCK',
    name: 'Mock Exam',
    shortName: 'Mock',
    scope: 'SCHOOL',
    isSummative: true,
    description: 'Trial KCSE/KCPE-style exam set before national exams',
    icon: '🎯',
    order: 15,
  },
  {
    code: 'POST_MOCK',
    name: 'Post-Mock Exam',
    shortName: 'Post-Mock',
    scope: 'SCHOOL',
    isSummative: false,
    description: 'Follow-up exam after mock exams for additional preparation',
    icon: '🔹',
    order: 16,
  },
];

// ── All exam types combined ──────────────────────────────
export const ALL_EXAM_TYPES: ExamTypeDefinition[] = [
  ...INTERNAL_EXAM_TYPES,
  ...EXTERNAL_EXAM_TYPES,
].sort((a, b) => a.order - b.order);

// ── Standard exams that get auto-created per term ────────
// These 3 are always created when a term is initialized
export const STANDARD_TERM_EXAMS = ['OPENER', 'MIDTERM', 'ENDTERM'];

// ── Lookup helpers ───────────────────────────────────────
export function getExamType(code: string): ExamTypeDefinition | undefined {
  return ALL_EXAM_TYPES.find(t => t.code === code);
}

export function getExamTypeLabel(code: string): string {
  const et = getExamType(code);
  return et ? `${et.icon} ${et.shortName}` : code;
}

export function getExamTypeName(code: string): string {
  return getExamType(code)?.name || code;
}

// ── KCSE Subject Groups (8-4-4) ──────────────────────────
export const KCSE_SUBJECT_GROUPS: Record<string, { name: string; subjects: string[] }> = {
  'GROUP_1': {
    name: 'Core',
    subjects: ['English', 'Kiswahili', 'Kenya Sign Language', 'Mathematics'],
  },
  'GROUP_2': {
    name: 'Sciences',
    subjects: ['Biology', 'Physics', 'Chemistry', 'General Science'],
  },
  'GROUP_3': {
    name: 'Humanities',
    subjects: ['History & Government', 'Geography', 'Christian Religious Education', 'Islamic Religious Education', 'Hindu Religious Education'],
  },
  'GROUP_4': {
    name: 'Applied/Technical',
    subjects: ['Home Science', 'Art and Design', 'Agriculture', 'Woodwork', 'Metalwork', 'Building Construction', 'Power Mechanics', 'Electricity', 'Drawing and Design', 'Aviation Technology', 'Computer Studies'],
  },
  'GROUP_5': {
    name: 'Languages & Others',
    subjects: ['French', 'German', 'Arabic', 'Music', 'Business Studies'],
  },
};

// ── CBC Junior School subjects (Grades 7-9) ──────────────
export const CBC_JUNIOR_SCHOOL_SUBJECTS = [
  { code: 'ENG', name: 'English', isCore: true },
  { code: 'KISW', name: 'Kiswahili', isCore: true },
  { code: 'MATH', name: 'Mathematics', isCore: true },
  { code: 'CRE', name: 'Religious Education', isCore: true },
  { code: 'SS', name: 'Social Studies', isCore: true },
  { code: 'SCI', name: 'Integrated Science', isCore: true },
  { code: 'PTS', name: 'Pre-Technical Studies', isCore: true },
  { code: 'AGRI', name: 'Agriculture', isCore: true },
  { code: 'CAS', name: 'Creative Arts and Sports', isCore: true },
];
