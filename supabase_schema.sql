-- ⚠️⚠️⚠️ WARNING: RUNNING THIS FILE WILL DELETE ALL DATA! ⚠️⚠️⚠️
-- This file DROPS and recreates ALL tables from scratch.
-- Only run this on a BRAND NEW empty database.
-- If you need to add columns, use ALTER TABLE instead.
-- ================================================================
-- Supabase Database Schema for Results Analysis App
-- Run this in the Supabase SQL Editor

-- 0. CLEAN SLATE: DROP ALL EXISTING TABLES, TYPES, AND FUNCTIONS
DROP FUNCTION IF EXISTS calculate_exam_mark_grade() CASCADE;
DROP FUNCTION IF EXISTS generate_term_reports(UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_my_role() CASCADE;

DROP TABLE IF EXISTS student_subjects CASCADE;
DROP TABLE IF EXISTS subject_combination_subjects CASCADE;
DROP TABLE IF EXISTS subject_combinations CASCADE;
DROP TABLE IF EXISTS exam_mark_components CASCADE;
DROP TABLE IF EXISTS exam_subject_components CASCADE;
DROP TABLE IF EXISTS exam_subject_component_schemes CASCADE;
DROP TABLE IF EXISTS performance_history CASCADE;
DROP TABLE IF EXISTS report_card_subjects CASCADE;
DROP TABLE IF EXISTS report_cards CASCADE;
DROP TABLE IF EXISTS exam_marks CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS grading_scales CASCADE;
DROP TABLE IF EXISTS subject_teacher_assignments CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS subject_teachers CASCADE;
DROP TABLE IF EXISTS class_teachers CASCADE;
DROP TABLE IF EXISTS terms CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS grade_streams CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS schools CASCADE;
DROP TABLE IF EXISTS grading_systems CASCADE;
DROP TABLE IF EXISTS academic_levels CASCADE;

-- ENUMS
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT', 'PENDING');

DROP TYPE IF EXISTS exam_type CASCADE;
CREATE TYPE exam_type AS ENUM ('CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER');

DROP TYPE IF EXISTS student_status CASCADE;
CREATE TYPE student_status AS ENUM ('ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DEACTIVATED');

DROP TYPE IF EXISTS cbc_pathway CASCADE;
CREATE TYPE cbc_pathway AS ENUM ('STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS');

-- 1. ACADEMIC LEVELS (CBC, 8-4-4)
CREATE TABLE IF NOT EXISTS academic_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- e.g. 'CBC', '844'
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. GRADING SYSTEMS
CREATE TABLE IF NOT EXISTS grading_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. SCHOOLS
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    grading_system_cbc_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL,
    grading_system_844_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL,
    onboarding_completed BOOLEAN DEFAULT false NOT NULL,
    teacher_invite_code TEXT,
    student_invite_code TEXT,
    min_combination_group_size INT DEFAULT 15 NOT NULL, -- CBC ministry minimum learners per subject combination
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. GRADES (numeric 1-12, forms 1-4. NO "CLASS")
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name_display TEXT NOT NULL,
    numeric_order INT NOT NULL,
    is_exam_class BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (academic_level_id, code)
);

-- 5. GRADE STREAMS (e.g., "Grade 10A")
CREATE TABLE IF NOT EXISTS grade_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (school_id, grade_id, name)
);

-- 6. USERS
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. STUDENTS
CREATE TABLE IF NOT EXISTS students (
    id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    admission_number TEXT UNIQUE NOT NULL,
    current_grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE RESTRICT NOT NULL,
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE RESTRICT NOT NULL,
    date_of_birth DATE,
    gender TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_email TEXT,
    date_enrolled DATE DEFAULT CURRENT_DATE,
    status student_status DEFAULT 'ACTIVE' NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. ACADEMIC YEARS & TERMS
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (academic_year_id, name)
);

-- 9. CLASS TEACHERS
CREATE TABLE IF NOT EXISTS class_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    current_grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, academic_year_id),
    UNIQUE (current_grade_stream_id, academic_year_id) -- One class teacher per stream per year
);

