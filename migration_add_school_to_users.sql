-- Migration: Phone-based user invitation flow
-- Run this in your Supabase SQL Editor AFTER supabase_schema.sql
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards

-- 1. Add school_id column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;

-- 2. Add phone column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Add invite_code column for phone-based invitation
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_users_school_id ON public.users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON public.users(invite_code);

-- 5. Enable RLS on key tables (idempotent)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for users table
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read same school users" ON public.users;
CREATE POLICY "Users can read same school users" ON public.users
    FOR SELECT USING (
        school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Service role full access" ON public.users;
CREATE POLICY "Service role full access" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can manage school users" ON public.users;
CREATE POLICY "Admins can manage school users" ON public.users
    FOR ALL USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN'
        AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    );

-- 7. RLS Policies for schools table
DROP POLICY IF EXISTS "Users can read their school" ON public.schools;
CREATE POLICY "Users can read their school" ON public.schools
    FOR SELECT USING (
        id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can update their school" ON public.schools;
CREATE POLICY "Admins can update their school" ON public.schools
    FOR UPDATE USING (
        id = (SELECT school_id FROM public.users WHERE id = auth.uid())
        AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "Admins can insert schools" ON public.schools;
CREATE POLICY "Admins can insert schools" ON public.schools
    FOR INSERT WITH CHECK (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "Service role full access on schools" ON public.schools;
CREATE POLICY "Service role full access on schools" ON public.schools
    FOR ALL USING (auth.role() = 'service_role');
