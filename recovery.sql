-- ============================================================
-- RECOVERY SCRIPT — Restore empty database structure + admin
-- Does NOT drop any tables. Safe to run on an empty DB.
-- ============================================================

-- 0. Fix FK constraint on users table (removes reference to auth.users
--    since the app uses its own password_hash column, not Supabase Auth)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Add columns that the existing users table might be missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add school_id to tables that need it
ALTER TABLE grade_streams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Fix grade_streams unique constraint for multi-tenant
ALTER TABLE grade_streams DROP CONSTRAINT IF EXISTS grade_streams_grade_id_name_key;
ALTER TABLE grade_streams DROP CONSTRAINT IF EXISTS grade_streams_school_id_grade_id_name_key;
ALTER TABLE grade_streams ADD CONSTRAINT grade_streams_school_id_grade_id_name_key UNIQUE (school_id, grade_id, name);

-- 1. CORE TABLES (with IF NOT EXISTS, no DROPs)
CREATE TABLE IF NOT EXISTS academic_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS grading_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS grade_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (school_id, grade_id, name)
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    password_hash TEXT,
    plain_password TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_number TEXT UNIQUE NOT NULL,
    current_grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE RESTRICT NOT NULL,
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE RESTRICT NOT NULL,
    date_of_birth DATE,
    gender TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_email TEXT,
    date_enrolled DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DEACTIVATED')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
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

