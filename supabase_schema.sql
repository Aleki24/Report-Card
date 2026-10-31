-- ⚠️⚠️⚠️ WARNING: RUNNING THIS FILE WILL DELETE ALL DATA! ⚠️⚠️⚠️
-- This file DROPS and recreates the whole public schema from scratch.
-- Only run this on a BRAND NEW empty database.
-- To change an existing database, add a migration in supabase/migrations/.
-- ================================================================
-- Supabase database schema for Skulbase.
--
-- Generated from the live database's catalog on 2026-10-31, after
-- migration 20261031090000_student_promotion. It is a snapshot: the
-- migrations remain the history, and this file should be regenerated
-- (not hand-edited) when they change. Statements are in dependency order:
-- types, sequences, tables, functions, foreign keys, indexes, views,
-- triggers, row-level security, policies, grants, storage buckets.
--
-- Notes on what is here and why:
--   * users.id and every column that points at a person (students.id,
--     student_id, created_by, …) are text: they hold Clerk user ids
--     (user_…), not Supabase auth uuids.
--   * Every table has row-level security on, and anon/authenticated hold
--     no table privileges: the app reads and writes through its server
--     with the service role. The policies below are kept as they are live,
--     but grant nothing to a client without table privileges.
--   * Functions run as the service role only, except two trigger
--     functions that are executable by everyone, as live.
-- Run in the Supabase SQL editor (as postgres).

SET check_function_bodies = false;
SET search_path = public, extensions;


-- ======================================================================
-- 0. Clean slate
-- ======================================================================

DROP EVENT TRIGGER IF EXISTS ensure_rls;
DROP VIEW IF EXISTS public.school_subject_catalogue CASCADE;
DROP TABLE IF EXISTS public.academic_levels CASCADE;
DROP TABLE IF EXISTS public.academic_years CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.attendance_notifications CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.class_teachers CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.clinic_visits CASCADE;
DROP TABLE IF EXISTS public.competency_assessments CASCADE;
DROP TABLE IF EXISTS public.daily_attendance CASCADE;
DROP TABLE IF EXISTS public.discipline_incidents CASCADE;
DROP TABLE IF EXISTS public.dorm_allocations CASCADE;
DROP TABLE IF EXISTS public.dorm_inspections CASCADE;
DROP TABLE IF EXISTS public.dorms CASCADE;
DROP TABLE IF EXISTS public.exam_mark_components CASCADE;
DROP TABLE IF EXISTS public.exam_mark_history CASCADE;
DROP TABLE IF EXISTS public.exam_marking_requests CASCADE;
DROP TABLE IF EXISTS public.exam_marking_windows CASCADE;
DROP TABLE IF EXISTS public.exam_marks CASCADE;
DROP TABLE IF EXISTS public.exam_paper_reviews CASCADE;
DROP TABLE IF EXISTS public.exam_papers CASCADE;
DROP TABLE IF EXISTS public.exam_subject_component_schemes CASCADE;
DROP TABLE IF EXISTS public.exam_subject_components CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.exeats CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.fee_awards CASCADE;
DROP TABLE IF EXISTS public.fee_payments CASCADE;
DROP TABLE IF EXISTS public.fee_structure_items CASCADE;
DROP TABLE IF EXISTS public.fee_structures CASCADE;
DROP TABLE IF EXISTS public.grade_streams CASCADE;
DROP TABLE IF EXISTS public.grades CASCADE;
DROP TABLE IF EXISTS public.grading_scales CASCADE;
DROP TABLE IF EXISTS public.grading_systems CASCADE;
DROP TABLE IF EXISTS public.inventory_items CASCADE;
DROP TABLE IF EXISTS public.invite_codes CASCADE;
DROP TABLE IF EXISTS public.invoice_lines CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.learning_materials CASCADE;
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TABLE IF EXISTS public.lesson_plans CASCADE;
DROP TABLE IF EXISTS public.library_books CASCADE;
DROP TABLE IF EXISTS public.library_loans CASCADE;
DROP TABLE IF EXISTS public.marks CASCADE;
DROP TABLE IF EXISTS public.medical_profiles CASCADE;
DROP TABLE IF EXISTS public.medication_logs CASCADE;
DROP TABLE IF EXISTS public.medicine_stock CASCADE;
DROP TABLE IF EXISTS public.pending_invites CASCADE;
DROP TABLE IF EXISTS public.performance_history CASCADE;
DROP TABLE IF EXISTS public.rate_limit_hits CASCADE;
DROP TABLE IF EXISTS public.records_of_work CASCADE;
DROP TABLE IF EXISTS public.report_card_subjects CASCADE;
DROP TABLE IF EXISTS public.report_cards CASCADE;
DROP TABLE IF EXISTS public.roll_call_entries CASCADE;
DROP TABLE IF EXISTS public.roll_calls CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.route_stops CASCADE;
DROP TABLE IF EXISTS public.scheme_entries CASCADE;
DROP TABLE IF EXISTS public.schemes_of_work CASCADE;
DROP TABLE IF EXISTS public.school_bank_accounts CASCADE;
DROP TABLE IF EXISTS public.school_events CASCADE;
DROP TABLE IF EXISTS public.school_modules CASCADE;
DROP TABLE IF EXISTS public.school_payment_settings CASCADE;
DROP TABLE IF EXISTS public.school_sections CASCADE;
DROP TABLE IF EXISTS public.school_subjects CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.store_requisitions CASCADE;
DROP TABLE IF EXISTS public.student_fees CASCADE;
DROP TABLE IF EXISTS public.student_goals CASCADE;
DROP TABLE IF EXISTS public.student_guardians CASCADE;
DROP TABLE IF EXISTS public.student_promotion_runs CASCADE;
DROP TABLE IF EXISTS public.student_promotions CASCADE;
DROP TABLE IF EXISTS public.student_subjects CASCADE;
DROP TABLE IF EXISTS public.student_transport CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.subject_combination_subjects CASCADE;
DROP TABLE IF EXISTS public.subject_combinations CASCADE;
DROP TABLE IF EXISTS public.subject_teacher_assignments CASCADE;
DROP TABLE IF EXISTS public.subject_teachers CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.subjects_merge_audit CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.terms CASCADE;
DROP TABLE IF EXISTS public.timetable_configs CASCADE;
DROP TABLE IF EXISTS public.timetable_lessons CASCADE;
DROP TABLE IF EXISTS public.timetable_requirements CASCADE;
DROP TABLE IF EXISTS public.timetable_subject_groups CASCADE;
DROP TABLE IF EXISTS public.timetable_substitutions CASCADE;
DROP TABLE IF EXISTS public.timetable_versions CASCADE;
DROP TABLE IF EXISTS public.transport_crew CASCADE;
DROP TABLE IF EXISTS public.transport_routes CASCADE;
DROP TABLE IF EXISTS public.trip_boardings CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.user_duties CASCADE;
DROP TABLE IF EXISTS public.user_signatures CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.vehicle_logs CASCADE;
DROP TABLE IF EXISTS public.vehicle_positions CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.vote_heads CASCADE;
DROP FUNCTION IF EXISTS public.calculate_exam_mark_grade() CASCADE;
DROP FUNCTION IF EXISTS public.class_exam_series(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.class_merit_list(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid, p_exam_type text) CASCADE;
DROP FUNCTION IF EXISTS public.class_subject_performance(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid, p_exam_type text, p_pass_mark numeric) CASCADE;
DROP FUNCTION IF EXISTS public.enforce_term_mark_lock() CASCADE;
DROP FUNCTION IF EXISTS public.exam_mark_totals(p_school_id uuid, p_term_id uuid, p_year_id uuid, p_subject_id uuid, p_exam_ids uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.generate_receipt_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_school_invite_codes() CASCADE;
DROP FUNCTION IF EXISTS public.generate_term_reports(p_academic_year_id uuid, p_term_id uuid, p_grade_stream_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_term_reports(p_term_id uuid, p_grade_stream_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_school_id() CASCADE;
DROP FUNCTION IF EXISTS public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer) CASCADE;
DROP FUNCTION IF EXISTS public.library_loans_check_available() CASCADE;
DROP FUNCTION IF EXISTS public.log_exam_mark_change() CASCADE;
DROP FUNCTION IF EXISTS public.medication_logs_take_stock() CASCADE;
DROP FUNCTION IF EXISTS public.publish_timetable_version(p_school_id uuid, p_version_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.rls_auto_enable() CASCADE;
DROP FUNCTION IF EXISTS public.school_class_performance(p_school_id uuid, p_academic_year_id uuid, p_pass_mark numeric) CASCADE;
DROP FUNCTION IF EXISTS public.school_class_performance_for_term(p_school_id uuid, p_term_id uuid, p_pass_mark numeric) CASCADE;
DROP FUNCTION IF EXISTS public.school_mark_summary(p_school_id uuid, p_academic_year_id uuid, p_pass_mark numeric) CASCADE;
DROP FUNCTION IF EXISTS public.school_unmarked_exams(p_school_id uuid, p_academic_year_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.school_unmarked_exams_for_term(p_school_id uuid, p_term_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_class_teacher(p_school_id uuid, p_stream_id uuid, p_user_id text, p_year_id uuid) CASCADE;
DROP FUNCTION IF EXISTS public.set_student_school_id() CASCADE;
DROP FUNCTION IF EXISTS public.swap_timetable_slot(p_version_id uuid, p_group uuid[], p_swap uuid[], p_to_day smallint, p_to_period smallint, p_from_day smallint, p_from_period smallint, p_park_period smallint, p_lesson uuid, p_room uuid, p_locked boolean) CASCADE;
DROP FUNCTION IF EXISTS public.sync_student_fee_totals() CASCADE;
DROP FUNCTION IF EXISTS public.sync_student_school_id() CASCADE;
DROP FUNCTION IF EXISTS public.touch_exam_mark_component() CASCADE;
DROP FUNCTION IF EXISTS public.touch_student_subject() CASCADE;
DROP FUNCTION IF EXISTS public.touch_subject_combination() CASCADE;
DROP FUNCTION IF EXISTS public.run_student_promotion(p_school_id uuid, p_academic_year_id uuid, p_actor text, p_decisions jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.undo_student_promotion(p_school_id uuid, p_run_id uuid, p_actor text) CASCADE;
DROP SEQUENCE IF EXISTS public.fee_receipt_number_seq CASCADE;
DROP SEQUENCE IF EXISTS public.subjects_merge_audit_id_seq CASCADE;
DROP TYPE IF EXISTS public.attendance_status CASCADE;
DROP TYPE IF EXISTS public.cbc_pathway CASCADE;
DROP TYPE IF EXISTS public.exam_term CASCADE;
DROP TYPE IF EXISTS public.exam_type CASCADE;
DROP TYPE IF EXISTS public.fee_payment_method CASCADE;
DROP TYPE IF EXISTS public.fee_payment_status CASCADE;
DROP TYPE IF EXISTS public.student_status CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- ======================================================================
-- 1. Extensions
-- ======================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ======================================================================
-- 2. Types
-- ======================================================================

CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE public.cbc_pathway AS ENUM ('STEM', 'SOCIAL_SCIENCES', 'ARTS_SPORTS');
CREATE TYPE public.exam_term AS ENUM ('mid_term', 'end_term', 'annual');
CREATE TYPE public.exam_type AS ENUM ('CBC', '844', 'MIDTERM', 'ENDTERM', 'OPENER', 'CAT', 'TOPICAL', 'ZONE', 'SUB_COUNTY', 'COUNTY', 'REGIONAL', 'PRE_MOCK', 'MOCK', 'POST_MOCK', 'NATIONAL');
CREATE TYPE public.fee_payment_method AS ENUM ('MPESA', 'CASH', 'BANK', 'CHEQUE', 'OTHER', 'PESAPAL');
CREATE TYPE public.fee_payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE public.student_status AS ENUM ('ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DEACTIVATED');
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT', 'PENDING', 'STAFF', 'PARENT');

-- ======================================================================
-- 3. Sequences
-- ======================================================================

CREATE SEQUENCE public.fee_receipt_number_seq AS bigint START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;
CREATE SEQUENCE public.subjects_merge_audit_id_seq AS bigint START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1;

-- ======================================================================
-- 4. Functions used by column defaults
-- ======================================================================

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT 'RCT-' || LPAD(nextval('fee_receipt_number_seq')::text, 6, '0');
$function$;

-- ======================================================================
-- 5. Tables
-- ======================================================================

CREATE TABLE public.academic_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT academic_levels_pkey PRIMARY KEY (id),
    CONSTRAINT academic_levels_code_key UNIQUE (code)
);

CREATE TABLE public.academic_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid,
    CONSTRAINT academic_years_pkey PRIMARY KEY (id),
    CONSTRAINT academic_years_school_id_name_key UNIQUE (school_id, name)
);

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    posted_by text,
    is_important boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

CREATE TABLE public.assignment_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    student_id text NOT NULL,
    file_url text,
    submission_text text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    grade numeric(5,2),
    feedback text,
    graded_by text,
    graded_at timestamp with time zone,
    CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id),
    CONSTRAINT assignment_submissions_assignment_id_student_id_key UNIQUE (assignment_id, student_id)
);

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    grade_stream_id uuid,
    title text NOT NULL,
    description text,
    due_date date NOT NULL,
    file_url text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assignments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.attendance_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    school_id uuid NOT NULL,
    date date NOT NULL,
    channel text DEFAULT 'sms'::text NOT NULL,
    status text NOT NULL,
    error text,
    sent_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_notifications_pkey PRIMARY KEY (id),
    CONSTRAINT attendance_notifications_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])))
);

CREATE TABLE public.audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    school_id uuid NOT NULL,
    actor_id text,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.class_teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    current_grade_stream_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT class_teachers_pkey PRIMARY KEY (id),
    CONSTRAINT class_teachers_current_grade_stream_id_academic_year_id_key UNIQUE (current_grade_stream_id, academic_year_id),
    CONSTRAINT class_teachers_user_id_academic_year_id_key UNIQUE (user_id, academic_year_id)
);

CREATE TABLE public.classes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    academic_year text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT classes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.clinic_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    visited_at timestamp with time zone DEFAULT now() NOT NULL,
    complaint text NOT NULL,
    temperature_c numeric(4,1),
    diagnosis text,
    treatment text,
    outcome text DEFAULT 'RETURNED_TO_CLASS'::text NOT NULL,
    referred_to text,
    parent_notified boolean DEFAULT false NOT NULL,
    discharged_at timestamp with time zone,
    attended_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinic_visits_pkey PRIMARY KEY (id),
    CONSTRAINT clinic_visits_outcome_check CHECK ((outcome = ANY (ARRAY['RETURNED_TO_CLASS'::text, 'SICK_BAY'::text, 'SENT_HOME'::text, 'REFERRED'::text]))),
    CONSTRAINT clinic_visits_temperature_c_check CHECK (((temperature_c IS NULL) OR ((temperature_c >= (30)::numeric) AND (temperature_c <= (45)::numeric))))
);

CREATE TABLE public.competency_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    subject_id uuid NOT NULL,
    term_id uuid NOT NULL,
    strand text NOT NULL,
    sub_strand text DEFAULT ''::text NOT NULL,
    level text NOT NULL,
    comment text,
    assessed_by text,
    assessed_on date DEFAULT CURRENT_DATE NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT competency_assessments_pkey PRIMARY KEY (id),
    CONSTRAINT competency_assessments_student_id_subject_id_term_id_strand_key UNIQUE (student_id, subject_id, term_id, strand, sub_strand),
    CONSTRAINT competency_assessments_level_check CHECK ((level = ANY (ARRAY['EE'::text, 'ME'::text, 'AE'::text, 'BE'::text])))
);

