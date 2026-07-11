-- Migration: Add student_fees and assignment_submissions tables
-- Run this in the Supabase SQL Editor after the schema.

-- 1. STUDENT FEES (track fee balances per student per term)
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

-- 2. ASSIGNMENT SUBMISSIONS (students submit their work)
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

-- RLS
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view fees" ON student_fees
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage fees" ON student_fees
    FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "Anyone can view submissions" ON assignment_submissions
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Students can insert their own submissions" ON assignment_submissions
    FOR INSERT WITH CHECK (
        student_id IN (SELECT id FROM students WHERE id = auth.uid())
        AND get_my_role() = 'STUDENT'
    );
CREATE POLICY "Teachers can grade submissions" ON assignment_submissions
    FOR UPDATE USING (get_my_role() IN ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'));
