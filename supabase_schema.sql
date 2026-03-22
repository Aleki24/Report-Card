-- Supabase Database Schema for Results Analysis App
-- Run this in the Supabase SQL Editor

-- 0. CLEAN SLATE: DROP ALL EXISTING TABLES, TYPES, AND FUNCTIONS
DROP FUNCTION IF EXISTS calculate_exam_mark_grade() CASCADE;
DROP FUNCTION IF EXISTS generate_term_reports(UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_my_role() CASCADE;

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
CREATE TYPE user_role AS ENUM ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT');

DROP TYPE IF EXISTS exam_type CASCADE;
CREATE TYPE exam_type AS ENUM ('CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER');

DROP TYPE IF EXISTS student_status CASCADE;
CREATE TYPE student_status AS ENUM ('ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DEACTIVATED');

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
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (grade_id, name)
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
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. ACADEMIC YEARS & TERMS
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false NOT NULL,
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
    is_compulsory BOOLEAN DEFAULT true NOT NULL,
    display_order INT DEFAULT 0 NOT NULL,
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

-- 19. PENDING INVITES (holds admin-created invitations before user registers)
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
