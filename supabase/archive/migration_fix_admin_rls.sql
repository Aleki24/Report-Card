-- migration_fix_admin_rls.sql

-- 1. Redefine 'users' read policy to strict school isolation
DROP POLICY IF EXISTS "Users can read same school users" ON users;
CREATE POLICY "Users can read same school users" ON users FOR SELECT USING (
  school_id = public.get_my_school_id() 
);

-- 2. Ensure Admins can read pending invites for their school only
DROP POLICY IF EXISTS "Admins can read pending invites for their school" ON pending_invites;
CREATE POLICY "Admins can read pending invites for their school" ON pending_invites FOR SELECT USING (
  get_my_role() = 'ADMIN' AND school_id = public.get_my_school_id()
);