CREATE TABLE public.daily_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    date date NOT NULL,
    status text DEFAULT 'present'::text NOT NULL,
    marked_by text,
    school_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_attendance_pkey PRIMARY KEY (id),
    CONSTRAINT daily_attendance_student_id_date_key UNIQUE (student_id, date),
    CONSTRAINT daily_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text])))
);

CREATE TABLE public.discipline_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    occurred_on date DEFAULT CURRENT_DATE NOT NULL,
    category text NOT NULL,
    severity text DEFAULT 'MINOR'::text NOT NULL,
    description text NOT NULL,
    action_taken text DEFAULT 'NONE'::text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    parent_notified boolean DEFAULT false NOT NULL,
    reported_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discipline_incidents_pkey PRIMARY KEY (id),
    CONSTRAINT discipline_incidents_action_taken_check CHECK ((action_taken = ANY (ARRAY['NONE'::text, 'WARNING'::text, 'COUNSELLING'::text, 'PUNISHMENT'::text, 'PARENT_CALLED'::text, 'SUSPENSION'::text, 'EXPULSION'::text]))),
    CONSTRAINT discipline_incidents_category_check CHECK ((category = ANY (ARRAY['LATENESS'::text, 'TRUANCY'::text, 'FIGHTING'::text, 'BULLYING'::text, 'CHEATING'::text, 'INSUBORDINATION'::text, 'PROPERTY_DAMAGE'::text, 'SUBSTANCE'::text, 'UNIFORM'::text, 'OTHER'::text]))),
    CONSTRAINT discipline_incidents_severity_check CHECK ((severity = ANY (ARRAY['MINOR'::text, 'MAJOR'::text, 'CRITICAL'::text]))),
    CONSTRAINT discipline_incidents_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'RESOLVED'::text])))
);

CREATE TABLE public.dorm_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    dorm_id uuid NOT NULL,
    student_id text NOT NULL,
    bed_label text,
    allocated_on date DEFAULT CURRENT_DATE NOT NULL,
    ended_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dorm_allocations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.dorm_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    dorm_id uuid NOT NULL,
    inspected_on date DEFAULT CURRENT_DATE NOT NULL,
    score smallint NOT NULL,
    remarks text,
    inspected_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dorm_inspections_pkey PRIMARY KEY (id),
    CONSTRAINT dorm_inspections_score_check CHECK (((score >= 0) AND (score <= 100)))
);

CREATE TABLE public.dorms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    house text,
    gender text DEFAULT 'MIXED'::text NOT NULL,
    capacity integer DEFAULT 0 NOT NULL,
    patron_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dorms_pkey PRIMARY KEY (id),
    CONSTRAINT dorms_school_id_name_key UNIQUE (school_id, name),
    CONSTRAINT dorms_capacity_check CHECK ((capacity >= 0)),
    CONSTRAINT dorms_gender_check CHECK ((gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text, 'MIXED'::text])))
);

CREATE TABLE public.exam_mark_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    subject_id uuid,
    student_id text NOT NULL,
    component_id uuid NOT NULL,
    raw_score numeric(6,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_mark_components_pkey PRIMARY KEY (id),
    CONSTRAINT exam_mark_components_component_id_student_id_key UNIQUE (component_id, student_id),
    CONSTRAINT exam_mark_components_raw_score_check CHECK ((raw_score >= (0)::numeric))
);

CREATE TABLE public.exam_mark_history (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    exam_id uuid NOT NULL,
    student_id text NOT NULL,
    action text NOT NULL,
    old_score numeric,
    new_score numeric,
    old_grade text,
    new_grade text,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_mark_history_pkey PRIMARY KEY (id),
    CONSTRAINT exam_mark_history_action_check CHECK ((action = ANY (ARRAY['entered'::text, 'changed'::text, 'removed'::text])))
);

CREATE TABLE public.exam_marking_requests (
    school_id uuid NOT NULL,
    term_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    requested_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_marking_requests_pkey PRIMARY KEY (school_id, term_id, grade_id, requested_by)
);

CREATE TABLE public.exam_marking_windows (
    school_id uuid NOT NULL,
    term_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    exam_type text NOT NULL,
    set_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_marking_windows_pkey PRIMARY KEY (school_id, term_id, grade_id)
);

CREATE TABLE public.exam_marks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    student_id text NOT NULL,
    raw_score numeric(5,2) NOT NULL,
    percentage numeric(5,2) NOT NULL,
    grade_symbol text,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rubric character varying(50),
    updated_by text,
    CONSTRAINT exam_marks_pkey PRIMARY KEY (id),
    CONSTRAINT exam_marks_exam_id_student_id_key UNIQUE (exam_id, student_id)
);

CREATE TABLE public.exam_paper_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    paper_id uuid NOT NULL,
    reviewer_id text,
    action text NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_paper_reviews_pkey PRIMARY KEY (id),
    CONSTRAINT exam_paper_reviews_action_check CHECK ((action = ANY (ARRAY['SUBMIT'::text, 'APPROVE'::text, 'RETURN'::text, 'LOCK'::text, 'RELEASE'::text, 'COMMENT'::text])))
);

CREATE TABLE public.exam_papers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    title text NOT NULL,
    subject_id uuid NOT NULL,
    grade_id uuid,
    exam_id uuid,
    term_id uuid,
    paper_label text,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    paper_path text,
    scheme_path text,
    copies_needed integer DEFAULT 0 NOT NULL,
    print_status text DEFAULT 'PENDING'::text NOT NULL,
    release_at timestamp with time zone,
    uploaded_by text,
    moderated_by text,
    moderated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_papers_pkey PRIMARY KEY (id),
    CONSTRAINT exam_papers_copies_needed_check CHECK ((copies_needed >= 0)),
    CONSTRAINT exam_papers_print_status_check CHECK ((print_status = ANY (ARRAY['PENDING'::text, 'PRINTED'::text, 'PACKED'::text]))),
    CONSTRAINT exam_papers_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'RETURNED'::text, 'APPROVED'::text, 'LOCKED'::text, 'RELEASED'::text])))
);

CREATE TABLE public.exam_subject_component_schemes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    school_id uuid,
    assessment_mode text DEFAULT 'single_paper'::text NOT NULL,
    aggregation_method text DEFAULT 'sum_then_percentage'::text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_subject_component_schemes_pkey PRIMARY KEY (id),
    CONSTRAINT exam_subject_component_schemes_exam_id_key UNIQUE (exam_id),
    CONSTRAINT exam_subject_component_schemes_aggregation_method_check CHECK ((aggregation_method = ANY (ARRAY['sum_then_percentage'::text, 'languages_average_percentages'::text, 'science_70_plus_practical'::text]))),
    CONSTRAINT exam_subject_component_schemes_assessment_mode_check CHECK ((assessment_mode = ANY (ARRAY['single_paper'::text, 'multi_paper'::text])))
);

CREATE TABLE public.exam_subject_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scheme_id uuid NOT NULL,
    component_code text NOT NULL,
    component_name text NOT NULL,
    max_score numeric(6,2) NOT NULL,
    weight numeric(5,2),
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_subject_components_pkey PRIMARY KEY (id),
    CONSTRAINT exam_subject_components_scheme_id_component_code_key UNIQUE (scheme_id, component_code),
    CONSTRAINT exam_subject_components_max_score_check CHECK ((max_score > (0)::numeric))
);

CREATE TABLE public.exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    exam_type text NOT NULL,
    academic_year_id uuid NOT NULL,
    term_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    grade_stream_id uuid,
    created_by_teacher_id text,
    school_id uuid,
    max_score numeric(5,2) DEFAULT 100.00 NOT NULL,
    exam_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    published_by text,
    published_at timestamp with time zone,
    approved_by text,
    approved_at timestamp with time zone,
    CONSTRAINT exams_pkey PRIMARY KEY (id),
    CONSTRAINT exams_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING_APPROVAL'::text, 'APPROVED'::text])))
);

CREATE TABLE public.exeats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    exeat_type text DEFAULT 'WEEKEND'::text NOT NULL,
    leave_at timestamp with time zone NOT NULL,
    return_by timestamp with time zone NOT NULL,
    reason text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    pass_code text,
    requested_by text,
    decided_by text,
    left_at timestamp with time zone,
    returned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exeats_pkey PRIMARY KEY (id),
    CONSTRAINT exeats_check CHECK ((return_by > leave_at)),
    CONSTRAINT exeats_exeat_type_check CHECK ((exeat_type = ANY (ARRAY['WEEKEND'::text, 'MEDICAL'::text, 'FAMILY'::text, 'OFFICIAL'::text, 'OTHER'::text]))),
    CONSTRAINT exeats_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'OUT'::text, 'RETURNED'::text])))
);

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    supplier_id uuid,
    vote_head_id uuid,
    payment_method text,
    reference text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    requested_by text,
    decided_by text,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expenses_pkey PRIMARY KEY (id),
    CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT expenses_payment_method_check CHECK ((payment_method = ANY (ARRAY['CASH'::text, 'BANK'::text, 'MPESA'::text, 'CHEQUE'::text]))),
    CONSTRAINT expenses_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'PAID'::text])))
);

CREATE TABLE public.fee_awards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    term_id uuid NOT NULL,
    kind text DEFAULT 'BURSARY'::text NOT NULL,
    sponsor text,
    amount numeric(12,2) NOT NULL,
    reference text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_awards_pkey PRIMARY KEY (id),
    CONSTRAINT fee_awards_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT fee_awards_kind_check CHECK ((kind = ANY (ARRAY['BURSARY'::text, 'SCHOLARSHIP'::text, 'WAIVER'::text, 'DISCOUNT'::text])))
);

CREATE TABLE public.fee_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_fee_id uuid,
    receipt_number text DEFAULT generate_receipt_number() NOT NULL,
    amount numeric(12,2) NOT NULL,
    method fee_payment_method DEFAULT 'CASH'::fee_payment_method NOT NULL,
    status fee_payment_status DEFAULT 'COMPLETED'::fee_payment_status NOT NULL,
    phone_number text,
    payer_name text,
    mpesa_receipt_number text,
    mpesa_checkout_request_id text,
    mpesa_merchant_request_id text,
    unmatched_account_reference text,
    notes text,
    recorded_by text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pesapal_order_tracking_id text,
    pesapal_merchant_reference text,
    pesapal_confirmation_code text,
    pesapal_payment_method text,
    CONSTRAINT fee_payments_pkey PRIMARY KEY (id),
    CONSTRAINT fee_payments_receipt_number_key UNIQUE (receipt_number),
    CONSTRAINT fee_payments_check CHECK (((student_fee_id IS NOT NULL) OR (unmatched_account_reference IS NOT NULL)))
);

CREATE TABLE public.fee_structure_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    structure_id uuid NOT NULL,
    vote_head_id uuid NOT NULL,
    annual_amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_structure_items_pkey PRIMARY KEY (id),
    CONSTRAINT fee_structure_items_structure_id_vote_head_id_key UNIQUE (structure_id, vote_head_id),
    CONSTRAINT fee_structure_items_annual_amount_check CHECK ((annual_amount >= (0)::numeric))
);

CREATE TABLE public.fee_structures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    academic_year_id uuid NOT NULL,
    grade_id uuid,
    residence text DEFAULT 'ALL'::text NOT NULL,
    term_split numeric[] DEFAULT '{50,30,20}'::numeric[] NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_structures_pkey PRIMARY KEY (id),
    CONSTRAINT fee_structures_residence_check CHECK ((residence = ANY (ARRAY['ALL'::text, 'DAY'::text, 'BOARDER'::text])))
);

CREATE TABLE public.grade_streams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grade_id uuid NOT NULL,
    name text NOT NULL,
    full_name text NOT NULL,
    school_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grade_streams_pkey PRIMARY KEY (id),
    CONSTRAINT grade_streams_school_id_grade_id_name_key UNIQUE (school_id, grade_id, name)
);

CREATE TABLE public.grades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_level_id uuid NOT NULL,
    code text NOT NULL,
    name_display text NOT NULL,
    numeric_order integer NOT NULL,
    is_exam_class boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grades_pkey PRIMARY KEY (id),
    CONSTRAINT grades_academic_level_id_code_key UNIQUE (academic_level_id, code)
);

CREATE TABLE public.grading_scales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    grading_system_id uuid NOT NULL,
    min_percentage numeric(5,2) NOT NULL,
    max_percentage numeric(5,2) NOT NULL,
    symbol text NOT NULL,
    label text NOT NULL,
    points integer,
    order_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT grading_scales_pkey PRIMARY KEY (id)
);

CREATE TABLE public.grading_systems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_level_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid,
    system_kind text DEFAULT 'SUBJECT'::text NOT NULL,
    CONSTRAINT grading_systems_pkey PRIMARY KEY (id),
    CONSTRAINT grading_systems_system_kind_check CHECK ((system_kind = ANY (ARRAY['SUBJECT'::text, 'OVERALL'::text])))
);

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    item_type text DEFAULT 'CONSUMABLE'::text NOT NULL,
    category text,
    unit text DEFAULT 'pcs'::text NOT NULL,
    quantity numeric(12,2) DEFAULT 0 NOT NULL,
    reorder_level numeric(12,2) DEFAULT 0 NOT NULL,
    location text,
    serial_number text,
    unit_value numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
    CONSTRAINT inventory_items_item_type_check CHECK ((item_type = ANY (ARRAY['ASSET'::text, 'CONSUMABLE'::text]))),
    CONSTRAINT inventory_items_quantity_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT inventory_items_reorder_level_check CHECK ((reorder_level >= (0)::numeric))
);

CREATE TABLE public.invite_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(6) NOT NULL,
    user_id text NOT NULL,
    school_id uuid NOT NULL,
    role character varying(30) NOT NULL,
    is_used boolean DEFAULT false,
    used_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invite_codes_pkey PRIMARY KEY (id),
    CONSTRAINT invite_codes_code_key UNIQUE (code)
);

CREATE TABLE public.invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    vote_head_id uuid,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    CONSTRAINT invoice_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    term_id uuid NOT NULL,
    structure_id uuid,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_pkey PRIMARY KEY (id),
    CONSTRAINT invoices_student_id_term_id_key UNIQUE (student_id, term_id)
);

CREATE TABLE public.learning_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    grade_stream_id uuid,
    title text NOT NULL,
    description text,
    file_url text,
    file_size_bytes bigint,
    file_type text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learning_materials_pkey PRIMARY KEY (id)
);

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    staff_id text NOT NULL,
    leave_type text DEFAULT 'ANNUAL'::text NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    reason text,
    cover_notes text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
    CONSTRAINT leave_requests_check CHECK ((ends_on >= starts_on)),
    CONSTRAINT leave_requests_leave_type_check CHECK ((leave_type = ANY (ARRAY['ANNUAL'::text, 'SICK'::text, 'MATERNITY'::text, 'PATERNITY'::text, 'COMPASSIONATE'::text, 'STUDY'::text, 'OTHER'::text]))),
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'CANCELLED'::text])))
);

CREATE TABLE public.lesson_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    teacher_id text NOT NULL,
    scheme_entry_id uuid,
    subject_id uuid NOT NULL,
    grade_stream_id uuid NOT NULL,
    lesson_date date NOT NULL,
    topic text NOT NULL,
    objectives text,
    introduction text,
    development text,
    conclusion text,
    resources text,
    reflection text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_plans_pkey PRIMARY KEY (id)
);

