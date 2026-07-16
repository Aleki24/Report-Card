export type UserRole = 'ADMIN' | 'CLASS_TEACHER' | 'SUBJECT_TEACHER' | 'STUDENT' | 'PENDING';
export type ExamType = 'CBC' | '844' | 'MIDTERM' | 'ENDTERM' | 'OPENER';
export type StudentStatus = 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED' | 'DEACTIVATED';
export type SubjectCategory = 'LANGUAGE' | 'MATHEMATICS' | 'SCIENCE' | 'HUMANITY' | 'TECHNICAL';
export type CbcPathway = 'STEM' | 'SOCIAL_SCIENCES' | 'ARTS_SPORTS';

export interface User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    role: UserRole;
    is_active: boolean;
    school_id?: string;
    invite_code?: string;
    created_at: string;
}

export interface School {
    id: string;
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    email?: string;
    grading_system_cbc_id?: string;
    grading_system_844_id?: string;
}

export interface AcademicLevel {
    id: string;
    code: string;
    name: string;
    description?: string;
}

export interface Grade {
    id: string;
    academic_level_id: string;
    code: string;
    name_display: string;
    numeric_order: number;
    is_exam_class: boolean;
}

export interface GradeStream {
    id: string;
    grade_id: string;
    name: string;
    full_name: string;
}

export interface Student {
    id: string;
    admission_number: string;
    current_grade_stream_id: string;
    academic_level_id: string;
    date_of_birth?: string;
    gender?: string;
    guardian_name?: string;
    guardian_phone?: string;
    guardian_email?: string;
    date_enrolled?: string;
    status: StudentStatus;
    pathway?: CbcPathway | null;
    track?: string | null;
    subject_combination_id?: string | null;
}

// ── CBC Senior School pathways & subject combinations ────────

export interface SubjectCombination {
    id: string;
    school_id: string;
    code: string;
    name: string;
    pathway: CbcPathway;
    track?: string | null;
    is_active: boolean;
    /** Joined electives (subject_combination_subjects -> subjects) */
    subjects?: { id: string; name: string; code: string }[];
    /** Aggregate from the admin GET endpoint */
    student_count?: number;
}

export interface StudentSubject {
    id: string;
    student_id: string;
    subject_id: string;
    role: 'CORE' | 'ELECTIVE';
    school_id?: string | null;
}

export interface AcademicYear {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
}

export interface Term {
    id: string;
    academic_year_id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
}

export interface Subject {
    id: string;
    code: string;
    name: string;
    academic_level_id: string;
    subject_type: 'CORE' | 'ESSENTIAL' | 'OPTIONAL';
    display_order: number;
    category?: SubjectCategory;
}

export interface Exam {
    id: string;
    name: string;
    exam_type: ExamType;
    academic_year_id: string;
    term_id: string;
    subject_id: string;
    grade_id: string;
    grade_stream_id?: string;
    created_by_teacher_id?: string;
    max_score: number;
    exam_date: string;
}

export interface GradingSystem {
    id: string;
    academic_level_id: string;
    name: string;
    description?: string;
}

export interface GradingScale {
    id: string;
    grading_system_id: string;
    min_percentage: number;
    max_percentage: number;
    symbol: string;
    label: string;
    points?: number;
    order_index: number;
}

export interface ExamMark {
    id: string;
    exam_id: string;
    student_id: string;
    raw_score: number;
    percentage: number;
    grade_symbol?: string;
    remarks?: string;
    /** Per-paper raw scores keyed by component id (multi-paper exams only) */
    components?: Record<string, number>;
}

// ── Multi-paper (multi-component) subject support ───────────

export type AssessmentMode = 'single_paper' | 'multi_paper';

export type AggregationMethod =
    | 'sum_then_percentage'
    | 'languages_average_percentages'
    | 'science_70_plus_practical';

export interface ExamSubjectComponent {
    id: string;
    scheme_id: string;
    component_code: string;   // 'P1', 'P2', 'P3'
    component_name: string;   // 'Paper 1'
    max_score: number;
    weight?: number | null;
    display_order: number;
}

export interface ExamSubjectComponentScheme {
    id: string;
    exam_id: string;
    subject_id: string;
    school_id?: string;
    assessment_mode: AssessmentMode;
    aggregation_method: AggregationMethod;
    is_enabled: boolean;
    components?: ExamSubjectComponent[];
}