-- 10. SUBJECT TEACHERS
CREATE TABLE IF NOT EXISTS subject_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 11. SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE CASCADE NOT NULL,
    subject_type TEXT DEFAULT 'CORE' NOT NULL,
    display_order INT DEFAULT 0 NOT NULL,
    category TEXT DEFAULT 'TECHNICAL' NOT NULL,
    grading_system_id UUID REFERENCES grading_systems(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. SUBJECT TEACHER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS subject_teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_teacher_id UUID REFERENCES subject_teachers(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE, -- Nullable if they teach all streams
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 13. EXAMS
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    exam_type exam_type NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    term_id UUID REFERENCES terms(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE, -- Nullable
    created_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    exam_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 14. GRADING SCALES
CREATE TABLE IF NOT EXISTS grading_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grading_system_id UUID REFERENCES grading_systems(id) ON DELETE CASCADE NOT NULL,
    min_percentage NUMERIC(5,2) NOT NULL,
    max_percentage NUMERIC(5,2) NOT NULL,
    symbol TEXT NOT NULL,
    label TEXT NOT NULL,
    points INT,
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 15. EXAM MARKS
CREATE TABLE IF NOT EXISTS exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    raw_score NUMERIC(5,2) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    grade_symbol TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (exam_id, student_id)
);

-- 16. REPORT CARDS
CREATE TABLE IF NOT EXISTS report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    term_id UUID REFERENCES terms(id) ON DELETE CASCADE NOT NULL,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE RESTRICT NOT NULL,
    class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    overall_average NUMERIC(5,2),
    overall_position INT,
    comments_class_teacher TEXT,
    comments_principal TEXT,
    behaviour_summary TEXT,
    attendance_present INT,
    attendance_total INT,
    generated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    generated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (student_id, academic_year_id, term_id)
);

-- 17. REPORT CARD SUBJECTS
CREATE TABLE IF NOT EXISTS report_card_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_card_id UUID REFERENCES report_cards(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    exam_ids_used JSONB,
    total_score NUMERIC(5,2),
    total_max_score NUMERIC(5,2),
    percentage NUMERIC(5,2),
    grade_symbol TEXT,
    teacher_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (report_card_id, subject_id)
);

-- 18. PERFORMANCE HISTORY
CREATE TABLE IF NOT EXISTS performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    term_id UUID REFERENCES terms(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    average_percentage NUMERIC(5,2),
    position_in_subject INT,
    trend_vs_previous_term NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (student_id, academic_year_id, term_id, subject_id)
);

-- 19. STUDENT FEES
CREATE TABLE IF NOT EXISTS student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    term_id UUID REFERENCES terms(id) ON DELETE CASCADE NOT NULL,
    total_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_date DATE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERPAID')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (student_id, term_id)
);

-- 20. PENDING INVITES (holds admin-created invitations before user registers)
--     No FK to auth.users — the user doesn't exist yet at invite time.
CREATE TABLE IF NOT EXISTS pending_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role user_role NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    invite_code TEXT NOT NULL,
    -- Student-specific fields (nullable for non-students)
    admission_number TEXT,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE SET NULL,
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- BASIC RLS SECURITY SETTINGS
ALTER TABLE academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_card_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ADVANCED SUPABASE FEATURES: FUNCTIONS, TRIGGERS & RLS
-- ==========================================

-- Helper function to get the current user's role securely
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. TRIGGER: Auto-calculate Percentage and Grade Symbol on Exam Marks
-- Only auto-calculate grade if NOT provided (NULL or empty)
CREATE OR REPLACE FUNCTION calculate_exam_mark_grade()
RETURNS TRIGGER AS $$
DECLARE
    v_max_score NUMERIC;
    v_academic_level_id UUID;
    v_grading_system_id UUID;
    v_grade_symbol TEXT;