CREATE TABLE public.library_books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    title text NOT NULL,
    author text,
    isbn text,
    category text,
    shelf text,
    copies_total integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_books_pkey PRIMARY KEY (id),
    CONSTRAINT library_books_copies_total_check CHECK ((copies_total >= 0))
);

CREATE TABLE public.library_loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    book_id uuid NOT NULL,
    borrower_id text NOT NULL,
    issued_on date DEFAULT CURRENT_DATE NOT NULL,
    due_on date NOT NULL,
    returned_on date,
    fine_amount numeric(10,2) DEFAULT 0 NOT NULL,
    issued_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_loans_pkey PRIMARY KEY (id),
    CONSTRAINT library_loans_check CHECK ((due_on >= issued_on)),
    CONSTRAINT library_loans_fine_amount_check CHECK ((fine_amount >= (0)::numeric))
);

CREATE TABLE public.marks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    student_id text NOT NULL,
    subject_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    teacher_id uuid,
    score numeric(5,2) NOT NULL,
    total_possible numeric(5,2) DEFAULT 100.00 NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT marks_pkey PRIMARY KEY (id),
    CONSTRAINT marks_student_id_subject_id_exam_id_key UNIQUE (student_id, subject_id, exam_id),
    CONSTRAINT marks_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))
);

CREATE TABLE public.medical_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    blood_group text,
    allergies text,
    conditions text,
    regular_medication text,
    sha_number text,
    doctor_name text,
    doctor_phone text,
    emergency_contact text,
    emergency_phone text,
    consent_on_file boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT medical_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT medical_profiles_student_id_key UNIQUE (student_id),
    CONSTRAINT medical_profiles_blood_group_check CHECK ((blood_group = ANY (ARRAY['A+'::text, 'A-'::text, 'B+'::text, 'B-'::text, 'AB+'::text, 'AB-'::text, 'O+'::text, 'O-'::text])))
);

CREATE TABLE public.medication_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    stock_id uuid,
    medicine text NOT NULL,
    dose text,
    quantity integer DEFAULT 1 NOT NULL,
    given_at timestamp with time zone DEFAULT now() NOT NULL,
    given_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT medication_logs_pkey PRIMARY KEY (id),
    CONSTRAINT medication_logs_quantity_check CHECK ((quantity >= 0))
);

CREATE TABLE public.medicine_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'tablet'::text NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 0 NOT NULL,
    batch text,
    expiry_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT medicine_stock_pkey PRIMARY KEY (id),
    CONSTRAINT medicine_stock_quantity_check CHECK ((quantity >= 0)),
    CONSTRAINT medicine_stock_reorder_level_check CHECK ((reorder_level >= 0))
);

CREATE TABLE public.pending_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text NOT NULL,
    school_id uuid NOT NULL,
    invite_code text NOT NULL,
    admission_number text,
    grade_stream_id uuid,
    academic_level_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    CONSTRAINT pending_invites_pkey PRIMARY KEY (id)
);

CREATE TABLE public.performance_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    academic_year_id uuid NOT NULL,
    term_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    average_percentage numeric(5,2),
    position_in_subject integer,
    trend_vs_previous_term numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT performance_history_pkey PRIMARY KEY (id),
    CONSTRAINT performance_history_student_id_academic_year_id_term_id_sub_key UNIQUE (student_id, academic_year_id, term_id, subject_id)
);

CREATE TABLE public.rate_limit_hits (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    hits integer NOT NULL,
    CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (key)
);

CREATE TABLE public.records_of_work (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    teacher_id text NOT NULL,
    scheme_entry_id uuid,
    subject_id uuid NOT NULL,
    grade_stream_id uuid NOT NULL,
    lesson_date date DEFAULT CURRENT_DATE NOT NULL,
    work_covered text NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT records_of_work_pkey PRIMARY KEY (id)
);

CREATE TABLE public.report_card_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_card_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    exam_ids_used jsonb,
    total_score numeric(5,2),
    total_max_score numeric(5,2),
    percentage numeric(5,2),
    grade_symbol text,
    teacher_comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT report_card_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT report_card_subjects_report_card_id_subject_id_key UNIQUE (report_card_id, subject_id)
);

CREATE TABLE public.report_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    academic_year_id uuid NOT NULL,
    term_id uuid NOT NULL,
    grade_stream_id uuid NOT NULL,
    class_teacher_id text,
    overall_average numeric(5,2),
    overall_position integer,
    comments_class_teacher text,
    comments_principal text,
    behaviour_summary text,
    attendance_present integer,
    attendance_total integer,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_by_user_id text,
    CONSTRAINT report_cards_pkey PRIMARY KEY (id),
    CONSTRAINT report_cards_student_id_academic_year_id_term_id_key UNIQUE (student_id, academic_year_id, term_id)
);

CREATE TABLE public.roll_call_entries (
    roll_call_id uuid NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    status text NOT NULL,
    CONSTRAINT roll_call_entries_pkey PRIMARY KEY (roll_call_id, student_id),
    CONSTRAINT roll_call_entries_status_check CHECK ((status = ANY (ARRAY['PRESENT'::text, 'ABSENT'::text, 'LATE'::text, 'EXEAT'::text, 'SICK_BAY'::text])))
);

CREATE TABLE public.roll_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    dorm_id uuid NOT NULL,
    session text NOT NULL,
    taken_on date NOT NULL,
    taken_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT roll_calls_pkey PRIMARY KEY (id),
    CONSTRAINT roll_calls_dorm_id_session_taken_on_key UNIQUE (dorm_id, session, taken_on),
    CONSTRAINT roll_calls_session_check CHECK ((session = ANY (ARRAY['MORNING'::text, 'EVENING'::text, 'NIGHT'::text])))
);

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    room_type text DEFAULT 'CLASSROOM'::text NOT NULL,
    capacity integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rooms_pkey PRIMARY KEY (id),
    CONSTRAINT rooms_school_id_name_key UNIQUE (school_id, name),
    CONSTRAINT rooms_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
    CONSTRAINT rooms_room_type_check CHECK ((room_type = ANY (ARRAY['CLASSROOM'::text, 'LAB'::text, 'COMPUTER'::text, 'HALL'::text, 'FIELD'::text, 'OTHER'::text])))
);

CREATE TABLE public.route_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    route_id uuid NOT NULL,
    name text NOT NULL,
    sequence smallint DEFAULT 1 NOT NULL,
    pickup_time time without time zone,
    dropoff_time time without time zone,
    lat double precision,
    lng double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT route_stops_pkey PRIMARY KEY (id),
    CONSTRAINT route_stops_lat_check CHECK (((lat IS NULL) OR ((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)))),
    CONSTRAINT route_stops_lng_check CHECK (((lng IS NULL) OR ((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision))))
);

CREATE TABLE public.scheme_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    scheme_id uuid NOT NULL,
    week smallint NOT NULL,
    lesson smallint DEFAULT 1 NOT NULL,
    topic text NOT NULL,
    sub_topic text,
    objectives text,
    activities text,
    resources text,
    assessment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheme_entries_pkey PRIMARY KEY (id),
    CONSTRAINT scheme_entries_scheme_id_week_lesson_key UNIQUE (scheme_id, week, lesson),
    CONSTRAINT scheme_entries_lesson_check CHECK (((lesson >= 1) AND (lesson <= 20))),
    CONSTRAINT scheme_entries_week_check CHECK (((week >= 1) AND (week <= 20)))
);

CREATE TABLE public.schemes_of_work (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    teacher_id text NOT NULL,
    subject_id uuid NOT NULL,
    grade_stream_id uuid NOT NULL,
    term_id uuid,
    title text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    review_comment text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schemes_of_work_pkey PRIMARY KEY (id),
    CONSTRAINT schemes_of_work_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'APPROVED'::text, 'RETURNED'::text])))
);

CREATE TABLE public.school_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    bank_name text NOT NULL,
    account_name text NOT NULL,
    account_number text NOT NULL,
    branch text,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_bank_accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.school_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    title text NOT NULL,
    event_type text DEFAULT 'OTHER'::text NOT NULL,
    audience text DEFAULT 'ALL'::text NOT NULL,
    starts_on date NOT NULL,
    ends_on date,
    exam_id uuid,
    description text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_events_pkey PRIMARY KEY (id),
    CONSTRAINT school_events_audience_check CHECK ((audience = ANY (ARRAY['ALL'::text, 'STAFF'::text, 'STUDENTS'::text, 'PARENTS'::text]))),
    CONSTRAINT school_events_check CHECK (((ends_on IS NULL) OR (ends_on >= starts_on))),
    CONSTRAINT school_events_event_type_check CHECK ((event_type = ANY (ARRAY['EXAM'::text, 'CAT'::text, 'MARKS_DEADLINE'::text, 'REPORT_RELEASE'::text, 'MEETING'::text, 'HOLIDAY'::text, 'SPORTS'::text, 'OPENING'::text, 'CLOSING'::text, 'OTHER'::text])))
);

CREATE TABLE public.school_modules (
    school_id uuid NOT NULL,
    module_key text NOT NULL,
    entitled boolean DEFAULT true NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT school_modules_pkey PRIMARY KEY (school_id, module_key)
);

CREATE TABLE public.school_payment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    environment text DEFAULT 'sandbox'::text NOT NULL,
    shortcode text,
    passkey text,
    consumer_key text,
    consumer_secret text,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    active_provider text DEFAULT 'NONE'::text NOT NULL,
    pesapal_environment text DEFAULT 'sandbox'::text NOT NULL,
    pesapal_consumer_key text,
    pesapal_consumer_secret text,
    pesapal_ipn_id text,
    bank_enabled boolean DEFAULT false NOT NULL,
    webhook_token text,
    CONSTRAINT school_payment_settings_pkey PRIMARY KEY (id),
    CONSTRAINT school_payment_settings_school_id_key UNIQUE (school_id),
    CONSTRAINT school_payment_settings_active_provider_check CHECK ((active_provider = ANY (ARRAY['NONE'::text, 'DARAJA'::text, 'PESAPAL'::text]))),
    CONSTRAINT school_payment_settings_environment_check CHECK ((environment = ANY (ARRAY['sandbox'::text, 'production'::text]))),
    CONSTRAINT school_payment_settings_pesapal_environment_check CHECK ((pesapal_environment = ANY (ARRAY['sandbox'::text, 'live'::text])))
);

CREATE TABLE public.school_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    bands text[] DEFAULT '{}'::text[] NOT NULL,
    head_title text DEFAULT 'Principal'::text NOT NULL,
    head_name text,
    head_signature text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_sections_pkey PRIMARY KEY (id),
    CONSTRAINT school_sections_bands_check CHECK ((bands <@ ARRAY['CBC_PRE_PRIMARY'::text, 'CBC_LOWER_PRIMARY'::text, 'CBC_UPPER_PRIMARY'::text, 'CBC_JUNIOR_SCHOOL'::text, 'CBC_SENIOR_SCHOOL'::text, '844_PRIMARY'::text, '844_SECONDARY'::text])),
    CONSTRAINT school_sections_head_name_check CHECK (((head_name IS NULL) OR (length(head_name) <= 100))),
    CONSTRAINT school_sections_head_signature_check CHECK (((head_signature IS NULL) OR ((head_signature ~~ 'data:image/png;base64,%'::text) AND (length(head_signature) <= 400000)))),
    CONSTRAINT school_sections_head_title_check CHECK (((length(btrim(head_title)) >= 1) AND (length(btrim(head_title)) <= 40))),
    CONSTRAINT school_sections_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)))
);

CREATE TABLE public.school_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    grading_system_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT school_subjects_school_id_subject_id_key UNIQUE (school_id, subject_id)
);

CREATE TABLE public.schools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    logo_url text,
    address text,
    phone text,
    email text,
    grading_system_cbc_id uuid,
    grading_system_844_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    teacher_invite_code character varying(20),
    student_invite_code character varying(20),
    min_combination_group_size integer DEFAULT 15 NOT NULL,
    overall_grading_system_id uuid,
    approval_status text DEFAULT 'PENDING_APPROVAL'::text NOT NULL,
    approval_requested_at timestamp with time zone,
    approval_decided_at timestamp with time zone,
    approval_note text,
    approval_token text,
    requested_by text,
    cbc_ranking_enabled boolean DEFAULT false NOT NULL,
    senior_rank_group text DEFAULT 'GRADE'::text NOT NULL,
    motto text,
    principal_name text,
    principal_signature_url text,
    pass_mark numeric DEFAULT 50 NOT NULL,
    CONSTRAINT schools_pkey PRIMARY KEY (id),
    CONSTRAINT schools_student_code_unique UNIQUE (student_invite_code),
    CONSTRAINT schools_teacher_code_unique UNIQUE (teacher_invite_code),
    CONSTRAINT schools_approval_status_check CHECK ((approval_status = ANY (ARRAY['PENDING_APPROVAL'::text, 'APPROVED'::text, 'REJECTED'::text]))),
    CONSTRAINT schools_pass_mark_range CHECK (((pass_mark >= (1)::numeric) AND (pass_mark <= (100)::numeric))),
    CONSTRAINT schools_senior_rank_group_check CHECK ((senior_rank_group = ANY (ARRAY['GRADE'::text, 'PATHWAY'::text, 'COMBINATION'::text])))
);

CREATE TABLE public.store_requisitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    item_id uuid NOT NULL,
    quantity numeric(12,2) NOT NULL,
    purpose text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    requested_by text,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT store_requisitions_pkey PRIMARY KEY (id),
    CONSTRAINT store_requisitions_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT store_requisitions_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'ISSUED'::text])))
);

CREATE TABLE public.student_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    term_id uuid NOT NULL,
    total_fee numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    due_date date,
    status text DEFAULT 'PENDING'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_fees_pkey PRIMARY KEY (id),
    CONSTRAINT student_fees_student_id_term_id_key UNIQUE (student_id, term_id),
    CONSTRAINT student_fees_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'PARTIAL'::text, 'PAID'::text, 'OVERPAID'::text])))
);

CREATE TABLE public.student_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    subject_id uuid,
    title text NOT NULL,
    target_value numeric(5,2),
    deadline date,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_goals_pkey PRIMARY KEY (id)
);

CREATE TABLE public.student_guardians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    parent_user_id text NOT NULL,
    relationship text DEFAULT 'GUARDIAN'::text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_guardians_pkey PRIMARY KEY (id),
    CONSTRAINT student_guardians_student_id_parent_user_id_key UNIQUE (student_id, parent_user_id),
    CONSTRAINT student_guardians_relationship_check CHECK ((relationship = ANY (ARRAY['MOTHER'::text, 'FATHER'::text, 'GUARDIAN'::text, 'SPONSOR'::text, 'OTHER'::text])))
);

CREATE TABLE public.student_promotion_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    run_by text,
    promoted integer DEFAULT 0 NOT NULL,
    repeated integer DEFAULT 0 NOT NULL,
    graduated integer DEFAULT 0 NOT NULL,
    transferred integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    undone_at timestamp with time zone,
    undone_by text,
    CONSTRAINT student_promotion_runs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.student_promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    outcome text NOT NULL,
    from_stream_id uuid NOT NULL,
    to_stream_id uuid,
    previous_status student_status NOT NULL,
    new_status student_status NOT NULL,
    CONSTRAINT student_promotions_pkey PRIMARY KEY (id),
    CONSTRAINT student_promotions_run_id_student_id_key UNIQUE (run_id, student_id),
    CONSTRAINT student_promotions_check CHECK (((outcome = 'PROMOTE'::text) = (to_stream_id IS NOT NULL))),
    CONSTRAINT student_promotions_outcome_check CHECK ((outcome = ANY (ARRAY['PROMOTE'::text, 'REPEAT'::text, 'GRADUATE'::text, 'TRANSFER'::text])))
);

