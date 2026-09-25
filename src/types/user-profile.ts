import type { StudentStatus, UserRole } from './index';

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

export interface ReportSummary {
  id: string;
  generated_at: string;
  term: string;
  year: string;
  average: number | null;
  position: number | null;
}

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
