export type UserRole = 'ADMIN' | 'CLASS_TEACHER' | 'SUBJECT_TEACHER' | 'STUDENT';
export type ExamType = 'CBC' | '844' | 'MIDTERM' | 'ENDTERM' | 'OPENER';
export type StudentStatus = 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED' | 'DEACTIVATED';
export type SubjectCategory = 'LANGUAGE' | 'MATHEMATICS' | 'SCIENCE' | 'HUMANITY' | 'TECHNICAL';

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
    is_compulsory: boolean;
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
