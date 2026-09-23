// Response shapes from the shared Next.js backend (`../src/app/api/**`),
// kept in step with how the web pages under src/app/student/** and
// src/app/dashboard/** consume them.

import type { UserRole } from './roles';

// ── Current user ───────────────────────────────────────────

export interface CurrentUserProfile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
    school_id: string | null;
    is_active: boolean;
    job_title: string | null;
}

export interface MeResponse {
    profile: CurrentUserProfile;
    schoolName: string | null;
    schoolOnboardingCompleted: boolean;
    activeRole: UserRole | null;
}

// ── Student ────────────────────────────────────────────────

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
    description?: string | null;
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
    termId?: string | null;
    termName: string | null;
}

export type FeePaymentMethod = 'MPESA' | 'PESAPAL' | 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER';
export type FeePaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface FeePayment {
    id: string;
    receiptNumber: string;
    amount: number;
    method: FeePaymentMethod;
    status: FeePaymentStatus;
    phoneNumber: string | null;
    payerName: string | null;
    mpesaReceiptNumber: string | null;
    notes: string | null;
    paidAt: string;
}

export type PaymentProvider = 'NONE' | 'DARAJA' | 'PESAPAL';

export interface SchoolBankAccount {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    branch: string | null;
    isPrimary: boolean;
}

export interface PaymentSettingsStatus {
    active: boolean;
    provider: PaymentProvider;
    bankEnabled: boolean;
    bankAccounts: SchoolBankAccount[];
}

export interface StkPushResponse {
    paymentId: string;
    checkoutRequestId: string;
    customerMessage: string;
}

