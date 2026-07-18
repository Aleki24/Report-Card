// Mirrors the response shapes consumed by src/app/student/**/page.tsx on the web app.

export interface DashboardStats {
    attendanceRate: number;
    averageScore: number;
    examsTaken: number;
    subjectsCount: number;
}

export interface UpcomingExam {
    id: string;
    name: string;
    exam_date: string;
    subject_name: string;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    isImportant: boolean;
    createdAt: string;
}

export interface Assignment {
    id: string;
    title: string;
    subjectName: string;
    dueDate: string;
    fileUrl: string | null;
}

export interface LearningMaterial {
    id: string;
    title: string;
    subjectName: string;
    fileUrl: string | null;
    fileType: string | null;
    fileSizeBytes: number | null;
}

export interface DashboardData {
    stats: DashboardStats;
    upcomingExams: UpcomingExam[];
    announcements: Announcement[];
    assignments: Assignment[];
    materials: LearningMaterial[];
}

export interface PerformanceTrend {
    termId: string;
    termName: string;
    yearName: string;
    overallAverage: number;
    subjects: { name: string; average: number }[];
}

export interface ExamResult {
    id: string;
    raw_score: number;
    percentage: number;
    grade_symbol: string | null;
    remarks: string | null;
    exams: {
        id: string;
        max_score: number;
        subjects: { id: string; name: string } | null;
        academic_years: { id: string; name: string } | null;
        terms: { id: string; name: string } | null;
    } | null;
}

export interface ReportSubject {
    id: string;
    total_score: number | null;
    total_max_score: number | null;
    percentage: number | null;
    grade_symbol: string | null;
    teacher_comment: string | null;
    subjects: { id: string; name: string } | null;
}

export interface ReportCard {
    id: string;
    student_id?: string;
    overall_average: number | null;
    overall_position: number | null;
    comments_class_teacher: string | null;
    comments_principal: string | null;
    behaviour_summary: string | null;
    attendance_present: number;
    attendance_total: number;
    generated_at: string | null;
    academic_years: { id: string; name: string } | null;
    terms: { id: string; name: string } | null;
    grade_streams: { id: string; name: string; full_name: string } | null;
    report_card_subjects: ReportSubject[];
}

export interface Subject {
    id: string;
    name: string;
    code: string | null;
    category: string | null;
    subject_type: 'CORE' | 'ESSENTIAL' | 'OPTIONAL' | null;
    enrollment_role?: 'CORE' | 'ELECTIVE';
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
    id: string;
    date: string;
    status: AttendanceStatus;
    notes: string | null;
}

export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERPAID';

export interface FeeRecord {
    id: string;
    totalFee: number;
    paidAmount: number;
    balance: number;
    dueDate: string | null;
    status: FeeStatus;
    notes: string | null;
    termName: string | null;
}

export interface StudentProfile {
    admission_number: string | null;
    status: string | null;
    date_of_birth: string | null;
    guardian_name: string | null;
    guardian_email: string | null;
    guardian_phone: string | null;
    users: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
    grade_streams: { name: string; full_name: string } | null;
    academic_levels: { name: string } | null;
}
