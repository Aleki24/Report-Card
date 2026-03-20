-- migration_multi_tenant_rls.sql

-- 1. Redefine 'users' read policy (directory) strictly to school_id or admin
DROP POLICY IF EXISTS "Users can read all users (directory)" ON users;
DROP POLICY IF EXISTS "Users can read same school users" ON users;
CREATE POLICY "Users can read same school users" ON users FOR SELECT USING (
  school_id = public.get_my_school_id() OR get_my_role() = 'ADMIN'
);

-- 2. Restrict 'students' read policy
DROP POLICY IF EXISTS "Anyone can view students" ON students;
CREATE POLICY "Users can view students in same school" ON students FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = students.id AND users.school_id = public.get_my_school_id())
);

-- 3. Restrict 'exams' read policy
DROP POLICY IF EXISTS "Anyone can view exams" ON exams;
CREATE POLICY "Users can view exams from same school" ON exams FOR SELECT USING (
  created_by_teacher_id IS NULL OR 
  EXISTS (SELECT 1 FROM users WHERE users.id = exams.created_by_teacher_id AND users.school_id = public.get_my_school_id())
);

-- 4. Restrict 'exam_marks' read policy
DROP POLICY IF EXISTS "Students can view their own marks" ON exam_marks;
CREATE POLICY "Users can view exam marks for their school" ON exam_marks FOR SELECT USING (
  student_id = auth.uid() OR (
    get_my_role() IN ('ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER') AND
    EXISTS (SELECT 1 FROM users WHERE users.id = exam_marks.student_id AND users.school_id = public.get_my_school_id())
  )
);

-- 5. Restrict 'report_cards' read policy
DROP POLICY IF EXISTS "Students see their own reports" ON report_cards;
CREATE POLICY "Users can view report cards for their school" ON report_cards FOR SELECT USING (
    student_id = auth.uid() OR (
        get_my_role() IN ('ADMIN', 'CLASS_TEACHER') AND
        EXISTS (SELECT 1 FROM users WHERE users.id = report_cards.student_id AND users.school_id = public.get_my_school_id())
    )
);

-- 6. Restrict 'pending_invites' read policy
DROP POLICY IF EXISTS "Admins can read pending invites" ON pending_invites;
CREATE POLICY "Admins can read pending invites for their school" ON pending_invites FOR SELECT USING (
  get_my_role() = 'ADMIN' AND school_id = public.get_my_school_id()
);
