-- Migration: Add announcements, assignments, and learning_materials tables

-- 1. ANNOUNCEMENTS (school-wide announcements visible to students)
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_important BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. ASSIGNMENTS (homework/assignments for specific subjects/streams)
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

-- 3. LEARNING MATERIALS (notes, summaries, or study resources)
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

-- RLS: Enable row-level security
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_materials ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read announcements (filtered by school_id in queries)
CREATE POLICY "Anyone can view announcements" ON announcements
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage announcements" ON announcements
    FOR ALL USING (get_my_role() = 'ADMIN');

-- RLS: Authenticated users can read assignments
CREATE POLICY "Anyone can view assignments" ON assignments
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers can manage assignments" ON assignments
    FOR ALL USING (get_my_role() IN ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'));

-- RLS: Authenticated users can read learning_materials
CREATE POLICY "Anyone can view learning_materials" ON learning_materials
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers can manage learning_materials" ON learning_materials
    FOR ALL USING (get_my_role() IN ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'));
