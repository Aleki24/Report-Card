import { z } from 'zod';

export const UserRole = z.enum(['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT', 'PENDING']);
export type UserRole = z.infer<typeof UserRole>;

export const ExamType = z.enum(['CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER']);
export type ExamType = z.infer<typeof ExamType>;

export const StudentStatus = z.enum(['ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DEACTIVATED']);
export type StudentStatus = z.infer<typeof StudentStatus>;

export const CbcPathway = z.enum(['STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS']);
export type CbcPathway = z.infer<typeof CbcPathway>;

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
    name: z.string().min(1, 'Name is required').max(50),
    full_name: z.string().max(100).optional(),
});

export const subjectSchema = z.object({
    code: z.string().min(1, 'Code is required').max(20),
    name: z.string().min(1, 'Name is required').max(100),
    academic_level_id: z.string().uuid('Invalid academic level ID'),
    subject_type: z.enum(['CORE', 'ESSENTIAL', 'OPTIONAL']).optional().default('CORE'),
    display_order: z.number().int().min(0).optional().default(0),
    category: z.enum(['LANGUAGE', 'MATHEMATICS', 'SCIENCE', 'HUMANITY', 'TECHNICAL', 'CREATIVE']).optional().default('TECHNICAL'),
    grading_system_id: z.string().uuid('Invalid grading system ID').optional().nullable(),
});

export const subjectCombinationSchema = z.object({
    code: z.string().trim().min(1, 'Code is required').max(20).toUpperCase(),
    name: z.string().trim().min(1, 'Name is required').max(100),
    pathway: CbcPathway,
    track: z.string().max(100).optional().nullable(),
    subject_ids: z.array(z.string().uuid('Invalid subject ID')).length(3, 'Exactly 3 elective subjects are required'),
    is_active: z.boolean().optional().default(true),
});

export const subjectCombinationUpdateSchema = z.object({
    code: z.string().trim().min(1).max(20).toUpperCase().optional(),
    name: z.string().trim().min(1).max(100).optional(),
    pathway: CbcPathway.optional(),
    track: z.string().max(100).optional().nullable(),
    subject_ids: z.array(z.string().uuid('Invalid subject ID')).length(3, 'Exactly 3 elective subjects are required').optional(),
    is_active: z.boolean().optional(),
});

// student_ids are NOT validated as UUIDs: production stores TEXT Clerk IDs
export const bulkPathwayAssignSchema = z.object({
    student_ids: z.array(z.string().min(1)).min(1, 'Select at least one student').max(500),
    pathway: CbcPathway.optional().nullable(),
    track: z.string().max(100).optional().nullable(),
    subject_combination_id: z.string().uuid('Invalid combination ID').optional().nullable(),
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

export const inviteUserSchema = z.object({
    first_name: z.string().trim().min(1, 'First name is required').max(100),
    last_name: z.string().trim().min(1, 'Last name is required').max(100),
    phone: z.string().trim().min(1, 'Phone is required').max(20),
    role: z.enum(['STUDENT', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'ADMIN']),
    sequence_number: z.number().int().min(1).max(99999),
    admission_number: z.string().trim().max(50).optional(),
    grade_stream_id: z.string().uuid('Invalid stream ID').optional(),
    academic_level_id: z.string().uuid('Invalid academic level ID').optional(),
    class_teacher_grade_stream_id: z.string().uuid('Invalid stream ID').optional().nullable(),
    subject_teacher_subjects: z.array(z.object({
        subject_id: z.string().uuid('Invalid subject ID'),
        grade_id: z.string().uuid('Invalid grade ID'),
        grade_stream_id: z.string().uuid('Invalid stream ID').optional().nullable(),
    })).optional(),
    is_class_teacher: z.boolean().optional(),
}).refine(
    data => data.role !== 'STUDENT' || (data.admission_number && data.grade_stream_id && data.academic_level_id),
    { message: 'Students require: admission_number, grade_stream_id, academic_level_id' }
);

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
