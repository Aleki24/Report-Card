import type { StudentStatus, UserRole } from '../types';

/* ------------------------------------------------------------------ */
/* GET /api/school/students/[studentId]                                */
/* ------------------------------------------------------------------ */

export interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  admission_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  date_enrolled: string | null;
  status: StudentStatus;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  grade_stream: { id: string; full_name: string; grade_id: string } | null;
  academic_level: { id: string; name: string; code: string } | null;
  pathway: string | null;
  track: string | null;
  subject_combination: { id: string; code: string; name: string; pathway: string | null; track: string | null } | null;
  enrolled_subjects: { id: string; name: string; code: string; role: 'CORE' | 'ELECTIVE' }[];
}

export interface TermPerformance {
  term_id: string;
  term_name: string;
  subjects: { subject_name: string; percentage: number; grade_symbol: string | null }[];
  average: number;
}

/**
 * A term's report card: one for every term with released results, the card
 * /api/reports/student/[id] builds from them (as the learner and parent
 * portals list it).
 */
export interface ReportSummary {
  id: string;
  term_id: string;
  year_id: string;
  /** When the class's cards were last generated in bulk, if ever. */
  generated_at: string | null;
  term: string;
  year: string;
  average: number | null;
  position: number | null;
  /** Subjects with released results that term. */
  subjects: number;
  /** Opens (downloads) this term's report card. */
  href: string;
}

/** A term's attendance, from the daily register. */
export interface AttendanceSummary {
  id: string;
  term: string;
  year: string;
  present: number;
  total: number;
  percentage: number | null;
}

export interface StudentProfileResponse {
  profile: StudentProfile;
  academicHistory: TermPerformance[];
  reportHistory: ReportSummary[];
  attendanceHistory: AttendanceSummary[];
  /** Whether the viewer may open the report cards: admins, the class teacher and the learner. */
  canOpenReports: boolean;
}

/* ------------------------------------------------------------------ */
/* GET /api/school/teachers/[teacherId] — serves every non-student      */
/* ------------------------------------------------------------------ */

export interface StaffProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  role: UserRole;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
}

export interface ClassAssignmentSummary { id: string; stream: string; year: string }

export interface SubjectAssignmentSummary {
  subject: string;
  subject_code: string;
  category: string;
  grade: string;
  stream: string | null;
  year: string;
}

export interface RecentExamSummary {
  id: string;
  name: string;
  type: string;
  date: string | null;
  subject: string;
  grade: string;
}

export interface StaffStats {
  markCount: number;
  reportCount: number;
  examCount: number;
  classCount: number;
  subjectCount: number;
}

export interface StaffProfileResponse {
  profile: StaffProfile;
  classAssignments: ClassAssignmentSummary[];
  subjectAssignments: SubjectAssignmentSummary[];
  recentExams: RecentExamSummary[];
  stats: StaffStats;
}

/** What the users dialog loads, tagged by which endpoint served it. */
export type UserProfileDetail =
  | { kind: 'student'; data: StudentProfileResponse }
  | { kind: 'staff'; data: StaffProfileResponse };
