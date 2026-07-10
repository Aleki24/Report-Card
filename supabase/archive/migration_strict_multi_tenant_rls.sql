-- Fix multi-tenant RLS for real (Native Subqueries Version)

-- (Removed DROP FUNCTION statements because existing policies depend on them)


-- 1. Users can only read users from their own school. (No global admin bypass!)
DROP POLICY IF EXISTS "Users can read all users (directory)" ON users;
DROP POLICY IF EXISTS "Users can read same school users" ON users;
CREATE POLICY "Users can read same school users" ON users FOR SELECT USING (
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);

-- 2. Restrict 'students' read policy
DROP POLICY IF EXISTS "Anyone can view students" ON students;
DROP POLICY IF EXISTS "Users can view students in same school" ON students;
CREATE POLICY "Users can view students in same school" ON students FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = students.id 
    AND users.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
);

-- 3. Restrict 'exams'
DROP POLICY IF EXISTS "Anyone can view exams" ON exams;
DROP POLICY IF EXISTS "Users can view exams from same school" ON exams;
CREATE POLICY "Users can view exams from same school" ON exams FOR SELECT USING (
  created_by_teacher_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = exams.created_by_teacher_id 
    AND u.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
);

-- 4. Restrict 'exam_marks'
DROP POLICY IF EXISTS "Students can view their own marks" ON exam_marks;
DROP POLICY IF EXISTS "Users can view exam marks for their school" ON exam_marks;
CREATE POLICY "Users can view exam marks for their school" ON exam_marks FOR SELECT USING (
  student_id = auth.uid() OR (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER') AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = exam_marks.student_id 
      AND users.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    )
  )
);

-- 5. Restrict 'report_cards'
DROP POLICY IF EXISTS "Students see their own reports" ON report_cards;
DROP POLICY IF EXISTS "Users can view report cards for their school" ON report_cards;
CREATE POLICY "Users can view report cards for their school" ON report_cards FOR SELECT USING (
    student_id = auth.uid() OR (
        (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'CLASS_TEACHER') AND
        EXISTS (
          SELECT 1 FROM users u 
          WHERE u.id = report_cards.student_id 
          AND u.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
    )
);

-- 6. pending_invites
DROP POLICY IF EXISTS "Admins can read pending invites" ON pending_invites;
DROP POLICY IF EXISTS "Admins can read pending invites for their school" ON pending_invites;
CREATE POLICY "Admins can read pending invites for their school" ON pending_invites FOR SELECT USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' 
  AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);