CREATE TABLE public.student_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    subject_id uuid NOT NULL,
    role text DEFAULT 'ELECTIVE'::text NOT NULL,
    school_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT student_subjects_student_id_subject_id_key UNIQUE (student_id, subject_id),
    CONSTRAINT student_subjects_role_check CHECK ((role = ANY (ARRAY['CORE'::text, 'ELECTIVE'::text])))
);

CREATE TABLE public.student_transport (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id text NOT NULL,
    route_id uuid NOT NULL,
    stop_id uuid,
    direction text DEFAULT 'BOTH'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_transport_pkey PRIMARY KEY (id),
    CONSTRAINT student_transport_student_id_key UNIQUE (student_id),
    CONSTRAINT student_transport_direction_check CHECK ((direction = ANY (ARRAY['BOTH'::text, 'MORNING'::text, 'EVENING'::text])))
);

CREATE TABLE public.students (
    id text NOT NULL,
    admission_number text,
    current_grade_stream_id uuid NOT NULL,
    academic_level_id uuid NOT NULL,
    date_of_birth date,
    gender text,
    guardian_name text,
    guardian_phone text,
    guardian_email text,
    date_enrolled date DEFAULT CURRENT_DATE,
    status student_status DEFAULT 'ACTIVE'::student_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    pathway cbc_pathway,
    track text,
    subject_combination_id uuid,
    portal_token text DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text) NOT NULL,
    school_id uuid NOT NULL,
    residence text DEFAULT 'DAY'::text NOT NULL,
    CONSTRAINT students_pkey PRIMARY KEY (id),
    CONSTRAINT students_school_id_admission_number_key UNIQUE (school_id, admission_number),
    CONSTRAINT students_residence_check CHECK ((residence = ANY (ARRAY['DAY'::text, 'BOARDER'::text])))
);

CREATE TABLE public.subject_combination_subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    combination_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subject_combination_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT subject_combination_subjects_combination_id_subject_id_key UNIQUE (combination_id, subject_id)
);

CREATE TABLE public.subject_combinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    pathway cbc_pathway NOT NULL,
    track text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subject_combinations_pkey PRIMARY KEY (id),
    CONSTRAINT subject_combinations_school_id_code_key UNIQUE (school_id, code)
);

CREATE TABLE public.subject_teacher_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_teacher_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    grade_stream_id uuid,
    academic_year_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subject_teacher_assignments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.subject_teachers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subject_teachers_pkey PRIMARY KEY (id),
    CONSTRAINT subject_teachers_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.subjects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    academic_level_id uuid NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'OTHER'::text,
    subject_type text DEFAULT 'CORE'::text NOT NULL,
    band text,
    origin_school_id uuid,
    CONSTRAINT subjects_pkey PRIMARY KEY (id),
    CONSTRAINT subjects_band_check CHECK (((band IS NULL) OR (band = ANY (ARRAY['PP'::text, 'LP'::text, 'UP'::text, 'JS'::text, 'SS'::text, 'SEC'::text]))))
);

CREATE TABLE public.subjects_merge_audit (
    id bigint DEFAULT nextval('subjects_merge_audit_id_seq'::regclass) NOT NULL,
    merged_at timestamp with time zone DEFAULT now() NOT NULL,
    code text NOT NULL,
    loser_id uuid NOT NULL,
    winner_id uuid NOT NULL,
    table_name text NOT NULL,
    row_id text,
    loser_name text,
    loser_school uuid,
    CONSTRAINT subjects_merge_audit_pkey PRIMARY KEY (id)
);

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    kra_pin text,
    category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suppliers_pkey PRIMARY KEY (id),
    CONSTRAINT suppliers_school_id_name_key UNIQUE (school_id, name)
);

CREATE TABLE public.terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year_id uuid NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    school_id uuid,
    midterm_reopening_date date,
    reopening_date date,
    midterm_closing_date date,
    marks_locked_at timestamp with time zone,
    marks_locked_by text,
    CONSTRAINT terms_pkey PRIMARY KEY (id),
    CONSTRAINT terms_academic_year_id_name_key UNIQUE (academic_year_id, name)
);

CREATE TABLE public.timetable_configs (
    school_id uuid NOT NULL,
    days smallint[] DEFAULT '{1,2,3,4,5}'::smallint[] NOT NULL,
    periods jsonb DEFAULT '[]'::jsonb NOT NULL,
    rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT timetable_configs_pkey PRIMARY KEY (school_id)
);

CREATE TABLE public.timetable_lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    version_id uuid NOT NULL,
    requirement_id uuid,
    day smallint NOT NULL,
    period smallint NOT NULL,
    grade_stream_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id text,
    room_id uuid,
    locked boolean DEFAULT false NOT NULL,
    CONSTRAINT timetable_lessons_pkey PRIMARY KEY (id),
    CONSTRAINT timetable_lessons_day_check CHECK (((day >= 1) AND (day <= 7))),
    CONSTRAINT timetable_lessons_period_check CHECK ((period >= 0))
);

CREATE TABLE public.timetable_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    grade_stream_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id text,
    lessons_per_week smallint NOT NULL,
    double_lessons smallint DEFAULT 0 NOT NULL,
    room_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    option_block smallint,
    CONSTRAINT timetable_requirements_pkey PRIMARY KEY (id),
    CONSTRAINT timetable_requirements_school_id_grade_stream_id_subject_id_key UNIQUE (school_id, grade_stream_id, subject_id),
    CONSTRAINT timetable_requirements_check CHECK (((double_lessons * 2) <= lessons_per_week)),
    CONSTRAINT timetable_requirements_double_lessons_check CHECK ((double_lessons >= 0)),
    CONSTRAINT timetable_requirements_lessons_per_week_check CHECK (((lessons_per_week >= 1) AND (lessons_per_week <= 20))),
    CONSTRAINT timetable_requirements_option_block_check CHECK (((option_block >= 1) AND (option_block <= 12))),
    CONSTRAINT timetable_requirements_room_type_check CHECK ((room_type = ANY (ARRAY['CLASSROOM'::text, 'LAB'::text, 'COMPUTER'::text, 'HALL'::text, 'FIELD'::text, 'OTHER'::text])))
);

CREATE TABLE public.timetable_subject_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    bands text[] DEFAULT '{}'::text[] NOT NULL,
    subject_ids uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT timetable_subject_groups_pkey PRIMARY KEY (id),
    CONSTRAINT timetable_subject_groups_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80))),
    CONSTRAINT timetable_subject_groups_subject_ids_check CHECK ((cardinality(subject_ids) >= 2))
);

CREATE TABLE public.timetable_substitutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    cover_date date NOT NULL,
    absent_teacher_id text,
    cover_teacher_id text,
    reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT timetable_substitutions_pkey PRIMARY KEY (id),
    CONSTRAINT timetable_substitutions_lesson_id_cover_date_key UNIQUE (lesson_id, cover_date)
);

CREATE TABLE public.timetable_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT timetable_versions_pkey PRIMARY KEY (id),
    CONSTRAINT timetable_versions_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'ARCHIVED'::text])))
);

CREATE TABLE public.transport_crew (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    user_id text,
    full_name text NOT NULL,
    phone text,
    crew_role text DEFAULT 'DRIVER'::text NOT NULL,
    licence_number text,
    licence_class text,
    licence_expiry date,
    psv_badge_expiry date,
    good_conduct_expiry date,
    medical_expiry date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transport_crew_pkey PRIMARY KEY (id),
    CONSTRAINT transport_crew_crew_role_check CHECK ((crew_role = ANY (ARRAY['DRIVER'::text, 'ATTENDANT'::text])))
);

CREATE TABLE public.transport_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    vehicle_id uuid,
    driver_id uuid,
    fee_per_term numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transport_routes_pkey PRIMARY KEY (id),
    CONSTRAINT transport_routes_school_id_name_key UNIQUE (school_id, name),
    CONSTRAINT transport_routes_fee_per_term_check CHECK ((fee_per_term >= (0)::numeric))
);

CREATE TABLE public.trip_boardings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    trip_id uuid NOT NULL,
    student_id text NOT NULL,
    event text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by text,
    CONSTRAINT trip_boardings_pkey PRIMARY KEY (id),
    CONSTRAINT trip_boardings_trip_id_student_id_event_key UNIQUE (trip_id, student_id, event),
    CONSTRAINT trip_boardings_event_check CHECK ((event = ANY (ARRAY['BOARDED'::text, 'ALIGHTED'::text, 'ABSENT'::text])))
);

CREATE TABLE public.trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    route_id uuid,
    vehicle_id uuid NOT NULL,
    driver_id uuid,
    direction text DEFAULT 'MORNING'::text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status text DEFAULT 'SCHEDULED'::text NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    start_odometer integer,
    end_odometer integer,
    notes text,
    last_lat double precision,
    last_lng double precision,
    last_speed_kmh numeric(5,1),
    last_seen_at timestamp with time zone,
    max_speed_kmh numeric(5,1),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trips_pkey PRIMARY KEY (id),
    CONSTRAINT trips_direction_check CHECK ((direction = ANY (ARRAY['MORNING'::text, 'EVENING'::text, 'OTHER'::text]))),
    CONSTRAINT trips_status_check CHECK ((status = ANY (ARRAY['SCHEDULED'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text, 'CANCELLED'::text])))
);

CREATE TABLE public.user_duties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    user_id text NOT NULL,
    duty text NOT NULL,
    scope_type text,
    scope_id uuid,
    starts_on date,
    ends_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    CONSTRAINT user_duties_pkey PRIMARY KEY (id),
    CONSTRAINT user_duties_check CHECK (((scope_type IS NULL) = (scope_id IS NULL))),
    CONSTRAINT user_duties_check1 CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on))),
    CONSTRAINT user_duties_duty_check CHECK ((duty = ANY (ARRAY['PRINCIPAL'::text, 'DEPUTY_PRINCIPAL'::text, 'DOS'::text, 'HOD'::text, 'TIMETABLER'::text, 'EXAMS_OFFICER'::text, 'BURSAR'::text, 'ACCOUNTANT'::text, 'MATRON'::text, 'PATRON'::text, 'NURSE'::text, 'DISCIPLINE_MASTER'::text, 'TRANSPORT_MANAGER'::text, 'DRIVER'::text, 'LIBRARIAN'::text, 'STOREKEEPER'::text, 'HR_OFFICER'::text]))),
    CONSTRAINT user_duties_scope_type_check CHECK ((scope_type = ANY (ARRAY['DEPARTMENT'::text, 'STREAM'::text, 'DORM'::text, 'VEHICLE'::text, 'ROUTE'::text])))
);

CREATE TABLE public.user_signatures (
    user_id text NOT NULL,
    school_id uuid NOT NULL,
    image text NOT NULL,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_signatures_pkey PRIMARY KEY (user_id),
    CONSTRAINT user_signatures_image_check CHECK (((image ~~ 'data:image/png;base64,%'::text) AND (length(image) <= 400000)))
);

CREATE TABLE public.users (
    id text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    role user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    password_hash text,
    school_id uuid,
    avatar_url text,
    job_title text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_username_key UNIQUE (username)
);

CREATE TABLE public.vehicle_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    vehicle_id uuid NOT NULL,
    log_type text NOT NULL,
    log_date date DEFAULT CURRENT_DATE NOT NULL,
    odometer integer,
    litres numeric(8,2),
    cost numeric(12,2),
    description text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vehicle_logs_pkey PRIMARY KEY (id),
    CONSTRAINT vehicle_logs_log_type_check CHECK ((log_type = ANY (ARRAY['FUEL'::text, 'SERVICE'::text, 'REPAIR'::text, 'INSPECTION'::text, 'OTHER'::text])))
);

CREATE TABLE public.vehicle_positions (
    id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    school_id uuid NOT NULL,
    trip_id uuid NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    speed_kmh numeric(5,1),
    heading numeric(5,1),
    accuracy_m numeric(7,1),
    recorded_at timestamp with time zone NOT NULL,
    CONSTRAINT vehicle_positions_pkey PRIMARY KEY (id),
    CONSTRAINT vehicle_positions_trip_id_recorded_at_key UNIQUE (trip_id, recorded_at),
    CONSTRAINT vehicle_positions_lat_check CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision))),
    CONSTRAINT vehicle_positions_lng_check CHECK (((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)))
);

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    registration text NOT NULL,
    make_model text,
    capacity integer NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    insurance_expiry date,
    inspection_expiry date,
    speed_governor_expiry date,
    telematics_expiry date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vehicles_pkey PRIMARY KEY (id),
    CONSTRAINT vehicles_school_id_registration_key UNIQUE (school_id, registration),
    CONSTRAINT vehicles_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT vehicles_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'MAINTENANCE'::text, 'RETIRED'::text])))
);

CREATE TABLE public.vote_heads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    priority integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vote_heads_pkey PRIMARY KEY (id),
    CONSTRAINT vote_heads_school_id_name_key UNIQUE (school_id, name)
);

ALTER SEQUENCE public.subjects_merge_audit_id_seq OWNED BY public.subjects_merge_audit.id;

-- ======================================================================
-- 6. Functions
-- ======================================================================

