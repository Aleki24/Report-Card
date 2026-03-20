import { z } from 'zod';

export const UserRole = z.enum(['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT']);
export type UserRole = z.infer<typeof UserRole>;

export const ExamType = z.enum(['CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER']);
export type ExamType = z.infer<typeof ExamType>;

export const StudentStatus = z.enum(['ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DEACTIVATED']);
export type StudentStatus = z.infer<typeof StudentStatus>;

export const academicYearSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

export const termSchema = z.object({
    academic_year_id: z.string().uuid('Invalid academic year ID'),
    name: z.string().min(1, 'Name is required').max(100),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    is_current: z.boolean().optional(),
});

export const academicLevelSchema = z.object({
    code: z.string().min(1, 'Code is required').max(20).toUpperCase(),
    name: z.string().min(1, 'Name is required').max(100),
});

export const gradeSchema = z.object({
    code: z.string().min(1, 'Code is required').max(20),
    name_display: z.string().min(1, 'Display name is required').max(100),
    academic_level_id: z.string().uuid('Invalid academic level ID'),
    numeric_order: z.number().int().min(1).max(20),
});

export const streamSchema = z.object({
    grade_id: z.string().uuid('Invalid grade ID'),
    name: z.string().min(1, 'Stream name is required').max(50),
    full_name: z.string().min(1, 'Full name is required').max(100).optional(),
});

export const subjectSchema = z.object({
    code: z.string().min(1, 'Code is required').max(20),
    name: z.string().min(1, 'Name is required').max(100),
    academic_level_id: z.string().uuid('Invalid academic level ID'),
    is_compulsory: z.boolean().optional().default(true),
    display_order: z.number().int().min(0).optional().default(0),
    category: z.enum(['LANGUAGE', 'SCIENCE', 'HUMANITIES', 'TECHNICAL', 'OTHER']).optional().default('OTHER'),
});

export const gradingSystemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional(),
    academic_level_id: z.string().uuid('Invalid academic level ID'),
});

export const gradingScaleSchema = z.object({
    grading_system_id: z.string().uuid('Invalid grading system ID'),
    symbol: z.string().min(1, 'Symbol is required').max(10),
    label: z.string().min(1, 'Label is required').max(100),
    min_percentage: z.number().min(0).max(100),
    max_percentage: z.number().min(0).max(100),
    points: z.number().int().min(0).optional(),
    order_index: z.number().int().min(0),
}).refine(
    data => data.min_percentage <= data.max_percentage,
    { message: 'min_percentage must be less than or equal to max_percentage' }
);

export const examSchema = z.object({
    name: z.string().min(1, 'Exam name is required').max(200),
    exam_type: ExamType,
    academic_year_id: z.string().uuid('Invalid academic year ID'),
    term_id: z.string().uuid('Invalid term ID'),
    subject_id: z.string().uuid('Invalid subject ID'),
    grade_id: z.string().uuid('Invalid grade ID'),
    grade_stream_id: z.string().uuid('Invalid stream ID').optional(),
    max_score: z.number().positive().max(1000).default(100),
    exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

export const examMarkSchema = z.object({
    exam_id: z.string().uuid('Invalid exam ID'),
    student_id: z.string().uuid('Invalid student ID'),
    raw_score: z.number().min(0),
    remarks: z.string().max(500).optional(),
});

export const createUserSchema = z.object({
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Invalid email'),
    phone: z.string().max(20).optional(),
    role: UserRole,
    school_id: z.string().uuid('Invalid school ID').optional(),
});

export const pendingInviteSchema = z.object({
    first_name: z.string().min(1, 'First name is required').max(100),
    last_name: z.string().min(1, 'Last name is required').max(100),
    phone: z.string().min(1, 'Phone is required').max(20),
    role: UserRole,
    school_id: z.string().uuid('Invalid school ID'),
    admission_number: z.string().max(50).optional(),
    grade_stream_id: z.string().uuid('Invalid stream ID').optional(),
    academic_level_id: z.string().uuid('Invalid academic level ID').optional(),
});