BEGIN
    -- Get max_score from the associated exam
    SELECT max_score INTO v_max_score FROM exams WHERE id = NEW.exam_id;
    
    -- Calculate percentage (prevent division by zero)
    IF v_max_score > 0 THEN
        NEW.percentage := (NEW.raw_score / v_max_score) * 100;
    ELSE
        NEW.percentage := 0;
    END IF;
    
    -- Only auto-calculate grade if NOT provided (allow teachers to manually set grades)
    IF NEW.grade_symbol IS NULL OR NEW.grade_symbol = '' THEN
        -- Get student's academic level based on their profile
        SELECT academic_level_id INTO v_academic_level_id FROM students WHERE id = NEW.student_id;
        
        -- Find the appropriate grading system for this academic level
        -- We look for the first grading system that matches the student's academic level 
        SELECT id INTO v_grading_system_id FROM grading_systems WHERE academic_level_id = v_academic_level_id LIMIT 1;

        -- Lookup the grade symbol from grading_scales based on the percentage
        SELECT symbol INTO v_grade_symbol
        FROM grading_scales
        WHERE grading_system_id = v_grading_system_id
          AND NEW.percentage >= min_percentage
          AND NEW.percentage <= max_percentage
        ORDER BY min_percentage DESC
        LIMIT 1;
        
        NEW.grade_symbol := v_grade_symbol;
    END IF;
    
    NEW.updated_at := now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_exam_mark_grade
BEFORE INSERT OR UPDATE ON exam_marks
FOR EACH ROW
EXECUTE FUNCTION calculate_exam_mark_grade();


-- 2. REPORT GENERATION RPC (Remote Procedure Call)
-- This allows Class Teachers or Admins to click "Generate Reports" and let the database do the heavy lifting
CREATE OR REPLACE FUNCTION generate_term_reports(
    p_academic_year_id UUID,
    p_term_id UUID,
    p_grade_stream_id UUID
)
RETURNS void AS $$
BEGIN
    -- 1. Verify caller is ADMIN or the assigned CLASS_TEACHER for this stream/year
    IF get_my_role() != 'ADMIN' THEN
        IF NOT EXISTS (
            SELECT 1 FROM class_teachers 
            WHERE user_id = auth.uid() 
              AND current_grade_stream_id = p_grade_stream_id 
              AND academic_year_id = p_academic_year_id
        ) THEN
            RAISE EXCEPTION 'Not authorized to generate reports for this class stream.';
        END IF;
    END IF;

    -- 2. Upsert master report_cards records for all active students in the stream
    INSERT INTO report_cards (student_id, academic_year_id, term_id, grade_stream_id, generated_by_user_id)
    SELECT id, p_academic_year_id, p_term_id, p_grade_stream_id, auth.uid()
    FROM students
    WHERE current_grade_stream_id = p_grade_stream_id AND status = 'ACTIVE'
    ON CONFLICT (student_id, academic_year_id, term_id) 
    DO UPDATE SET 
        generated_at = now(),
        generated_by_user_id = auth.uid();

    -- 3. Clear old report card subjects for these report cards
    DELETE FROM report_card_subjects 
    WHERE report_card_id IN (
        SELECT id FROM report_cards
        WHERE grade_stream_id = p_grade_stream_id
          AND academic_year_id = p_academic_year_id
          AND term_id = p_term_id
    );

    -- 4. Calculate per-subject aggregates for all students in bulk
    INSERT INTO report_card_subjects (report_card_id, subject_id, total_score, total_max_score, percentage)
    SELECT 
        rc.id as report_card_id,
        e.subject_id,
        SUM(em.raw_score),
        SUM(e.max_score),
        CASE WHEN SUM(e.max_score) > 0 THEN (SUM(em.raw_score) / SUM(e.max_score)) * 100 ELSE 0 END
    FROM report_cards rc
    JOIN exam_marks em ON em.student_id = rc.student_id
    JOIN exams e ON e.id = em.exam_id
    WHERE rc.grade_stream_id = p_grade_stream_id
      AND rc.academic_year_id = p_academic_year_id
      AND rc.term_id = p_term_id
      AND e.academic_year_id = p_academic_year_id
      AND e.term_id = p_term_id
    GROUP BY rc.id, e.subject_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Read access for foundational tables (publicly readable for authenticated users)
CREATE POLICY "Public read academic_levels" ON academic_levels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read grading_systems" ON grading_systems FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read schools" ON schools FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can create schools" ON schools FOR INSERT WITH CHECK (get_my_role() = 'ADMIN');
CREATE POLICY "Admins can update schools" ON schools FOR UPDATE USING (get_my_role() = 'ADMIN');
CREATE POLICY "Public read grades" ON grades FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read grade_streams" ON grade_streams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read academic_years" ON academic_years FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read terms" ON terms FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Public read subjects" ON subjects FOR SELECT USING (auth.role() = 'authenticated');

-- USERS
CREATE POLICY "Users can read all users (directory)" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update themselves" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins have full access to users" ON users FOR ALL USING (get_my_role() = 'ADMIN');