CREATE TABLE IF NOT EXISTS class_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    current_grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, academic_year_id),
    UNIQUE (current_grade_stream_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS subject_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE CASCADE NOT NULL,
    is_compulsory BOOLEAN DEFAULT true NOT NULL,
    display_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS subject_teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_teacher_id UUID REFERENCES subject_teachers(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER')),
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE NOT NULL,
    term_id UUID REFERENCES terms(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    grade_id UUID REFERENCES grades(id) ON DELETE CASCADE NOT NULL,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE,
    created_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    exam_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS pending_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT')),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    invite_code TEXT NOT NULL,
    admission_number TEXT,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE SET NULL,
    academic_level_id UUID REFERENCES academic_levels(id) ON DELETE SET NULL,
    username TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. NEW TABLES (announcements, assignments, materials, fees, submissions)
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_important BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    file_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
    grade_stream_id UUID REFERENCES grade_streams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_size_bytes BIGINT,
    file_type TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT,
    submission_text TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    grade NUMERIC(5,2),
    feedback TEXT,
    graded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMPTZ,
    UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (student_id, date)
);

-- 3. SEED: School + Academic Levels + Admin
INSERT INTO academic_levels (code, name, description) VALUES
  ('CBC', 'Competency Based Curriculum', 'Pre-primary through Grade 12 (2-6-3-3 structure)'),
  ('844', '8-4-4 System', '8 years primary, 4 years secondary, 4 years university')
ON CONFLICT (code) DO NOTHING;

INSERT INTO schools (name, address, phone, email) VALUES
  ('My School', 'Nairobi, Kenya', '+254700000000', 'info@myschool.ac.ke')
ON CONFLICT DO NOTHING;

-- 4. SEED: Grades CBC + 844
DO $$
DECLARE
  v_cbc UUID;
  v_844 UUID;
BEGIN
  SELECT id INTO v_cbc FROM academic_levels WHERE code = 'CBC';
  SELECT id INTO v_844 FROM academic_levels WHERE code = '844';

  INSERT INTO grades (academic_level_id, code, name_display, numeric_order, is_exam_class) VALUES
    (v_cbc, 'PP1', 'Pre-Primary 1', 1,  false),
    (v_cbc, 'PP2', 'Pre-Primary 2', 2,  false),
    (v_cbc, 'G1',  'Grade 1',       3,  false),
    (v_cbc, 'G2',  'Grade 2',       4,  false),
    (v_cbc, 'G3',  'Grade 3',       5,  false),
    (v_cbc, 'G4',  'Grade 4',       6,  false),
    (v_cbc, 'G5',  'Grade 5',       7,  false),
    (v_cbc, 'G6',  'Grade 6',       8,  true),
    (v_cbc, 'G7',  'Grade 7',       9,  false),
    (v_cbc, 'G8',  'Grade 8',       10, false),
    (v_cbc, 'G9',  'Grade 9',       11, true),
    (v_cbc, 'G10', 'Grade 10',      12, false),
    (v_cbc, 'G11', 'Grade 11',      13, false),
    (v_cbc, 'G12', 'Grade 12',      14, true)
  ON CONFLICT (academic_level_id, code) DO NOTHING;

  INSERT INTO grades (academic_level_id, code, name_display, numeric_order, is_exam_class) VALUES
    (v_844, 'S1', 'Standard 1', 1,  false),
    (v_844, 'S2', 'Standard 2', 2,  false),
    (v_844, 'S3', 'Standard 3', 3,  false),
    (v_844, 'S4', 'Standard 4', 4,  false),
    (v_844, 'S5', 'Standard 5', 5,  false),
    (v_844, 'S6', 'Standard 6', 6,  false),
    (v_844, 'S7', 'Standard 7', 7,  false),
    (v_844, 'S8', 'Standard 8', 8,  true),
    (v_844, 'F1', 'Form 1',     9,  false),
    (v_844, 'F2', 'Form 2',     10, false),
    (v_844, 'F3', 'Form 3',     11, false),
    (v_844, 'F4', 'Form 4',     12, true)
  ON CONFLICT (academic_level_id, code) DO NOTHING;
END $$;

-- 5. SEED: Grade Streams
DO $$
DECLARE
  v_id UUID;
  v_school_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools LIMIT 1;

  SELECT id INTO v_id FROM grades WHERE code = 'G7';
  IF v_id IS NOT NULL AND v_school_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name, school_id) VALUES
      (v_id, 'A', 'Grade 7A', v_school_id), (v_id, 'B', 'Grade 7B', v_school_id)
    ON CONFLICT (school_id, grade_id, name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM grades WHERE code = 'G8';
  IF v_id IS NOT NULL AND v_school_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name, school_id) VALUES
      (v_id, 'A', 'Grade 8A', v_school_id), (v_id, 'B', 'Grade 8B', v_school_id)
    ON CONFLICT (school_id, grade_id, name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM grades WHERE code = 'F1';
  IF v_id IS NOT NULL AND v_school_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name, school_id) VALUES
      (v_id, 'A', 'Form 1A', v_school_id), (v_id, 'B', 'Form 1B', v_school_id)
    ON CONFLICT (school_id, grade_id, name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM grades WHERE code = 'F2';
  IF v_id IS NOT NULL AND v_school_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name, school_id) VALUES
      (v_id, 'A', 'Form 2A', v_school_id), (v_id, 'B', 'Form 2B', v_school_id)
    ON CONFLICT (school_id, grade_id, name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM grades WHERE code = 'F3';
  IF v_id IS NOT NULL AND v_school_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name, school_id) VALUES
      (v_id, 'A', 'Form 3A', v_school_id)
    ON CONFLICT (school_id, grade_id, name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM grades WHERE code = 'F4';
  IF v_id IS NOT NULL AND v_school_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name, school_id) VALUES
      (v_id, 'A', 'Form 4A', v_school_id)
    ON CONFLICT (school_id, grade_id, name) DO NOTHING;
  END IF;
END $$;

-- 6. SEED: Subjects (CBC)
DO $$
DECLARE
  v_cbc UUID;
  v_844 UUID;
BEGIN
  SELECT id INTO v_cbc FROM academic_levels WHERE code = 'CBC';
  SELECT id INTO v_844 FROM academic_levels WHERE code = '844';

  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('ENG', 'English', v_cbc, true, 1),
    ('KISW', 'Kiswahili', v_cbc, true, 2),
    ('MATH', 'Mathematics', v_cbc, true, 3),
    ('SCI', 'Integrated Science', v_cbc, true, 4),
    ('HIST', 'History & Government', v_cbc, true, 5),
    ('GEO', 'Geography', v_cbc, true, 6),
    ('CRE', 'Christian Religious Education', v_cbc, true, 7),
    ('AGRI', 'Agriculture', v_cbc, true, 8),
    ('BUS', 'Business Studies', v_cbc, false, 9),
    ('FRE', 'French', v_cbc, false, 10),
    ('COMP', 'Computer Studies', v_cbc, false, 11),
    ('MUSIC', 'Music', v_cbc, false, 12),
    ('PE', 'Physical Education', v_cbc, true, 13)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('ENG8', 'English', v_844, true, 1),
    ('KISW8', 'Kiswahili', v_844, true, 2),
    ('MATH8', 'Mathematics', v_844, true, 3),
    ('SCIE', 'Science', v_844, true, 4),
    ('HIST8', 'History & Government', v_844, true, 5),
    ('GEO8', 'Geography', v_844, true, 6),
    ('CRE8', 'Christian Religious Education', v_844, true, 7),
    ('AGRI8', 'Agriculture', v_844, true, 8),
    ('BUS8', 'Business Studies', v_844, false, 9)
  ON CONFLICT (code) DO NOTHING;
END $$;

-- 7. SEED: Academic Year & Terms (2026)
INSERT INTO academic_years (name, start_date, end_date)
VALUES ('2026', '2026-01-06', '2026-11-27')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  v_year UUID;
  v_school_id UUID;
BEGIN
  SELECT id INTO v_year FROM academic_years WHERE name = '2026';
  SELECT id INTO v_school_id FROM schools LIMIT 1;
  IF v_year IS NOT NULL THEN
    INSERT INTO terms (academic_year_id, name, start_date, end_date, is_current, school_id) VALUES
      (v_year, 'Term 1', '2026-01-06', '2026-04-10', true, v_school_id),
      (v_year, 'Term 2', '2026-05-05', '2026-08-07', false, v_school_id),
      (v_year, 'Term 3', '2026-09-01', '2026-11-27', false, v_school_id)
    ON CONFLICT (academic_year_id, name) DO NOTHING;
  END IF;
END $$;

-- 8. CREATE ADMIN USER (sathya@gmail.com / Alexot12..)
DO $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools LIMIT 1;
  
  INSERT INTO users (id, first_name, last_name, email, phone, role, is_active, school_id, username, password_hash)
  VALUES (
    gen_random_uuid(),
    'Admin',
    'User',
    'sathya@gmail.com',
    '+254700000000',
    'ADMIN',
    true,
    v_school_id,
    'admin',
    '$2b$12$rAfE.a.1eJ74e//DU0b.pe2l1ODUKa4LcmspK/baZVSUB29Gg7sTu'
  )
  ON CONFLICT (email) DO NOTHING;
END $$;

-- 9. Helper function used by the app
-- Use CREATE OR REPLACE to avoid CASCADE dropping RLS policies
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
