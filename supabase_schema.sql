-- Supabase Database Schema for Results Analysis App
-- Run this in the Supabase SQL Editor

-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'parent');
CREATE TYPE exam_term AS ENUM ('mid_term', 'end_term', 'annual');

-- 1. USERS TABLE (Extends Supabase Auth)
-- We use a public.users table to store profile info linked to auth.users
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'parent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. SCHOOL CLASSES TABLE
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g., "Grade 10A"
  academic_year TEXT NOT NULL, -- e.g., "2026-2027"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. SUBJECTS TABLE
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g., "Mathematics"
  code TEXT UNIQUE, -- e.g., "MATH101"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. STUDENTS TABLE
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  enrollment_number TEXT UNIQUE NOT NULL,
  date_of_birth DATE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Link to parent account
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. EXAMS TABLE
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL, -- e.g., "Fall Mid-Term 2026"
  term exam_term NOT NULL,
  academic_year TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. MARKS TABLE (Core transactional table)
CREATE TABLE public.marks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Who entered it
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100), -- Assuming percentage or max 100
  total_possible DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, subject_id, exam_id) -- Prevent duplicate entries for the same exam/subject/student
);

-- RLS (Row Level Security) Policies
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- FERPA POLICIES

-- Users: Can read their own profile, Admins/Teachers can read all
CREATE POLICY "Users can view their own profile." ON public.users 
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teachers and admins can view all users." ON public.users 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Classes, Subjects, Exams: Readable by all authenticated users
CREATE POLICY "Classes are viewable by all authenticated users." ON public.classes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Subjects are viewable by all authenticated users." ON public.subjects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Exams are viewable by all authenticated users." ON public.exams FOR SELECT USING (auth.role() = 'authenticated');

-- Students:
-- Parents can only view their own children
-- Teachers and admins can view all students
CREATE POLICY "Parents can view their own children." ON public.students 
  FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "Teachers and admins can view all students." ON public.students 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Marks:
-- Parents can only view marks for their own children
-- Teachers and admins can view all marks, configure marks
CREATE POLICY "Parents can view marks of their children." ON public.marks 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.students WHERE id = student_id AND parent_id = auth.uid())
  );
  
CREATE POLICY "Teachers and admins have full access to marks." ON public.marks 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );
