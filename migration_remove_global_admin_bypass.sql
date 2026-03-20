-- migration_remove_global_admin_bypass.sql
-- This migration drops the overly-broad legacy policies that were granting 'ADMIN's full database access,
-- and replaces them with strict multi-tenant native subquery policies tailored to the admin's school_id.

-- 1. USERS table
DROP POLICY IF EXISTS "Admins have full access to users" ON users;
CREATE POLICY "Admins can manage users in their school" ON users FOR ALL USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);

-- 2. STUDENTS table
DROP POLICY IF EXISTS "Admins have full access to students" ON students;
CREATE POLICY "Admins can manage students in their school" ON students FOR ALL USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = students.id 
    AND u.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Class teachers can update their own students" ON students;
CREATE POLICY "Class teachers can update their own students" ON students FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM class_teachers ct 
        WHERE ct.user_id = auth.uid() AND ct.current_grade_stream_id = students.current_grade_stream_id
    )
    OR (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = students.id 
            AND u.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
    )
);

-- 3. EXAMS table
DROP POLICY IF EXISTS "Subject teachers can create/update their exams" ON exams;
CREATE POLICY "Subject teachers can create/update their exams" ON exams FOR ALL USING (
    EXISTS (
        SELECT 1 FROM subject_teacher_assignments sta
        WHERE sta.subject_teacher_id = auth.uid()
          AND sta.subject_id = exams.subject_id
          AND sta.grade_id = exams.grade_id
    )
    OR (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = exams.created_by_teacher_id 
            AND u.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
    )
);

-- 4. EXAM_MARKS table
DROP POLICY IF EXISTS "Subject teachers can manage marks for exams they created" ON exam_marks;
CREATE POLICY "Subject teachers can manage marks for exams they created" ON exam_marks FOR ALL USING (
    EXISTS (
        SELECT 1 FROM exams e
        WHERE e.id = exam_marks.exam_id
          AND e.created_by_teacher_id = auth.uid()
    )
    OR (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = exam_marks.student_id 
            AND u.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
    )
);

-- 5. REPORT_CARDS table
DROP POLICY IF EXISTS "Class teachers manage reports for their streams" ON report_cards;
CREATE POLICY "Class teachers manage reports for their streams" ON report_cards FOR ALL USING (
    EXISTS (
        SELECT 1 FROM class_teachers ct
        WHERE ct.user_id = auth.uid() AND ct.current_grade_stream_id = report_cards.grade_stream_id
    )
    OR (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = report_cards.student_id 
            AND u.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        )
    )
);

-- 6. PENDING_INVITES table
DROP POLICY IF EXISTS "Admins can create pending invites" ON pending_invites;
DROP POLICY IF EXISTS "Admins can delete pending invites" ON pending_invites;

CREATE POLICY "Admins can create pending invites for their school" ON pending_invites FOR INSERT WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND 
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "Admins can delete pending invites for their school" ON pending_invites FOR DELETE USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN' AND 
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);