export interface PaymentStatusResponse {
    status: FeePaymentStatus;
    amount: number;
    mpesaReceiptNumber: string | null;
    notes: string | null;
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

// ── Staff: dashboard ───────────────────────────────────────

export interface ClassPerformance {
    id: string;
    name: string;
    levelCode: string | null;
    students: number;
    markCount: number;
    mean: number | null;
    passRate: number | null;
}

export interface UnmarkedClass {
    label: string;
    levelCode: string | null;
    count: number;
}

export interface StaffUpcomingExam {
    id: string;
    name: string;
    exam_type: string;
    exam_date: string;
    subject_name: string;
    grade_name: string;
}

export interface AttendanceCounts {
    present: number;
    absent: number;
    late: number;
    excused: number;
}

/** GET /api/school/dashboard */
export interface StaffDashboardSummary {
    totalStudents: number;
    totalTeachers: number;
    totalUsers: number;
    totalClasses: number;
    totalReports: number;
    attendanceToday: AttendanceCounts | null;
    upcomingExams: StaffUpcomingExam[];
    recentActivities: { type: string; message: string; timestamp: string; href?: string }[];
    overdueFeesCount: number;
    announcementsLast7Days: number;
    recentEnrollmentsLast7: number;
    financeSummary: { totalCollected: number; unpaidBalance: number; overdueCount: number };
    academicSummary: { recentAvg: number | null; passRate: number | null; passMark: number; markCount: number };
    examsAwaitingMarks: number;
    unmarkedByClass: UnmarkedClass[];
    classPerformance: ClassPerformance[];
    subjectsWithoutGradingSystem: number;
    hasFeeData: boolean;
    hasAttendanceData: boolean;
    hasLogo: boolean;
}

/** GET /api/school/stats?role=class_teacher */
export interface ClassTeacherStats {
    streamName: string;
    studentCount: number;
    streamAvg: string;
    reportsPending: number;
}

/** GET /api/school/stats?role=subject_teacher */
export interface SubjectTeacherStats {
    examCount: number;
    avg: string;
    markCount: number;
}

// ── Staff: academic structure ──────────────────────────────

export interface Term {
    id: string;
    name: string;
    academic_year_id: string;
    start_date?: string | null;
    end_date?: string | null;
    is_current: boolean;
    midterm_reopening_date?: string | null;
    reopening_date?: string | null;
}

export interface AcademicYear {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
}

export interface GradeStream {
    id: string;
    name: string;
    full_name: string;
    grade_id: string;
    grades?: { academic_level_id: string; name_display: string } | null;
}

export interface AcademicLevel {
    id: string;
    code: string;
    name: string;
}

export interface Grade {
    id: string;
    name_display: string;
    academic_level_id: string;
}

export interface GradingSystem {
    id: string;
    name: string;
    academic_level_id: string | null;
    system_kind?: 'SUBJECT' | 'OVERALL' | null;
}

export interface GradingScale {
    grading_system_id: string;
    symbol: string;
    label: string | null;
    min_percentage: number;
    max_percentage: number;
}

export interface StructureSubject {
    id: string;
    name: string;
    code: string | null;
    academic_level_id: string | null;
    grading_system_id?: string | null;
}

/** GET /api/admin/academic-structure (the parts the mobile app reads). */
export interface AcademicStructure {
    academic_levels?: AcademicLevel[];
    grades?: Grade[];
    grade_streams?: GradeStream[];
    subjects?: StructureSubject[];
    grading_systems?: GradingSystem[];
    grading_scales?: GradingScale[];
}

/** GET /api/school/data?type=my_subjects */
export interface TeacherSubject {
    id: string;
    code: string | null;
    name: string;
    academic_level_id: string | null;
    category: string | null;
}

// ── Staff: exams & marks ───────────────────────────────────

export type ExamStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';

/** GET /api/school/exams */
export interface ExamSlot {
    id: string;
    name: string;
    exam_type: string;
    max_score: number;
    subject_id: string;
    subject_name: string;
    subject_code: string;
    subject_category: string;
    grade_name: string;
    grade_stream_id: string | null;
    grade_stream_name: string | null;
    grade_id: string;
    term_id: string;
    term_name: string | null;
    status: ExamStatus;
    published_by_name: string | null;
    published_at: string | null;
}

export interface ExamPaper {
    id: string;
    component_code: string;
    component_name: string;
    max_score: number;
    display_order: number;
}

export type AggregationMethod = 'sum_then_percentage' | 'languages_average_percentages' | 'science_70_plus_practical';

/** GET /api/school/exams/[id]/components → data */
export interface ExamPaperScheme {
    id: string;
    assessment_mode: 'single_paper' | 'multi_paper';
    aggregation_method: AggregationMethod;
    is_enabled: boolean;
    components?: ExamPaper[];
}

/** GET /api/school/exam-marks?exam_id= */
export interface ExamMark {
    id: string;
    student_id: string;
    student_name: string;
    admission_number: string;
    raw_score: number;
    percentage: number;
    grade_symbol: string | null;
    remarks: string | null;
    components?: Record<string, number>;
}

export interface MarkEntryInput {
    student_id: string;
    raw_score?: number;
    grade_symbol: string;
    remarks: string | null;
    components?: Record<string, number>;
}

interface StudentGap {
    name: string;
    admission_number: string;
    missing?: string[];
}

export interface PublishReadiness {
    isMultiPaper: boolean;
    rosterCount: number;
    markedCount: number;
    fullyMarkedCount: number;
    unmarked: StudentGap[];
    partiallyMarked: StudentGap[];
    hasIssues: boolean;
}

export type PublishResponse =
    | { requiresConfirmation: true; readiness: PublishReadiness }
    | { success: true; readiness?: PublishReadiness };

// ── Staff: people ──────────────────────────────────────────

export interface StudentListItem {
    id: string;
    admission_number: string | null;
    status: string | null;
    current_grade_stream_id: string | null;
    academic_level_id: string | null;
    guardian_phone: string | null;
    users: { first_name: string; last_name: string; email: string | null } | null;
    grade_streams: { id: string; full_name: string; grade_id: string } | null;
}

export interface TeacherListItem {
    id: string;
    employee_id: string | null;
    profile: { first_name: string; last_name: string; email: string | null; phone: string | null; is_active: boolean; role: UserRole; job_title: string | null };
    subjects: string;
    classes: string;
    stats: { subjectCount: number; classCount: number };
}

export interface StudentDetail {
    profile: {
        id: string;
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        admission_number: string | null;
        gender: string | null;
        date_of_birth: string | null;
        date_enrolled: string | null;
        status: string | null;
        guardian_name: string | null;
        guardian_phone: string | null;
        guardian_email: string | null;
        grade_stream: { id: string; full_name: string } | null;
        academic_level: { id: string; name: string; code: string } | null;
    };
    academicHistory: { term_id: string; term_name: string; average: number; subjects: { name: string; percentage: number }[] }[];
    reportHistory: { id: string; generated_at: string; term: string; year: string; average: number | null; position: number | null }[];
    attendanceHistory: { id: string; term: string; year: string; present: number; total: number; percentage: number | null }[];
}

export interface TeacherDetail {
    profile: { id: string; first_name: string; last_name: string; email: string | null; phone: string; role: UserRole; is_active: boolean; created_at: string };
    classAssignments: { id: string; stream: string; year: string }[];
    subjectAssignments: { subject: string; subject_code: string; category: string; grade: string }[];
}

// ── Staff: attendance, fees, communication ─────────────────

export interface ClassAttendanceRow {
    id: string;
    name: string;
    admission_number: string;
    status: AttendanceStatus | null;
    notes: string | null;
}

export interface AttendanceNotifyResult {
    sent: number;
    failed: number;
    skipped: number;
    alreadyNotified: number;
}

export interface StaffFeeRecord extends FeeRecord {
    studentName: string | null;
    admissionNumber: string | null;
}

export interface StaffAnnouncement extends Announcement {
    postedBy: string;
    postedById: string | null;
}

export interface StaffAssignment {
    id: string;
    title: string;
    description: string | null;
    dueDate: string;
    fileUrl: string | null;
    subject: string;
    subjectId: string;
    subjectCode: string | null;
    stream: string | null;
    streamId: string | null;
    createdBy: string;
    createdAt: string;
}

// ── Staff: analytics ───────────────────────────────────────

/** GET /api/school/analytics/overview */
export interface AnalyticsOverview {
    academic_year: string | null;
    classes: {
        id: string;
        name: string;
        level_code: string | null;
        students: number;
        mark_count: number;
        mean: number | null;
        pass_rate: number | null;
        unmarked: number;
    }[];
    summary: {
        classes_with_marks: number;
        classes_total: number;
        learners: number;
        mark_count: number;
        exams_awaiting_marks: number;
    };
}

/** GET /api/school/analytics/class?stream_id= */
export interface ClassAnalytics {
    class: { id: string; full_name: string; grade_name: string | null; level_code: string | null; level_name: string | null };
    scope: { term_id: string | null; term_name: string | null; exam_type: string | null };
    terms: { id: string; name: string; is_current: boolean }[];
    summary: { mean_percentage: number; pass_rate: number; student_count: number; subject_count: number; mark_count: number };
    subjects: {
        subject_id: string;
        subject_name: string;
        subject_code: string | null;
        student_count: number;
        mark_count: number;
        mean_percentage: number;
        pass_rate: number;
        highest: number;
        lowest: number;
        grade_symbol: string | null;
    }[];
    merit: {
        student_id: string;
        admission_number: string | null;
        student_name: string;
        subjects_sat: number;
        mean_percentage: number;
        incomplete: boolean;
        rank: number | null;
    }[];
    series: { term_id: string | null; term_name: string | null; exam_type: string; label: string; mark_count: number; mean_percentage: number }[];
}