CREATE OR REPLACE FUNCTION public.calculate_exam_mark_grade()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    
    -- Only auto-calculate grade if NOT provided (allow teachers to manually set grades)
    IF NEW.grade_symbol IS NULL OR NEW.grade_symbol = '' THEN
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
    END IF;
    
    NEW.updated_at := now();
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.class_exam_series(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(term_id uuid, term_name text, exam_type text, first_exam_date date, subject_count bigint, mark_count bigint, mean_percentage numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    select e.term_id, t.name, e.exam_type::text, min(e.exam_date),
        count(distinct e.subject_id)::bigint, count(em.id)::bigint,
        round(avg(em.percentage))::numeric
    from exams e
    join exam_marks em on em.exam_id = e.id and em.percentage is not null
    join students st on st.id = em.student_id
    left join terms t on t.id = e.term_id
    where e.school_id = p_school_id
      and st.current_grade_stream_id = p_grade_stream_id
      and (p_term_id is null or e.term_id = p_term_id)
    group by e.term_id, t.name, e.exam_type
    having count(em.id) > 0;
$function$;

CREATE OR REPLACE FUNCTION public.class_merit_list(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid DEFAULT NULL::uuid, p_exam_type text DEFAULT NULL::text)
 RETURNS TABLE(student_id text, admission_number text, first_name text, last_name text, subjects_sat bigint, mark_count bigint, mean_percentage numeric, papers_available bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    with scoped as (
        select em.id, em.student_id, em.percentage, e.subject_id
        from exam_marks em
        join exams e on e.id = em.exam_id
        join students st on st.id = em.student_id
        where e.school_id = p_school_id
          and st.current_grade_stream_id = p_grade_stream_id
          and em.percentage is not null
          and (p_term_id is null or e.term_id = p_term_id)
          and (p_exam_type is null or e.exam_type::text = p_exam_type)
    ),
    available as (select count(distinct subject_id)::bigint as n from scoped)
    select sc.student_id, st.admission_number, u.first_name, u.last_name,
        count(distinct sc.subject_id)::bigint, count(sc.id)::bigint,
        round(avg(sc.percentage))::numeric, (select n from available)
    from scoped sc
    join students st on st.id = sc.student_id
    join users u on u.id = st.id
    group by sc.student_id, st.admission_number, u.first_name, u.last_name;
$function$;

CREATE OR REPLACE FUNCTION public.class_subject_performance(p_school_id uuid, p_grade_stream_id uuid, p_term_id uuid DEFAULT NULL::uuid, p_exam_type text DEFAULT NULL::text, p_pass_mark numeric DEFAULT 50)
 RETURNS TABLE(subject_id uuid, subject_name text, subject_code text, band text, student_count bigint, mark_count bigint, mean_percentage numeric, pass_count bigint, highest numeric, lowest numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
    select s.id, s.name, s.code, s.band,
        count(distinct em.student_id)::bigint,
        count(em.id)::bigint,
        round(avg(em.percentage))::numeric,
        count(em.id) filter (where em.percentage >= p_pass_mark)::bigint,
        max(em.percentage)::numeric, min(em.percentage)::numeric
    from exam_marks em
    join exams e on e.id = em.exam_id
    join subjects s on s.id = e.subject_id
    join students st on st.id = em.student_id
    where e.school_id = p_school_id
      and st.current_grade_stream_id = p_grade_stream_id
      and em.percentage is not null
      and (p_term_id is null or e.term_id = p_term_id)
      and (p_exam_type is null or e.exam_type::text = p_exam_type)
    group by s.id, s.name, s.code, s.band;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_term_mark_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_exam uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN v_exam := OLD.exam_id; ELSE v_exam := NEW.exam_id; END IF;
    IF EXISTS (
        SELECT 1 FROM exams e JOIN terms t ON t.id = e.term_id
        WHERE e.id = v_exam AND t.marks_locked_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Marks for this term are locked. Ask the admin or DOS to unlock the term first.'
            USING ERRCODE = 'P0001', HINT = 'term_locked';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.exam_mark_totals(p_school_id uuid, p_term_id uuid DEFAULT NULL::uuid, p_year_id uuid DEFAULT NULL::uuid, p_subject_id uuid DEFAULT NULL::uuid, p_exam_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(exam_id uuid, exam_name text, exam_date date, subject_id uuid, subject_name text, mark_count bigint, scored_count bigint, percentage_sum numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select e.id, e.name, e.exam_date, e.subject_id, s.name,
         count(*), count(m.percentage), coalesce(sum(m.percentage), 0)
  from exams e
  join exam_marks m on m.exam_id = e.id
  left join subjects s on s.id = e.subject_id
  where e.school_id = p_school_id
    and (p_term_id is null or e.term_id = p_term_id)
    and (p_year_id is null or e.academic_year_id = p_year_id)
    and (p_subject_id is null or e.subject_id = p_subject_id)
    and (p_exam_ids is null or e.id = any(p_exam_ids))
  group by e.id, e.name, e.exam_date, e.subject_id, s.name
$function$;

CREATE OR REPLACE FUNCTION public.generate_school_invite_codes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Generate simple 6-character alphanumeric codes
    NEW.teacher_invite_code := 'T-' || substring(md5(random()::text) from 1 for 6);
    NEW.student_invite_code := 'S-' || substring(md5(random()::text) from 1 for 6);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_term_reports(p_academic_year_id uuid, p_term_id uuid, p_grade_stream_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_term_reports(p_term_id uuid, p_grade_stream_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_academic_year_id UUID;
BEGIN
    -- 1. Get the academic_year_id from the term
    SELECT academic_year_id INTO v_academic_year_id FROM terms WHERE id = p_term_id;
    
    IF v_academic_year_id IS NULL THEN
        RAISE EXCEPTION 'Term not found or has no associated academic year.';
    END IF;

    -- 2. Verify caller is ADMIN or the assigned CLASS_TEACHER for this stream/year
    IF get_my_role() != 'ADMIN' THEN
        IF NOT EXISTS (
            SELECT 1 FROM class_teachers 
            WHERE user_id = auth.uid() 
              AND current_grade_stream_id = p_grade_stream_id 
              AND academic_year_id = v_academic_year_id
        ) THEN
            RAISE EXCEPTION 'Not authorized to generate reports for this class stream.';
        END IF;
    END IF;

    -- 3. Upsert master report_cards records for all active students in the stream
    INSERT INTO report_cards (student_id, academic_year_id, term_id, grade_stream_id, generated_by_user_id)
    SELECT id, v_academic_year_id, p_term_id, p_grade_stream_id, auth.uid()
    FROM students
    WHERE current_grade_stream_id = p_grade_stream_id AND status = 'ACTIVE'
    ON CONFLICT (student_id, academic_year_id, term_id) 
    DO UPDATE SET 
        generated_at = now(),
        generated_by_user_id = auth.uid();

    -- 4. Clear old report card subjects for these report cards
    DELETE FROM report_card_subjects 
    WHERE report_card_id IN (
        SELECT id FROM report_cards
        WHERE grade_stream_id = p_grade_stream_id
          AND academic_year_id = v_academic_year_id
          AND term_id = p_term_id
    );

    -- 5. Calculate per-subject aggregates for all students in bulk
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
      AND rc.academic_year_id = v_academic_year_id
      AND rc.term_id = p_term_id
      AND e.academic_year_id = v_academic_year_id
      AND e.term_id = p_term_id
    GROUP BY rc.id, e.subject_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select role from public.users where id = (auth.jwt() ->> 'sub') limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select school_id from public.users where id = (auth.jwt() ->> 'sub') limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_hits integer;
BEGIN
    INSERT INTO rate_limit_hits AS r (key, window_start, hits)
    VALUES (p_key, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1 ELSE r.hits + 1 END,
        window_start = CASE WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now() ELSE r.window_start END
    RETURNING hits INTO v_hits;

    IF random() < 0.01 THEN
        DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 day';
    END IF;

    RETURN v_hits <= p_max;
END;
$function$;

CREATE OR REPLACE FUNCTION public.library_loans_check_available()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    total int;
    out_now int;
BEGIN
    IF NEW.returned_on IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT copies_total INTO total FROM public.library_books WHERE id = NEW.book_id FOR UPDATE;
    SELECT count(*) INTO out_now FROM public.library_loans
     WHERE book_id = NEW.book_id AND returned_on IS NULL AND id <> NEW.id;
    IF out_now >= coalesce(total, 0) THEN
        RAISE EXCEPTION 'No copies of this book are available' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_exam_mark_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO exam_mark_history (exam_id, student_id, action, new_score, new_grade, changed_by)
        VALUES (NEW.exam_id, NEW.student_id, 'entered', NEW.raw_score, NEW.grade_symbol, NEW.updated_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.raw_score IS DISTINCT FROM OLD.raw_score OR NEW.grade_symbol IS DISTINCT FROM OLD.grade_symbol THEN
            INSERT INTO exam_mark_history (exam_id, student_id, action, old_score, new_score, old_grade, new_grade, changed_by)
            VALUES (NEW.exam_id, NEW.student_id, 'changed', OLD.raw_score, NEW.raw_score, OLD.grade_symbol, NEW.grade_symbol, NEW.updated_by);
        END IF;
        RETURN NEW;
    ELSE
        IF EXISTS (SELECT 1 FROM exams WHERE id = OLD.exam_id) THEN
            INSERT INTO exam_mark_history (exam_id, student_id, action, old_score, old_grade, changed_by)
            VALUES (OLD.exam_id, OLD.student_id, 'removed', OLD.raw_score, OLD.grade_symbol, OLD.updated_by);
        END IF;
        RETURN OLD;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.medication_logs_take_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    IF NEW.stock_id IS NOT NULL AND NEW.quantity > 0 THEN
        UPDATE public.medicine_stock
           SET quantity = quantity - NEW.quantity
         WHERE id = NEW.stock_id AND school_id = NEW.school_id;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.publish_timetable_version(p_school_id uuid, p_version_id uuid)
 RETURNS SETOF timetable_versions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from timetable_versions where id = p_version_id and school_id = p_school_id) then
    return;
  end if;
  update timetable_versions set status = 'ARCHIVED'
    where school_id = p_school_id and status = 'PUBLISHED' and id <> p_version_id;
  return query
    update timetable_versions set status = 'PUBLISHED', published_at = now()
    where id = p_version_id and school_id = p_school_id
    returning *;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.school_class_performance(p_school_id uuid, p_academic_year_id uuid DEFAULT NULL::uuid, p_pass_mark numeric DEFAULT 50)
 RETURNS TABLE(grade_stream_id uuid, full_name text, level_code text, student_count bigint, mark_count bigint, mean_percentage numeric, pass_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    select
        gs.id as grade_stream_id,
        gs.full_name,
        al.code as level_code,
        count(distinct s.id)::bigint as student_count,
        count(em.id)::bigint as mark_count,
        round(avg(em.percentage))::numeric as mean_percentage,
        count(em.id) filter (where em.percentage >= p_pass_mark)::bigint as pass_count
    from grade_streams gs
    left join grades g on g.id = gs.grade_id
    left join academic_levels al on al.id = g.academic_level_id
    left join students s on s.current_grade_stream_id = gs.id
    left join exam_marks em on em.student_id = s.id and em.percentage is not null
    left join exams e
           on e.id = em.exam_id
          and (p_academic_year_id is null or e.academic_year_id = p_academic_year_id)
    where gs.school_id = p_school_id
      and (em.id is null or e.id is not null)
    group by gs.id, gs.full_name, al.code;
$function$;

CREATE OR REPLACE FUNCTION public.school_class_performance_for_term(p_school_id uuid, p_term_id uuid, p_pass_mark numeric DEFAULT 50)
 RETURNS TABLE(grade_stream_id uuid, full_name text, level_code text, student_count bigint, mark_count bigint, mean_percentage numeric, pass_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    select
        gs.id as grade_stream_id,
        gs.full_name,
        al.code as level_code,
        count(distinct s.id)::bigint as student_count,
        count(em.id)::bigint as mark_count,
        round(avg(em.percentage))::numeric as mean_percentage,
        count(em.id) filter (where em.percentage >= p_pass_mark)::bigint as pass_count
    from grade_streams gs
    left join grades g on g.id = gs.grade_id
    left join academic_levels al on al.id = g.academic_level_id
    left join students s on s.current_grade_stream_id = gs.id
    left join exam_marks em on em.student_id = s.id and em.percentage is not null
    left join exams e on e.id = em.exam_id and e.term_id = p_term_id
    where gs.school_id = p_school_id
      -- Drop marks from other terms without dropping classes that have none.
      and (em.id is null or e.id is not null)
    group by gs.id, gs.full_name, al.code;
$function$;

CREATE OR REPLACE FUNCTION public.school_mark_summary(p_school_id uuid, p_academic_year_id uuid DEFAULT NULL::uuid, p_pass_mark numeric DEFAULT 50)
 RETURNS TABLE(mark_count bigint, mean_percentage numeric, pass_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    select
        count(*)::bigint as mark_count,
        round(avg(em.percentage))::numeric as mean_percentage,
        count(*) filter (where em.percentage >= p_pass_mark)::bigint as pass_count
    from exam_marks em
    join exams e on e.id = em.exam_id
    where e.school_id = p_school_id
      and (p_academic_year_id is null or e.academic_year_id = p_academic_year_id)
      and em.percentage is not null;
$function$;

CREATE OR REPLACE FUNCTION public.school_unmarked_exams(p_school_id uuid, p_academic_year_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(label text, level_code text, unmarked_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    select
        coalesce(gs.full_name, g.name_display, 'Unassigned') as label,
        al.code as level_code,
        count(*)::bigint as unmarked_count
    from exams e
    left join grade_streams gs on gs.id = e.grade_stream_id
    left join grades g on g.id = coalesce(e.grade_id, gs.grade_id)
    left join academic_levels al on al.id = g.academic_level_id
    where e.school_id = p_school_id
      and (p_academic_year_id is null or e.academic_year_id = p_academic_year_id)
      and e.exam_date <= current_date
      and not exists (select 1 from exam_marks m where m.exam_id = e.id)
    group by 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.school_unmarked_exams_for_term(p_school_id uuid, p_term_id uuid)
 RETURNS TABLE(label text, level_code text, unmarked_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
    select
        coalesce(gs.full_name, g.name_display, 'Unassigned') as label,
        al.code as level_code,
        count(*)::bigint as unmarked_count
    from exams e
    left join grade_streams gs on gs.id = e.grade_stream_id
    left join grades g on g.id = coalesce(e.grade_id, gs.grade_id)
    left join academic_levels al on al.id = g.academic_level_id
    where e.school_id = p_school_id
      and e.term_id = p_term_id
      and e.exam_date <= current_date
      and not exists (select 1 from exam_marks m where m.exam_id = e.id)
    group by 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.set_class_teacher(p_school_id uuid, p_stream_id uuid, p_user_id text, p_year_id uuid)
 RETURNS TABLE(previous_teacher_id text, moved_from_stream_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_previous text;
    v_moved_from uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM grade_streams WHERE id = p_stream_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'Class not found in this school.' USING ERRCODE = 'P0002';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_year_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'Academic year not found in this school.' USING ERRCODE = 'P0002';
    END IF;
    IF p_user_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = p_user_id AND school_id = p_school_id AND is_active
          AND role IN ('CLASS_TEACHER', 'SUBJECT_TEACHER')
    ) THEN
        RAISE EXCEPTION 'Only an active teacher at this school can be a class teacher.' USING ERRCODE = 'P0001';
    END IF;

    SELECT user_id INTO v_previous
    FROM class_teachers
    WHERE current_grade_stream_id = p_stream_id AND academic_year_id = p_year_id
    FOR UPDATE;

    IF v_previous IS NOT DISTINCT FROM p_user_id THEN
        RETURN QUERY SELECT v_previous, NULL::uuid;
        RETURN;
    END IF;

    IF v_previous IS NOT NULL THEN
        DELETE FROM class_teachers
        WHERE current_grade_stream_id = p_stream_id AND academic_year_id = p_year_id;
        UPDATE users SET role = 'SUBJECT_TEACHER' WHERE id = v_previous AND role = 'CLASS_TEACHER';
    END IF;

    IF p_user_id IS NOT NULL THEN
        SELECT current_grade_stream_id INTO v_moved_from
        FROM class_teachers
        WHERE user_id = p_user_id AND academic_year_id = p_year_id
        FOR UPDATE;

        IF v_moved_from IS NOT NULL THEN
            UPDATE class_teachers SET current_grade_stream_id = p_stream_id
            WHERE user_id = p_user_id AND academic_year_id = p_year_id;
        ELSE
            INSERT INTO class_teachers (user_id, current_grade_stream_id, academic_year_id)
            VALUES (p_user_id, p_stream_id, p_year_id);
        END IF;
        UPDATE users SET role = 'CLASS_TEACHER' WHERE id = p_user_id AND role = 'SUBJECT_TEACHER';
    END IF;

    RETURN QUERY SELECT v_previous, v_moved_from;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_student_school_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    SELECT u.school_id INTO NEW.school_id FROM users u WHERE u.id = NEW.id;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.swap_timetable_slot(p_version_id uuid, p_group uuid[], p_swap uuid[], p_to_day smallint, p_to_period smallint, p_from_day smallint, p_from_period smallint, p_park_period smallint, p_lesson uuid, p_room uuid, p_locked boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update timetable_lessons set period = p_park_period
    where version_id = p_version_id and id = any(p_swap);
  update timetable_lessons set day = p_to_day, period = p_to_period, locked = coalesce(p_locked, locked)
    where version_id = p_version_id and id = any(p_group);
  update timetable_lessons set room_id = p_room
    where version_id = p_version_id and id = p_lesson and room_id is distinct from p_room;
  update timetable_lessons set day = p_from_day, period = p_from_period
    where version_id = p_version_id and id = any(p_swap);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_student_fee_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_student_fee_id UUID := COALESCE(NEW.student_fee_id, OLD.student_fee_id);
    v_total NUMERIC(12,2);
    v_paid NUMERIC(12,2);
    v_status TEXT;
BEGIN
    IF v_student_fee_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM fee_payments
    WHERE student_fee_id = v_student_fee_id AND status = 'COMPLETED';

    SELECT total_fee INTO v_total FROM student_fees WHERE id = v_student_fee_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_status := CASE
        WHEN v_total <= 0 THEN (CASE WHEN v_paid > 0 THEN 'OVERPAID' ELSE 'PAID' END)
        WHEN v_paid <= 0 THEN 'PENDING'
        WHEN v_paid > v_total THEN 'OVERPAID'
        WHEN v_paid >= v_total THEN 'PAID'
        ELSE 'PARTIAL'
    END;

    UPDATE student_fees
    SET paid_amount = v_paid, status = v_status, updated_at = now()
    WHERE id = v_student_fee_id;

    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_student_school_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    UPDATE students SET school_id = NEW.school_id WHERE id = NEW.id;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_exam_mark_component()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_student_subject()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_subject_combination()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_student_promotion(p_school_id uuid, p_academic_year_id uuid, p_actor text, p_decisions jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_run uuid;
    v_wanted integer;
    v_matched integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_academic_year_id AND school_id = p_school_id) THEN
        RAISE EXCEPTION 'That academic year is not your school''s.' USING ERRCODE = 'P0001', HINT = 'bad_year';
    END IF;

    IF to_regclass('pg_temp._decisions') IS NOT NULL THEN DROP TABLE pg_temp._decisions; END IF;
    CREATE TEMP TABLE _decisions ON COMMIT DROP AS
        SELECT d.student_id, d.from_stream_id, d.to_stream_id, d.outcome
        FROM jsonb_to_recordset(p_decisions) AS d(student_id text, from_stream_id uuid, to_stream_id uuid, outcome text);

    SELECT count(*), count(DISTINCT student_id) INTO v_wanted, v_matched FROM _decisions;
    IF v_wanted = 0 OR v_wanted <> v_matched THEN
        RAISE EXCEPTION 'Each learner needs exactly one decision.' USING ERRCODE = 'P0001', HINT = 'bad_plan';
    END IF;

    IF EXISTS (
        SELECT 1 FROM _decisions d
        LEFT JOIN grade_streams g ON g.id = d.to_stream_id AND g.school_id = p_school_id
        WHERE d.outcome NOT IN ('PROMOTE', 'REPEAT', 'GRADUATE', 'TRANSFER')
           OR (d.outcome = 'PROMOTE') <> (d.to_stream_id IS NOT NULL)
           OR (d.to_stream_id IS NOT NULL AND g.id IS NULL)
    ) THEN
        RAISE EXCEPTION 'The plan sends a learner to a class that is not your school''s.' USING ERRCODE = 'P0001', HINT = 'bad_plan';
    END IF;

    PERFORM 1 FROM students s JOIN _decisions d ON d.student_id = s.id FOR UPDATE OF s;
    SELECT count(*) INTO v_matched
    FROM students s JOIN _decisions d ON d.student_id = s.id
    WHERE s.school_id = p_school_id AND s.status = 'ACTIVE' AND s.current_grade_stream_id = d.from_stream_id;
    IF v_matched <> v_wanted THEN
        RAISE EXCEPTION 'Some learners have changed class or left since this plan was made. Reload and check again.'
            USING ERRCODE = 'P0001', HINT = 'stale_plan';
    END IF;

    BEGIN
        INSERT INTO student_promotion_runs (school_id, academic_year_id, run_by, promoted, repeated, graduated, transferred)
        SELECT p_school_id, p_academic_year_id, p_actor,
               count(*) FILTER (WHERE outcome = 'PROMOTE'),
               count(*) FILTER (WHERE outcome = 'REPEAT'),
               count(*) FILTER (WHERE outcome = 'GRADUATE'),
               count(*) FILTER (WHERE outcome = 'TRANSFER')
        FROM _decisions
        RETURNING id INTO v_run;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Learners have already been promoted this academic year. Undo that promotion first to run it again.'
            USING ERRCODE = 'P0001', HINT = 'already_run';
    END;

    INSERT INTO student_promotions (run_id, school_id, student_id, outcome, from_stream_id, to_stream_id, previous_status, new_status)
    SELECT v_run, p_school_id, d.student_id, d.outcome, d.from_stream_id, d.to_stream_id, 'ACTIVE',
           (CASE d.outcome WHEN 'GRADUATE' THEN 'GRADUATED' WHEN 'TRANSFER' THEN 'TRANSFERRED' ELSE 'ACTIVE' END)::student_status
    FROM _decisions d;

    UPDATE students s
    SET current_grade_stream_id = coalesce(p.to_stream_id, s.current_grade_stream_id),
        status = p.new_status
    FROM student_promotions p
    WHERE p.run_id = v_run AND p.student_id = s.id AND p.outcome <> 'REPEAT';

    RETURN v_run;
END;
$function$;

CREATE OR REPLACE FUNCTION public.undo_student_promotion(p_school_id uuid, p_run_id uuid, p_actor text)
 RETURNS TABLE(restored integer, skipped integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_total integer;
    v_restored integer;
BEGIN
    PERFORM 1 FROM student_promotion_runs
    WHERE id = p_run_id AND school_id = p_school_id AND undone_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That promotion is not your school''s, or has already been undone.' USING ERRCODE = 'P0001', HINT = 'not_found';
    END IF;
    IF EXISTS (
        SELECT 1 FROM student_promotion_runs
        WHERE school_id = p_school_id AND undone_at IS NULL AND id <> p_run_id
          AND created_at > (SELECT created_at FROM student_promotion_runs WHERE id = p_run_id)
    ) THEN
        RAISE EXCEPTION 'A later promotion has been run. Undo that one first.' USING ERRCODE = 'P0001', HINT = 'not_latest';
    END IF;

    SELECT count(*) INTO v_total FROM student_promotions WHERE run_id = p_run_id AND outcome <> 'REPEAT';

    UPDATE students s
    SET current_grade_stream_id = p.from_stream_id,
        status = p.previous_status
    FROM student_promotions p
    WHERE p.run_id = p_run_id AND p.student_id = s.id AND p.outcome <> 'REPEAT'
      AND s.current_grade_stream_id = coalesce(p.to_stream_id, p.from_stream_id)
      AND s.status = p.new_status;
    GET DIAGNOSTICS v_restored = ROW_COUNT;

    UPDATE student_promotion_runs SET undone_at = now(), undone_by = p_actor WHERE id = p_run_id;

    RETURN QUERY SELECT v_restored, v_total - v_restored;
END;
$function$;

-- ======================================================================
-- 7. Foreign keys
-- ======================================================================

ALTER TABLE ONLY public.academic_years ADD CONSTRAINT academic_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.announcements ADD CONSTRAINT announcements_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.assignment_submissions ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.assignment_submissions ADD CONSTRAINT assignment_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.assignment_submissions ADD CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.assignments ADD CONSTRAINT assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.assignments ADD CONSTRAINT assignments_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.assignments ADD CONSTRAINT assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.assignments ADD CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance_notifications ADD CONSTRAINT attendance_notifications_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.attendance_notifications ADD CONSTRAINT attendance_notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.attendance_notifications ADD CONSTRAINT attendance_notifications_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.audit_log ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.audit_log ADD CONSTRAINT audit_log_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.class_teachers ADD CONSTRAINT class_teachers_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.class_teachers ADD CONSTRAINT class_teachers_current_grade_stream_id_fkey FOREIGN KEY (current_grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.class_teachers ADD CONSTRAINT fk_class_teachers_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.clinic_visits ADD CONSTRAINT clinic_visits_attended_by_fkey FOREIGN KEY (attended_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.clinic_visits ADD CONSTRAINT clinic_visits_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.clinic_visits ADD CONSTRAINT clinic_visits_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.competency_assessments ADD CONSTRAINT competency_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.competency_assessments ADD CONSTRAINT competency_assessments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.competency_assessments ADD CONSTRAINT competency_assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.competency_assessments ADD CONSTRAINT competency_assessments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.competency_assessments ADD CONSTRAINT competency_assessments_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.daily_attendance ADD CONSTRAINT daily_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.daily_attendance ADD CONSTRAINT daily_attendance_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.daily_attendance ADD CONSTRAINT daily_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.discipline_incidents ADD CONSTRAINT discipline_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.discipline_incidents ADD CONSTRAINT discipline_incidents_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.discipline_incidents ADD CONSTRAINT discipline_incidents_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.dorm_allocations ADD CONSTRAINT dorm_allocations_dorm_id_fkey FOREIGN KEY (dorm_id) REFERENCES dorms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dorm_allocations ADD CONSTRAINT dorm_allocations_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dorm_allocations ADD CONSTRAINT dorm_allocations_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.dorm_inspections ADD CONSTRAINT dorm_inspections_dorm_id_fkey FOREIGN KEY (dorm_id) REFERENCES dorms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dorm_inspections ADD CONSTRAINT dorm_inspections_inspected_by_fkey FOREIGN KEY (inspected_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.dorm_inspections ADD CONSTRAINT dorm_inspections_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.dorms ADD CONSTRAINT dorms_patron_id_fkey FOREIGN KEY (patron_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.dorms ADD CONSTRAINT dorms_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_mark_components ADD CONSTRAINT exam_mark_components_component_id_fkey FOREIGN KEY (component_id) REFERENCES exam_subject_components(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_mark_components ADD CONSTRAINT exam_mark_components_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_mark_components ADD CONSTRAINT exam_mark_components_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_mark_components ADD CONSTRAINT exam_mark_components_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_mark_history ADD CONSTRAINT exam_mark_history_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marking_requests ADD CONSTRAINT exam_marking_requests_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marking_requests ADD CONSTRAINT exam_marking_requests_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marking_requests ADD CONSTRAINT exam_marking_requests_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marking_windows ADD CONSTRAINT exam_marking_windows_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marking_windows ADD CONSTRAINT exam_marking_windows_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marking_windows ADD CONSTRAINT exam_marking_windows_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marks ADD CONSTRAINT exam_marks_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_marks ADD CONSTRAINT fk_exam_marks_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_paper_reviews ADD CONSTRAINT exam_paper_reviews_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_paper_reviews ADD CONSTRAINT exam_paper_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_paper_reviews ADD CONSTRAINT exam_paper_reviews_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_papers ADD CONSTRAINT exam_papers_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_subject_component_schemes ADD CONSTRAINT exam_subject_component_schemes_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_subject_component_schemes ADD CONSTRAINT exam_subject_component_schemes_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_subject_component_schemes ADD CONSTRAINT exam_subject_component_schemes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exam_subject_components ADD CONSTRAINT exam_subject_components_scheme_id_fkey FOREIGN KEY (scheme_id) REFERENCES exam_subject_component_schemes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_published_by_fkey FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exams ADD CONSTRAINT exams_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exeats ADD CONSTRAINT exeats_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exeats ADD CONSTRAINT exeats_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exeats ADD CONSTRAINT exeats_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exeats ADD CONSTRAINT exeats_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.expenses ADD CONSTRAINT expenses_vote_head_id_fkey FOREIGN KEY (vote_head_id) REFERENCES vote_heads(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.fee_awards ADD CONSTRAINT fee_awards_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.fee_awards ADD CONSTRAINT fee_awards_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_awards ADD CONSTRAINT fee_awards_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_awards ADD CONSTRAINT fee_awards_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_payments ADD CONSTRAINT fee_payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.fee_payments ADD CONSTRAINT fee_payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_payments ADD CONSTRAINT fee_payments_student_fee_id_fkey FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_structure_items ADD CONSTRAINT fee_structure_items_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_structure_items ADD CONSTRAINT fee_structure_items_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_structure_items ADD CONSTRAINT fee_structure_items_vote_head_id_fkey FOREIGN KEY (vote_head_id) REFERENCES vote_heads(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.fee_structures ADD CONSTRAINT fee_structures_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_structures ADD CONSTRAINT fee_structures_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fee_structures ADD CONSTRAINT fee_structures_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.grade_streams ADD CONSTRAINT grade_streams_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.grade_streams ADD CONSTRAINT grade_streams_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.grades ADD CONSTRAINT grades_academic_level_id_fkey FOREIGN KEY (academic_level_id) REFERENCES academic_levels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.grading_scales ADD CONSTRAINT grading_scales_grading_system_id_fkey FOREIGN KEY (grading_system_id) REFERENCES grading_systems(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.grading_systems ADD CONSTRAINT grading_systems_academic_level_id_fkey FOREIGN KEY (academic_level_id) REFERENCES academic_levels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.grading_systems ADD CONSTRAINT grading_systems_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.inventory_items ADD CONSTRAINT inventory_items_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.invite_codes ADD CONSTRAINT invite_codes_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE ONLY public.invite_codes ADD CONSTRAINT invite_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.invoice_lines ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.invoice_lines ADD CONSTRAINT invoice_lines_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.invoice_lines ADD CONSTRAINT invoice_lines_vote_head_id_fkey FOREIGN KEY (vote_head_id) REFERENCES vote_heads(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_structure_id_fkey FOREIGN KEY (structure_id) REFERENCES fee_structures(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.invoices ADD CONSTRAINT invoices_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.learning_materials ADD CONSTRAINT learning_materials_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.leave_requests ADD CONSTRAINT leave_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.leave_requests ADD CONSTRAINT leave_requests_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.leave_requests ADD CONSTRAINT leave_requests_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_plans ADD CONSTRAINT lesson_plans_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_plans ADD CONSTRAINT lesson_plans_scheme_entry_id_fkey FOREIGN KEY (scheme_entry_id) REFERENCES scheme_entries(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.lesson_plans ADD CONSTRAINT lesson_plans_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_plans ADD CONSTRAINT lesson_plans_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.lesson_plans ADD CONSTRAINT lesson_plans_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.library_books ADD CONSTRAINT library_books_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.library_loans ADD CONSTRAINT library_loans_book_id_fkey FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.library_loans ADD CONSTRAINT library_loans_borrower_id_fkey FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.library_loans ADD CONSTRAINT library_loans_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.library_loans ADD CONSTRAINT library_loans_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.marks ADD CONSTRAINT fk_marks_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.medical_profiles ADD CONSTRAINT medical_profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.medical_profiles ADD CONSTRAINT medical_profiles_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.medication_logs ADD CONSTRAINT medication_logs_given_by_fkey FOREIGN KEY (given_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.medication_logs ADD CONSTRAINT medication_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.medication_logs ADD CONSTRAINT medication_logs_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES medicine_stock(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.medication_logs ADD CONSTRAINT medication_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.medicine_stock ADD CONSTRAINT medicine_stock_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.performance_history ADD CONSTRAINT fk_performance_history_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.performance_history ADD CONSTRAINT performance_history_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.performance_history ADD CONSTRAINT performance_history_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.performance_history ADD CONSTRAINT performance_history_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.records_of_work ADD CONSTRAINT records_of_work_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.records_of_work ADD CONSTRAINT records_of_work_scheme_entry_id_fkey FOREIGN KEY (scheme_entry_id) REFERENCES scheme_entries(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.records_of_work ADD CONSTRAINT records_of_work_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.records_of_work ADD CONSTRAINT records_of_work_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.records_of_work ADD CONSTRAINT records_of_work_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_card_subjects ADD CONSTRAINT report_card_subjects_report_card_id_fkey FOREIGN KEY (report_card_id) REFERENCES report_cards(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_card_subjects ADD CONSTRAINT report_card_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_cards ADD CONSTRAINT fk_report_cards_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.report_cards ADD CONSTRAINT report_cards_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.report_cards ADD CONSTRAINT report_cards_generated_by_user_id_fkey FOREIGN KEY (generated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.report_cards ADD CONSTRAINT report_cards_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.report_cards ADD CONSTRAINT report_cards_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.roll_call_entries ADD CONSTRAINT roll_call_entries_roll_call_id_fkey FOREIGN KEY (roll_call_id) REFERENCES roll_calls(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.roll_call_entries ADD CONSTRAINT roll_call_entries_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.roll_call_entries ADD CONSTRAINT roll_call_entries_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.roll_calls ADD CONSTRAINT roll_calls_dorm_id_fkey FOREIGN KEY (dorm_id) REFERENCES dorms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.roll_calls ADD CONSTRAINT roll_calls_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.roll_calls ADD CONSTRAINT roll_calls_taken_by_fkey FOREIGN KEY (taken_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.rooms ADD CONSTRAINT rooms_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.route_stops ADD CONSTRAINT route_stops_route_id_fkey FOREIGN KEY (route_id) REFERENCES transport_routes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.route_stops ADD CONSTRAINT route_stops_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scheme_entries ADD CONSTRAINT scheme_entries_scheme_id_fkey FOREIGN KEY (scheme_id) REFERENCES schemes_of_work(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.scheme_entries ADD CONSTRAINT scheme_entries_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schemes_of_work ADD CONSTRAINT schemes_of_work_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schemes_of_work ADD CONSTRAINT schemes_of_work_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.schemes_of_work ADD CONSTRAINT schemes_of_work_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schemes_of_work ADD CONSTRAINT schemes_of_work_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schemes_of_work ADD CONSTRAINT schemes_of_work_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schemes_of_work ADD CONSTRAINT schemes_of_work_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.school_bank_accounts ADD CONSTRAINT school_bank_accounts_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.school_events ADD CONSTRAINT school_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.school_events ADD CONSTRAINT school_events_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.school_events ADD CONSTRAINT school_events_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.school_modules ADD CONSTRAINT school_modules_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.school_modules ADD CONSTRAINT school_modules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.school_payment_settings ADD CONSTRAINT school_payment_settings_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.school_sections ADD CONSTRAINT school_sections_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.school_subjects ADD CONSTRAINT school_subjects_grading_system_id_fkey FOREIGN KEY (grading_system_id) REFERENCES grading_systems(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.school_subjects ADD CONSTRAINT school_subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.school_subjects ADD CONSTRAINT school_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.schools ADD CONSTRAINT schools_grading_system_844_id_fkey FOREIGN KEY (grading_system_844_id) REFERENCES grading_systems(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.schools ADD CONSTRAINT schools_grading_system_cbc_id_fkey FOREIGN KEY (grading_system_cbc_id) REFERENCES grading_systems(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.schools ADD CONSTRAINT schools_overall_grading_system_id_fkey FOREIGN KEY (overall_grading_system_id) REFERENCES grading_systems(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.schools ADD CONSTRAINT schools_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.store_requisitions ADD CONSTRAINT store_requisitions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.store_requisitions ADD CONSTRAINT store_requisitions_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.store_requisitions ADD CONSTRAINT store_requisitions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.store_requisitions ADD CONSTRAINT store_requisitions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_fees ADD CONSTRAINT fk_student_fees_student_id FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.student_fees ADD CONSTRAINT student_fees_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_fees ADD CONSTRAINT student_fees_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_goals ADD CONSTRAINT student_goals_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_goals ADD CONSTRAINT student_goals_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.student_goals ADD CONSTRAINT student_goals_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_guardians ADD CONSTRAINT student_guardians_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.student_promotion_runs ADD CONSTRAINT student_promotion_runs_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_promotion_runs ADD CONSTRAINT student_promotion_runs_run_by_fkey FOREIGN KEY (run_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.student_promotion_runs ADD CONSTRAINT student_promotion_runs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_promotion_runs ADD CONSTRAINT student_promotion_runs_undone_by_fkey FOREIGN KEY (undone_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.student_promotions ADD CONSTRAINT student_promotions_from_stream_id_fkey FOREIGN KEY (from_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_promotions ADD CONSTRAINT student_promotions_run_id_fkey FOREIGN KEY (run_id) REFERENCES student_promotion_runs(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_promotions ADD CONSTRAINT student_promotions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_promotions ADD CONSTRAINT student_promotions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_promotions ADD CONSTRAINT student_promotions_to_stream_id_fkey FOREIGN KEY (to_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_subjects ADD CONSTRAINT student_subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_subjects ADD CONSTRAINT student_subjects_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.student_subjects ADD CONSTRAINT student_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_transport ADD CONSTRAINT student_transport_route_id_fkey FOREIGN KEY (route_id) REFERENCES transport_routes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_transport ADD CONSTRAINT student_transport_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_transport ADD CONSTRAINT student_transport_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES route_stops(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.student_transport ADD CONSTRAINT student_transport_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.students ADD CONSTRAINT fk_students_id_users FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.students ADD CONSTRAINT students_academic_level_id_fkey FOREIGN KEY (academic_level_id) REFERENCES academic_levels(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.students ADD CONSTRAINT students_current_grade_stream_id_fkey FOREIGN KEY (current_grade_stream_id) REFERENCES grade_streams(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.students ADD CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.students ADD CONSTRAINT students_subject_combination_id_fkey FOREIGN KEY (subject_combination_id) REFERENCES subject_combinations(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.subject_combination_subjects ADD CONSTRAINT subject_combination_subjects_combination_id_fkey FOREIGN KEY (combination_id) REFERENCES subject_combinations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_combination_subjects ADD CONSTRAINT subject_combination_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_combinations ADD CONSTRAINT subject_combinations_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_teacher_assignments ADD CONSTRAINT subject_teacher_assignments_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_teacher_assignments ADD CONSTRAINT subject_teacher_assignments_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_teacher_assignments ADD CONSTRAINT subject_teacher_assignments_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_teacher_assignments ADD CONSTRAINT subject_teacher_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_teacher_assignments ADD CONSTRAINT subject_teacher_assignments_subject_teacher_id_fkey FOREIGN KEY (subject_teacher_id) REFERENCES subject_teachers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subject_teachers ADD CONSTRAINT fk_subject_teachers_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subjects ADD CONSTRAINT subjects_academic_level_id_fkey FOREIGN KEY (academic_level_id) REFERENCES academic_levels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.subjects ADD CONSTRAINT subjects_origin_school_id_fkey FOREIGN KEY (origin_school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.suppliers ADD CONSTRAINT suppliers_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.terms ADD CONSTRAINT terms_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.terms ADD CONSTRAINT terms_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_configs ADD CONSTRAINT timetable_configs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_lessons ADD CONSTRAINT timetable_lessons_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_lessons ADD CONSTRAINT timetable_lessons_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES timetable_requirements(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_lessons ADD CONSTRAINT timetable_lessons_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_lessons ADD CONSTRAINT timetable_lessons_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_lessons ADD CONSTRAINT timetable_lessons_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_lessons ADD CONSTRAINT timetable_lessons_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_lessons ADD CONSTRAINT timetable_lessons_version_id_fkey FOREIGN KEY (version_id) REFERENCES timetable_versions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_requirements ADD CONSTRAINT timetable_requirements_grade_stream_id_fkey FOREIGN KEY (grade_stream_id) REFERENCES grade_streams(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_requirements ADD CONSTRAINT timetable_requirements_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_requirements ADD CONSTRAINT timetable_requirements_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_requirements ADD CONSTRAINT timetable_requirements_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_subject_groups ADD CONSTRAINT timetable_subject_groups_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_substitutions ADD CONSTRAINT timetable_substitutions_absent_teacher_id_fkey FOREIGN KEY (absent_teacher_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_substitutions ADD CONSTRAINT timetable_substitutions_cover_teacher_id_fkey FOREIGN KEY (cover_teacher_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_substitutions ADD CONSTRAINT timetable_substitutions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_substitutions ADD CONSTRAINT timetable_substitutions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES timetable_lessons(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_substitutions ADD CONSTRAINT timetable_substitutions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.timetable_versions ADD CONSTRAINT timetable_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.timetable_versions ADD CONSTRAINT timetable_versions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transport_crew ADD CONSTRAINT transport_crew_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transport_crew ADD CONSTRAINT transport_crew_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.transport_routes ADD CONSTRAINT transport_routes_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES transport_crew(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.transport_routes ADD CONSTRAINT transport_routes_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transport_routes ADD CONSTRAINT transport_routes_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.trip_boardings ADD CONSTRAINT trip_boardings_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.trip_boardings ADD CONSTRAINT trip_boardings_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trip_boardings ADD CONSTRAINT trip_boardings_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.trip_boardings ADD CONSTRAINT trip_boardings_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trips ADD CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES transport_crew(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.trips ADD CONSTRAINT trips_route_id_fkey FOREIGN KEY (route_id) REFERENCES transport_routes(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.trips ADD CONSTRAINT trips_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.trips ADD CONSTRAINT trips_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_duties ADD CONSTRAINT user_duties_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.user_duties ADD CONSTRAINT user_duties_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_duties ADD CONSTRAINT user_duties_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_signatures ADD CONSTRAINT user_signatures_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_signatures ADD CONSTRAINT user_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users ADD CONSTRAINT users_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.vehicle_logs ADD CONSTRAINT vehicle_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.vehicle_logs ADD CONSTRAINT vehicle_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.vehicle_logs ADD CONSTRAINT vehicle_logs_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.vehicle_positions ADD CONSTRAINT vehicle_positions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.vehicle_positions ADD CONSTRAINT vehicle_positions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.vehicles ADD CONSTRAINT vehicles_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.vote_heads ADD CONSTRAINT vote_heads_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- ======================================================================
-- 8. Indexes
-- ======================================================================

CREATE INDEX assignments_school_due_idx ON public.assignments USING btree (school_id, due_date);
CREATE INDEX audit_log_entity ON public.audit_log USING btree (school_id, entity, entity_id);
CREATE INDEX audit_log_school_time ON public.audit_log USING btree (school_id, created_at DESC);
CREATE INDEX clinic_visits_school_time ON public.clinic_visits USING btree (school_id, visited_at DESC);
CREATE INDEX competency_assessments_lookup ON public.competency_assessments USING btree (school_id, subject_id, term_id);
CREATE INDEX discipline_incidents_student ON public.discipline_incidents USING btree (school_id, student_id);
CREATE INDEX dorm_allocations_dorm ON public.dorm_allocations USING btree (dorm_id) WHERE (ended_on IS NULL);
CREATE INDEX exam_mark_history_exam_student_idx ON public.exam_mark_history USING btree (exam_id, student_id, changed_at DESC);
CREATE INDEX exam_paper_reviews_paper ON public.exam_paper_reviews USING btree (paper_id, created_at);
CREATE INDEX exam_papers_school_status ON public.exam_papers USING btree (school_id, status);
CREATE INDEX exeats_school_status ON public.exeats USING btree (school_id, status);
CREATE INDEX expenses_school_date ON public.expenses USING btree (school_id, expense_date DESC);
CREATE INDEX fee_awards_student_term ON public.fee_awards USING btree (student_id, term_id);
CREATE INDEX idx_attendance_notifications_school_date ON public.attendance_notifications USING btree (school_id, date);
CREATE INDEX idx_attendance_notifications_student_date ON public.attendance_notifications USING btree (student_id, date);
CREATE INDEX idx_daily_attendance_school_date ON public.daily_attendance USING btree (school_id, date);
CREATE INDEX idx_daily_attendance_student_date ON public.daily_attendance USING btree (student_id, date);
CREATE INDEX idx_emc_exam_id ON public.exam_mark_components USING btree (exam_id);
CREATE INDEX idx_emc_student_id ON public.exam_mark_components USING btree (student_id);
CREATE INDEX idx_esc_scheme_id ON public.exam_subject_components USING btree (scheme_id);
CREATE INDEX idx_escs_exam_id ON public.exam_subject_component_schemes USING btree (exam_id);
CREATE INDEX idx_exam_marks_student ON public.exam_marks USING btree (student_id);
CREATE INDEX idx_exams_grade ON public.exams USING btree (grade_id);
CREATE INDEX idx_exams_school_term ON public.exams USING btree (school_id, term_id);
CREATE INDEX idx_exams_status ON public.exams USING btree (status);
CREATE INDEX idx_fee_payments_school_id ON public.fee_payments USING btree (school_id);
CREATE INDEX idx_fee_payments_student_fee_id ON public.fee_payments USING btree (student_fee_id);
CREATE INDEX idx_grading_systems_school ON public.grading_systems USING btree (school_id);
CREATE INDEX idx_invite_codes_code ON public.invite_codes USING btree (code);
CREATE INDEX idx_invite_codes_school ON public.invite_codes USING btree (school_id);
CREATE INDEX idx_invite_codes_user ON public.invite_codes USING btree (user_id);
CREATE INDEX idx_school_bank_accounts_school_id ON public.school_bank_accounts USING btree (school_id);
CREATE INDEX idx_school_sections_school ON public.school_sections USING btree (school_id, sort_order);
CREATE INDEX idx_school_subjects_school ON public.school_subjects USING btree (school_id);
CREATE INDEX idx_school_subjects_subject ON public.school_subjects USING btree (subject_id);
CREATE INDEX idx_schools_approval_status ON public.schools USING btree (approval_status);
CREATE INDEX idx_scs_combination_id ON public.subject_combination_subjects USING btree (combination_id);
CREATE INDEX idx_scs_subject_id ON public.subject_combination_subjects USING btree (subject_id);
CREATE INDEX idx_student_fees_term ON public.student_fees USING btree (term_id);
CREATE INDEX idx_student_goals_student ON public.student_goals USING btree (student_id);
CREATE INDEX idx_student_promotion_runs_school ON public.student_promotion_runs USING btree (school_id, created_at DESC);
CREATE INDEX idx_student_promotions_student ON public.student_promotions USING btree (student_id);
CREATE INDEX idx_student_subjects_school_id ON public.student_subjects USING btree (school_id);
CREATE INDEX idx_student_subjects_student_id ON public.student_subjects USING btree (student_id);
CREATE INDEX idx_student_subjects_subject_id ON public.student_subjects USING btree (subject_id);
CREATE INDEX idx_students_grade_stream ON public.students USING btree (current_grade_stream_id);
CREATE INDEX idx_students_subject_combination_id ON public.students USING btree (subject_combination_id);
CREATE INDEX idx_subject_combinations_school_id ON public.subject_combinations USING btree (school_id);
CREATE INDEX idx_user_signatures_school ON public.user_signatures USING btree (school_id);
CREATE INDEX idx_users_school ON public.users USING btree (school_id);
CREATE INDEX invoice_lines_invoice ON public.invoice_lines USING btree (invoice_id);
CREATE INDEX lesson_plans_teacher ON public.lesson_plans USING btree (school_id, teacher_id, lesson_date DESC);
CREATE INDEX library_books_school_title ON public.library_books USING btree (school_id, title);
CREATE INDEX library_loans_open ON public.library_loans USING btree (book_id) WHERE (returned_on IS NULL);
CREATE INDEX records_of_work_stream_subject ON public.records_of_work USING btree (school_id, grade_stream_id, subject_id);
CREATE INDEX route_stops_route ON public.route_stops USING btree (route_id, sequence);
CREATE INDEX schemes_of_work_teacher ON public.schemes_of_work USING btree (school_id, teacher_id);
CREATE INDEX school_events_school_date ON public.school_events USING btree (school_id, starts_on);
CREATE INDEX student_guardians_parent ON public.student_guardians USING btree (parent_user_id);
CREATE INDEX timetable_lessons_teacher ON public.timetable_lessons USING btree (version_id, teacher_id, day, period);
CREATE INDEX timetable_subject_groups_school_idx ON public.timetable_subject_groups USING btree (school_id);
CREATE INDEX trips_school_time ON public.trips USING btree (school_id, scheduled_at DESC);
CREATE INDEX user_duties_user ON public.user_duties USING btree (user_id, school_id);
CREATE INDEX vehicle_positions_trip_time ON public.vehicle_positions USING btree (trip_id, recorded_at);
CREATE UNIQUE INDEX dorm_allocations_one_active ON public.dorm_allocations USING btree (student_id) WHERE (ended_on IS NULL);
CREATE UNIQUE INDEX idx_fee_payments_mpesa_checkout ON public.fee_payments USING btree (mpesa_checkout_request_id) WHERE (mpesa_checkout_request_id IS NOT NULL);
CREATE UNIQUE INDEX idx_fee_payments_pesapal_order_tracking ON public.fee_payments USING btree (pesapal_order_tracking_id) WHERE (pesapal_order_tracking_id IS NOT NULL);
CREATE UNIQUE INDEX idx_fee_payments_school_mpesa_receipt ON public.fee_payments USING btree (school_id, mpesa_receipt_number) WHERE ((mpesa_receipt_number IS NOT NULL) AND (status <> 'CANCELLED'::fee_payment_status));
CREATE UNIQUE INDEX students_portal_token_key ON public.students USING btree (portal_token);
CREATE UNIQUE INDEX subjects_custom_code_key ON public.subjects USING btree (origin_school_id, upper(TRIM(BOTH FROM code))) WHERE (origin_school_id IS NOT NULL);
CREATE UNIQUE INDEX subjects_standard_code_key ON public.subjects USING btree (upper(TRIM(BOTH FROM code))) WHERE (origin_school_id IS NULL);
CREATE UNIQUE INDEX timetable_lessons_class_slot_subject ON public.timetable_lessons USING btree (version_id, grade_stream_id, day, period, subject_id);
CREATE UNIQUE INDEX timetable_versions_one_published ON public.timetable_versions USING btree (school_id) WHERE (status = 'PUBLISHED'::text);
CREATE UNIQUE INDEX trips_one_live_per_vehicle ON public.trips USING btree (vehicle_id) WHERE (status = 'IN_PROGRESS'::text);
CREATE UNIQUE INDEX uq_student_promotion_runs_live ON public.student_promotion_runs USING btree (school_id, academic_year_id) WHERE (undone_at IS NULL);
CREATE UNIQUE INDEX user_duties_unique ON public.user_duties USING btree (school_id, user_id, duty, COALESCE(scope_type, ''::text), COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ======================================================================
-- 9. Views
-- ======================================================================

CREATE VIEW public.school_subject_catalogue WITH (security_invoker=on) AS
 SELECT ss.school_id,
    ss.grading_system_id,
    ss.id AS offering_id,
    s.id,
    s.code,
    s.name,
    s.academic_level_id,
    s.subject_type,
    s.display_order,
    s.category,
    s.band,
    s.origin_school_id,
    s.created_at
   FROM school_subjects ss
     JOIN subjects s ON s.id = ss.subject_id;

-- ======================================================================
-- 10. Comments
-- ======================================================================

COMMENT ON COLUMN public.schools.cbc_ranking_enabled IS 'Print positions on CBC report cards. Off by default, following KNEC''s no-ranking policy for competency-based assessment.';
COMMENT ON COLUMN public.schools.senior_rank_group IS 'CBC Senior School overall-position pool: GRADE (all learners), PATHWAY, or COMBINATION — across every stream.';
COMMENT ON COLUMN public.subjects.band IS 'Curriculum band: PP, LP, UP, JS, SS (CBC) or SEC (8-4-4). academic_levels has a single CBC row spanning Grade 1 to Grade 12, so it cannot tell a Grade 4 subject from a Grade 12 one; this can.';
COMMENT ON COLUMN public.subjects.origin_school_id IS 'NULL means a standard subject every school can offer. Set means a subject one school invented, visible only to that school.';
COMMENT ON TABLE public.subjects_merge_audit IS 'Every subject_id rewritten when duplicate subject rows were merged onto one catalogue row. Kept so the merge can be replayed backwards.';
COMMENT ON TABLE public.school_subjects IS 'Which subjects each school offers, and how it grades them. Replaces subjects.school_id and subjects.grading_system_id.';
COMMENT ON VIEW public.school_subject_catalogue IS 'One row per subject a school offers, flattened so it reads like the old subjects table filtered by school_id.';

-- ======================================================================
-- 11. Triggers
-- ======================================================================

CREATE TRIGGER exam_mark_components_term_lock BEFORE INSERT OR DELETE OR UPDATE ON public.exam_mark_components FOR EACH ROW EXECUTE FUNCTION enforce_term_mark_lock();
CREATE TRIGGER trigger_touch_exam_mark_component BEFORE UPDATE ON public.exam_mark_components FOR EACH ROW EXECUTE FUNCTION touch_exam_mark_component();
CREATE TRIGGER exam_marks_history AFTER INSERT OR DELETE OR UPDATE ON public.exam_marks FOR EACH ROW EXECUTE FUNCTION log_exam_mark_change();
CREATE TRIGGER exam_marks_term_lock BEFORE INSERT OR DELETE OR UPDATE ON public.exam_marks FOR EACH ROW EXECUTE FUNCTION enforce_term_mark_lock();
CREATE TRIGGER trigger_calculate_exam_mark_grade BEFORE INSERT OR UPDATE ON public.exam_marks FOR EACH ROW EXECUTE FUNCTION calculate_exam_mark_grade();
CREATE TRIGGER trigger_sync_student_fee_totals AFTER INSERT OR DELETE OR UPDATE OF amount, status, student_fee_id ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION sync_student_fee_totals();
CREATE TRIGGER library_loans_check_available BEFORE INSERT ON public.library_loans FOR EACH ROW EXECUTE FUNCTION library_loans_check_available();
CREATE TRIGGER medication_logs_take_stock AFTER INSERT ON public.medication_logs FOR EACH ROW EXECUTE FUNCTION medication_logs_take_stock();
CREATE TRIGGER trigger_generate_school_invite_codes BEFORE INSERT ON public.schools FOR EACH ROW EXECUTE FUNCTION generate_school_invite_codes();
CREATE TRIGGER trigger_touch_student_subject BEFORE UPDATE ON public.student_subjects FOR EACH ROW EXECUTE FUNCTION touch_student_subject();
CREATE TRIGGER trigger_set_student_school_id BEFORE INSERT OR UPDATE OF id ON public.students FOR EACH ROW EXECUTE FUNCTION set_student_school_id();
CREATE TRIGGER trigger_touch_subject_combination BEFORE UPDATE ON public.subject_combinations FOR EACH ROW EXECUTE FUNCTION touch_subject_combination();
CREATE TRIGGER trigger_sync_student_school_id AFTER UPDATE OF school_id ON public.users FOR EACH ROW WHEN ((new.school_id IS DISTINCT FROM old.school_id)) EXECUTE FUNCTION sync_student_school_id();

-- ======================================================================
-- 12. Row-level security
-- ======================================================================

ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dorm_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dorm_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dorms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_mark_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_mark_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marking_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_paper_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subject_component_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subject_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structure_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_card_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_call_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_promotion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_combination_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects_merge_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_subject_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_boardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_heads ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- 13. Policies
-- ======================================================================

CREATE POLICY "Admins and class teachers can manage attendance notifications" ON public.attendance_notifications AS PERMISSIVE FOR ALL TO public USING ((get_my_role() = ANY (ARRAY['ADMIN'::user_role, 'CLASS_TEACHER'::user_role])));
CREATE POLICY "Admins and class teachers manage payments" ON public.fee_payments AS PERMISSIVE FOR ALL TO public USING (((get_my_role() = ANY (ARRAY['ADMIN'::user_role, 'CLASS_TEACHER'::user_role])) AND (school_id = ( SELECT users.school_id
   FROM users
  WHERE (users.id = (auth.uid())::text)))));
CREATE POLICY "Admins and exam creators manage component schemes" ON public.exam_subject_component_schemes AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM exams e
  WHERE ((e.id = exam_subject_component_schemes.exam_id) AND (e.created_by_teacher_id = (auth.uid())::text)))) OR (get_my_role() = 'ADMIN'::user_role)));
CREATE POLICY "Admins and exam creators manage components" ON public.exam_subject_components AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM (exam_subject_component_schemes s
     JOIN exams e ON ((e.id = s.exam_id)))
  WHERE ((s.id = exam_subject_components.scheme_id) AND (e.created_by_teacher_id = (auth.uid())::text)))) OR (get_my_role() = 'ADMIN'::user_role)));
CREATE POLICY "Admins can create pending invites" ON public.pending_invites AS PERMISSIVE FOR INSERT TO public WITH CHECK ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins can create schools" ON public.schools AS PERMISSIVE FOR INSERT TO public WITH CHECK ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins can delete pending invites" ON public.pending_invites AS PERMISSIVE FOR DELETE TO public USING ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins can read pending invites" ON public.pending_invites AS PERMISSIVE FOR SELECT TO public USING ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins can update schools" ON public.schools AS PERMISSIVE FOR UPDATE TO public USING ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins have full access to students" ON public.students AS PERMISSIVE FOR ALL TO public USING ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins have full access to users" ON public.users AS PERMISSIVE FOR ALL TO public USING ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins manage bank accounts" ON public.school_bank_accounts AS PERMISSIVE FOR ALL TO public USING (((get_my_role() = 'ADMIN'::user_role) AND (school_id = ( SELECT users.school_id
   FROM users
  WHERE (users.id = (auth.uid())::text)))));
CREATE POLICY "Admins manage combination subjects" ON public.subject_combination_subjects AS PERMISSIVE FOR ALL TO public USING ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Admins manage payment settings" ON public.school_payment_settings AS PERMISSIVE FOR ALL TO public USING (((get_my_role() = 'ADMIN'::user_role) AND (school_id = ( SELECT users.school_id
   FROM users
  WHERE (users.id = (auth.uid())::text)))));
CREATE POLICY "Admins manage subject combinations" ON public.subject_combinations AS PERMISSIVE FOR ALL TO public USING ((get_my_role() = 'ADMIN'::user_role));
CREATE POLICY "Anyone can view announcements" ON public.announcements AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Anyone can view assignments" ON public.assignments AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Anyone can view exams" ON public.exams AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Anyone can view fees" ON public.student_fees AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Anyone can view learning_materials" ON public.learning_materials AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Anyone can view students" ON public.students AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Anyone can view submissions" ON public.assignment_submissions AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated read combination subjects" ON public.subject_combination_subjects AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated read component schemes" ON public.exam_subject_component_schemes AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated read components" ON public.exam_subject_components AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated read subject combinations" ON public.subject_combinations AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Authenticated users can view student_goals" ON public.student_goals AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Class teachers and admins manage subject enrollments" ON public.student_subjects AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM (class_teachers ct
     JOIN students s ON ((s.current_grade_stream_id = ct.current_grade_stream_id)))
  WHERE ((ct.user_id = (auth.uid())::text) AND (s.id = student_subjects.student_id)))) OR (get_my_role() = 'ADMIN'::user_role)));
CREATE POLICY "Classes are viewable by all authenticated users." ON public.classes AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read academic_levels" ON public.academic_levels AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read academic_years" ON public.academic_years AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read grade_streams" ON public.grade_streams AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read grades" ON public.grades AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read grading_systems" ON public.grading_systems AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read school_subjects" ON public.school_subjects AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read schools" ON public.schools AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read subjects" ON public.subjects AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Public read terms" ON public.terms AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Service role can do everything on invite_codes" ON public.invite_codes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Students can manage their own goals" ON public.student_goals AS PERMISSIVE FOR ALL TO public USING ((get_my_role() = 'STUDENT'::user_role));
CREATE POLICY "Students view their own component marks" ON public.exam_mark_components AS PERMISSIVE FOR SELECT TO public USING (((student_id = (auth.uid())::text) OR (get_my_role() = ANY (ARRAY['ADMIN'::user_role, 'SUBJECT_TEACHER'::user_role, 'CLASS_TEACHER'::user_role]))));
CREATE POLICY "Students view their own payments" ON public.fee_payments AS PERMISSIVE FOR SELECT TO public USING ((student_fee_id IN ( SELECT student_fees.id
   FROM student_fees
  WHERE (student_fees.student_id = (auth.uid())::text))));
CREATE POLICY "Students view their own subject enrollments" ON public.student_subjects AS PERMISSIVE FOR SELECT TO public USING (((student_id = (auth.uid())::text) OR (get_my_role() = ANY (ARRAY['ADMIN'::user_role, 'SUBJECT_TEACHER'::user_role, 'CLASS_TEACHER'::user_role]))));
CREATE POLICY "Subject teachers can create/update their exams" ON public.exams AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM subject_teacher_assignments sta
  WHERE ((sta.subject_teacher_id = auth.uid()) AND (sta.subject_id = exams.subject_id) AND (sta.grade_id = exams.grade_id)))) OR (get_my_role() = 'ADMIN'::user_role)));
CREATE POLICY "Teachers and admins can manage attendance" ON public.daily_attendance AS PERMISSIVE FOR ALL TO public USING ((get_my_role() = ANY (ARRAY['ADMIN'::user_role, 'CLASS_TEACHER'::user_role, 'SUBJECT_TEACHER'::user_role])));
CREATE POLICY "Teachers manage component marks for their exams" ON public.exam_mark_components AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM exams e
  WHERE ((e.id = exam_mark_components.exam_id) AND (e.created_by_teacher_id = (auth.uid())::text)))) OR (get_my_role() = 'ADMIN'::user_role)));
CREATE POLICY "Users can read all users (directory)" ON public.users AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Users can view attendance in their school" ON public.daily_attendance AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Users can view attendance notifications in their school" ON public.attendance_notifications AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "Users view their school's bank accounts" ON public.school_bank_accounts AS PERMISSIVE FOR SELECT TO public USING ((school_id = ( SELECT users.school_id
   FROM users
  WHERE (users.id = (auth.uid())::text))));

-- ======================================================================
-- 14. Grants
-- ======================================================================

-- Tables, views and sequences: the server's service role only.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, UPDATE, USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Functions: the service role only…
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
-- …except these two trigger functions, executable by everyone as live
-- (a trigger function cannot be called directly).
GRANT EXECUTE ON FUNCTION public.enforce_term_mark_lock() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_exam_mark_change() TO PUBLIC, anon, authenticated;

-- ======================================================================
-- 15. Enable RLS on every new table automatically
-- ======================================================================

CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    EXECUTE FUNCTION public.rls_auto_enable();

-- ======================================================================
-- 16. Storage buckets
-- ======================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
    ('assignment-files', 'assignment-files', true, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/plain;charset=utf-8', 'text/plain;charset=UTF-8']),
    ('exam-papers', 'exam-papers', false, 15728640, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('photos', 'photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg', 'image/pjpeg'])
ON CONFLICT (id) DO NOTHING;