export interface ExamMarkComponent {
    id: string;
    exam_id: string;
    subject_id?: string;
    student_id: string;
    component_id: string;
    raw_score: number;
}

export interface ClassTeacher {
    id: string;
    user_id: string;
    current_grade_stream_id: string;
    academic_year_id: string;
}

export interface SubjectTeacher {
    id: string;
    user_id: string;
}

export interface SubjectTeacherAssignment {
    id: string;
    subject_teacher_id: string;
    subject_id: string;
    grade_id: string;
    grade_stream_id?: string;
    academic_year_id: string;
}

export interface ReportCard {
    id: string;
    student_id: string;
    academic_year_id: string;
    term_id: string;
    grade_stream_id: string;
    class_teacher_id?: string;
    overall_average?: number;
    overall_position?: number;
    comments_class_teacher?: string;
    comments_principal?: string;
    behaviour_summary?: string;
    attendance_present?: number;
    attendance_total?: number;
}

export interface ReportCardSubject {
    id: string;
    report_card_id: string;
    subject_id: string;
    exam_ids_used?: string[];
    total_score?: number;
    total_max_score?: number;
    percentage?: number;
    grade_symbol?: string;
    teacher_comment?: string;
}

export interface PendingInvite {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    role: UserRole;
    school_id: string;
    invite_code: string;
    admission_number?: string;
    grade_stream_id?: string;
    academic_level_id?: string;
}

export interface PerformanceHistory {
    id: string;
    student_id: string;
    academic_year_id: string;
    term_id: string;
    subject_id: string;
    average_percentage?: number;
    position_in_subject?: number;
    trend_vs_previous_term?: number;
}

// ── Student Portal Types ─────────────────────────────────────

export interface CurrentStudent {
    userId: string;
    studentId: string;
    role: 'STUDENT';
    fullName: string;
    email: string;
    admissionNumber: string;
    gradeStreamId: string;
    academicLevelId: string;
    schoolId: string;
}

export interface StudentProfileData {
    id: string;
    admission_number: string;
    avatar_url?: string;
    date_of_birth?: string;
    gender?: string;
    guardian_name?: string;
    guardian_phone?: string;
    guardian_email?: string;
    date_enrolled?: string;
    status: StudentStatus;
    users: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
        role: UserRole;
    };
    academic_levels?: {
        id: string;
        code: string;
        name: string;
    };
    grade_streams?: {
        id: string;
        name: string;
        full_name: string;
        grades?: {
            id: string;
            code: string;
            name_display: string;
        };
    };
}

export interface StudentResultItem {
    id: string;
    raw_score: number;
    percentage: number;
    grade_symbol?: string;
    remarks?: string;
    exams: {
        id: string;
        name: string;
        exam_type: ExamType;
        exam_date: string;
        max_score: number;
        subjects?: { id: string; code: string; name: string };
        academic_years?: { id: string; name: string };
        terms?: { id: string; name: string };
    };
}

export interface StudentReportCardData {
    id: string;
    overall_average?: number;
    overall_position?: number;
    comments_class_teacher?: string;
    comments_principal?: string;
    behaviour_summary?: string;
    attendance_present?: number;
    attendance_total?: number;
    generated_at?: string;
    academic_years?: { id: string; name: string };
    terms?: { id: string; name: string };
    grade_streams?: {
        id: string;
        name: string;
        full_name: string;
        grades?: { id: string; code: string; name_display: string };
    };
    report_card_subjects?: {
        id: string;
        total_score?: number;
        total_max_score?: number;
        percentage?: number;
        grade_symbol?: string;
        teacher_comment?: string;
        subjects?: { id: string; code: string; name: string };
    }[];
}

export interface StudentAttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    notes?: string;
}

export interface StudentDashboardSummary {
    profile: StudentProfileData;
    stats: {
        subjectsCount: number;
        averageScore: number;
        attendanceRate: number;
        hasReportCard: boolean;
        examsTaken: number;
    };
    latestResults: StudentResultItem[];
    latestReport: StudentReportCardData | null;
    upcomingExams: {
        id: string;
        name: string;
        exam_date: string;
        subject_name: string;
    }[];
    currentTerm?: { id: string; name: string };
    currentYear?: { id: string; name: string };
}

export interface StudentPerformanceTrend {
    termName: string;
    yearName: string;
    subjects: {
        name: string;
        average: number;
        trend?: number;
    }[];
    overallAverage: number;
}