-- STUDENTS
CREATE POLICY "Anyone can view students" ON students FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Class teachers can update their own students" ON students FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM class_teachers ct 
        WHERE ct.user_id = auth.uid() AND ct.current_grade_stream_id = students.current_grade_stream_id
    )
    OR get_my_role() = 'ADMIN'
);
CREATE POLICY "Admins have full access to students" ON students FOR ALL USING (get_my_role() = 'ADMIN');

-- EXAMS
CREATE POLICY "Anyone can view exams" ON exams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Subject teachers can create/update their exams" ON exams FOR ALL USING (
    EXISTS (
        SELECT 1 FROM subject_teacher_assignments sta
        WHERE sta.subject_teacher_id = auth.uid()
          AND sta.subject_id = exams.subject_id
          AND sta.grade_id = exams.grade_id
    )
    OR get_my_role() = 'ADMIN'
);

-- EXAM MARKS
CREATE POLICY "Students can view their own marks" ON exam_marks FOR SELECT USING (
    student_id = auth.uid() OR get_my_role() IN ('ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER')
);

CREATE POLICY "Subject teachers can manage marks for exams they created" ON exam_marks FOR ALL USING (
    EXISTS (
        SELECT 1 FROM exams e
        WHERE e.id = exam_marks.exam_id
          AND e.created_by_teacher_id = auth.uid()
    )
    OR get_my_role() = 'ADMIN'
);

-- REPORT CARDS
CREATE POLICY "Students see their own reports" ON report_cards FOR SELECT USING (
    student_id = auth.uid() OR get_my_role() IN ('ADMIN', 'CLASS_TEACHER')
);

CREATE POLICY "Class teachers manage reports for their streams" ON report_cards FOR ALL USING (
    EXISTS (
        SELECT 1 FROM class_teachers ct
        WHERE ct.user_id = auth.uid() AND ct.current_grade_stream_id = report_cards.grade_stream_id
    )
    OR get_my_role() = 'ADMIN'
);

-- PENDING INVITES
CREATE POLICY "Admins can read pending invites" ON pending_invites FOR SELECT USING (get_my_role() = 'ADMIN');
CREATE POLICY "Admins can create pending invites" ON pending_invites FOR INSERT WITH CHECK (get_my_role() = 'ADMIN');
CREATE POLICY "Admins can delete pending invites" ON pending_invites FOR DELETE USING (get_my_role() = 'ADMIN');

-- ==========================================
-- MULTI-PAPER (MULTI-COMPONENT) SUBJECT SUPPORT
-- Optional per-exam paper configuration (e.g. KCSE Maths P1+P2,
-- English P1+P2+P3, Sciences theory + practical). The resolved final
-- score is still stored in exam_marks (normalised to exams.max_score),
-- so all existing grading/report/analytics logic keeps working.
-- See supabase/migrations/20260711100000_add_multi_paper_subject_support.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS exam_subject_component_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    assessment_mode TEXT NOT NULL DEFAULT 'single_paper'
        CHECK (assessment_mode IN ('single_paper', 'multi_paper')),
    aggregation_method TEXT NOT NULL DEFAULT 'sum_then_percentage'
        CHECK (aggregation_method IN (
            'sum_then_percentage',
            'languages_average_percentages',
            'science_70_plus_practical'
        )),
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (exam_id)
);

CREATE TABLE IF NOT EXISTS exam_subject_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID REFERENCES exam_subject_component_schemes(id) ON DELETE CASCADE NOT NULL,
    component_code TEXT NOT NULL,
    component_name TEXT NOT NULL,
    max_score NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
    weight NUMERIC(5,2),
    display_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (scheme_id, component_code)
);

CREATE TABLE IF NOT EXISTS exam_mark_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    component_id UUID REFERENCES exam_subject_components(id) ON DELETE CASCADE NOT NULL,
    raw_score NUMERIC(6,2) NOT NULL CHECK (raw_score >= 0),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (component_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_escs_exam_id ON exam_subject_component_schemes(exam_id);
CREATE INDEX IF NOT EXISTS idx_esc_scheme_id ON exam_subject_components(scheme_id);
CREATE INDEX IF NOT EXISTS idx_emc_exam_id ON exam_mark_components(exam_id);
CREATE INDEX IF NOT EXISTS idx_emc_student_id ON exam_mark_components(student_id);

ALTER TABLE exam_subject_component_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subject_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_mark_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read component schemes" ON exam_subject_component_schemes
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins and exam creators manage component schemes" ON exam_subject_component_schemes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = exam_subject_component_schemes.exam_id
              AND e.created_by_teacher_id = auth.uid()
        )
        OR get_my_role() = 'ADMIN'
    );

CREATE POLICY "Authenticated read components" ON exam_subject_components
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins and exam creators manage components" ON exam_subject_components
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exam_subject_component_schemes s
            JOIN exams e ON e.id = s.exam_id
            WHERE s.id = exam_subject_components.scheme_id
              AND e.created_by_teacher_id = auth.uid()
        )
        OR get_my_role() = 'ADMIN'
    );

CREATE POLICY "Students view their own component marks" ON exam_mark_components
    FOR SELECT USING (
        student_id = auth.uid()
        OR get_my_role() IN ('ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER')
    );
CREATE POLICY "Teachers manage component marks for their exams" ON exam_mark_components
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exams e
            WHERE e.id = exam_mark_components.exam_id
              AND e.created_by_teacher_id = auth.uid()
        )
        OR get_my_role() = 'ADMIN'
    );

-- ==========================================
-- CBC SENIOR SCHOOL PATHWAYS & SUBJECT COMBINATIONS (Grades 10-12)
-- Every senior learner takes 7 subjects: 4 compulsory cores
-- (English/KSL, Kiswahili, Community Service Learning, PE) + 3
-- electives from the official pathways (STEM, Social Sciences,
-- Arts & Sports Science). Ministry "subject combination" codes pin
-- a track + exact 3 electives; min 15 learners run as a class group.
-- Students with no combination assigned behave exactly as before.
-- See supabase/migrations/20260715120000_add_cbc_pathways_and_subject_combinations.sql
-- ==========================================

CREATE TABLE IF NOT EXISTS subject_combinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,                 -- ministry code, e.g. 'SPORTS'
    name TEXT NOT NULL,
    pathway cbc_pathway NOT NULL,
    track TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (school_id, code)
);

CREATE TABLE IF NOT EXISTS subject_combination_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combination_id UUID REFERENCES subject_combinations(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (combination_id, subject_id)
);

CREATE TABLE IF NOT EXISTS student_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'ELECTIVE' CHECK (role IN ('CORE', 'ELECTIVE')),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (student_id, subject_id)
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS pathway cbc_pathway;
ALTER TABLE students ADD COLUMN IF NOT EXISTS track TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS subject_combination_id UUID
    REFERENCES subject_combinations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subject_combinations_school_id ON subject_combinations(school_id);
CREATE INDEX IF NOT EXISTS idx_scs_combination_id ON subject_combination_subjects(combination_id);
CREATE INDEX IF NOT EXISTS idx_scs_subject_id ON subject_combination_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_id ON student_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_school_id ON student_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_students_subject_combination_id ON students(subject_combination_id);

ALTER TABLE subject_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_combination_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read subject combinations" ON subject_combinations
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage subject combinations" ON subject_combinations
    FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "Authenticated read combination subjects" ON subject_combination_subjects
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage combination subjects" ON subject_combination_subjects
    FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "Students view their own subject enrollments" ON student_subjects
    FOR SELECT USING (
        student_id::text = auth.uid()::text
        OR get_my_role() IN ('ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER')
    );
CREATE POLICY "Class teachers and admins manage subject enrollments" ON student_subjects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM class_teachers ct
            JOIN students s ON s.current_grade_stream_id = ct.current_grade_stream_id
            WHERE ct.user_id::text = auth.uid()::text
              AND s.id = student_subjects.student_id
        )
        OR get_my_role() = 'ADMIN'
    );

CREATE OR REPLACE FUNCTION touch_subject_combination()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_touch_subject_combination
BEFORE UPDATE ON subject_combinations
FOR EACH ROW
EXECUTE FUNCTION touch_subject_combination();

CREATE OR REPLACE FUNCTION touch_student_subject()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_touch_student_subject
BEFORE UPDATE ON student_subjects
FOR EACH ROW
EXECUTE FUNCTION touch_student_subject();
