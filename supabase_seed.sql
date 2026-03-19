-- ============================================================
-- SEED DATA: Academic Levels, Grades, Streams, Subjects,
--            Grading Systems, Academic Year & Terms
-- Run this in the Supabase SQL Editor AFTER the schema.
-- Uses ON CONFLICT so it is safe to re-run.
-- ============================================================


-- ── 1. ACADEMIC LEVELS ──────────────────────────────────────

INSERT INTO academic_levels (code, name, description) VALUES
  ('CBC', 'Competency Based Curriculum', 'Pre-primary through Grade 12 (2-6-3-3 structure)'),
  ('844', '8-4-4 System',               '8 years primary, 4 years secondary, 4 years university')
ON CONFLICT (code) DO NOTHING;


-- ── 2. GRADES ───────────────────────────────────────────────

DO $$
DECLARE
  v_cbc UUID;
  v_844 UUID;
BEGIN
  SELECT id INTO v_cbc FROM academic_levels WHERE code = 'CBC';
  SELECT id INTO v_844 FROM academic_levels WHERE code = '844';

  -- CBC grades: PP1–PP2, Grade 1–12
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

  -- 8-4-4 grades: Standard 1–8, Form 1–4
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


-- ── 3. GRADE STREAMS (sample streams) ──────────────────────

DO $$
DECLARE
  v_id UUID;
BEGIN
  -- CBC Grade 7
  SELECT id INTO v_id FROM grades WHERE code = 'G7';
  IF v_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name) VALUES
      (v_id, 'A', 'Grade 7A'), (v_id, 'B', 'Grade 7B')
    ON CONFLICT (grade_id, name) DO NOTHING;
  END IF;

  -- CBC Grade 8
  SELECT id INTO v_id FROM grades WHERE code = 'G8';
  IF v_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name) VALUES
      (v_id, 'A', 'Grade 8A'), (v_id, 'B', 'Grade 8B')
    ON CONFLICT (grade_id, name) DO NOTHING;
  END IF;

  -- 8-4-4 Form 1
  SELECT id INTO v_id FROM grades WHERE code = 'F1';
  IF v_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name) VALUES
      (v_id, 'A', 'Form 1A'), (v_id, 'B', 'Form 1B')
    ON CONFLICT (grade_id, name) DO NOTHING;
  END IF;

  -- 8-4-4 Form 2
  SELECT id INTO v_id FROM grades WHERE code = 'F2';
  IF v_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name) VALUES
      (v_id, 'A', 'Form 2A'), (v_id, 'B', 'Form 2B')
    ON CONFLICT (grade_id, name) DO NOTHING;
  END IF;

  -- 8-4-4 Form 3
  SELECT id INTO v_id FROM grades WHERE code = 'F3';
  IF v_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name) VALUES
      (v_id, 'A', 'Form 3A')
    ON CONFLICT (grade_id, name) DO NOTHING;
  END IF;

  -- 8-4-4 Form 4
  SELECT id INTO v_id FROM grades WHERE code = 'F4';
  IF v_id IS NOT NULL THEN
    INSERT INTO grade_streams (grade_id, name, full_name) VALUES
      (v_id, 'A', 'Form 4A')
    ON CONFLICT (grade_id, name) DO NOTHING;
  END IF;
END $$;


-- ── 4. SUBJECTS & LEARNING AREAS ───────────────────────────

DO $$
DECLARE
  v_cbc UUID;
  v_844 UUID;
BEGIN
  SELECT id INTO v_cbc FROM academic_levels WHERE code = 'CBC';
  SELECT id INTO v_844 FROM academic_levels WHERE code = '844';

  -- ─── CBC LEARNING AREAS ──────────────────────────────────

  -- Lower Primary (Grades 1–3) — compulsory
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('CBC-IND',  'Indigenous Language',               v_cbc, true,  1),
    ('CBC-KSW',  'Kiswahili / KSL',                  v_cbc, true,  2),
    ('CBC-ENG',  'English',                           v_cbc, true,  3),
    ('CBC-MAT',  'Mathematics',                       v_cbc, true,  4),
    ('CBC-RE',   'Religious Education',               v_cbc, true,  5),
    ('CBC-ENV',  'Environmental Activities',          v_cbc, true,  6),
    ('CBC-HYG',  'Hygiene and Nutrition',             v_cbc, true,  7),
    ('CBC-CRA',  'Creative Activities',               v_cbc, true,  8),
    ('CBC-PPI',  'Pastoral Programme of Instruction', v_cbc, true,  9)
  ON CONFLICT (code) DO NOTHING;

  -- Upper Primary (Grades 4–6)
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('CBC-SCI',  'Science and Technology',            v_cbc, true,  10),
    ('CBC-SS',   'Social Studies',                    v_cbc, true,  11),
    ('CBC-AGN',  'Agriculture and Nutrition',         v_cbc, true,  12),
    ('CBC-CART', 'Creative Arts',                     v_cbc, true,  13)
  ON CONFLICT (code) DO NOTHING;

  -- Junior School (Grades 7–9)
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('CBC-IS',   'Integrated Science',                v_cbc, true,  14),
    ('CBC-HE',   'Health Education',                  v_cbc, true,  15),
    ('CBC-SSL',  'Social Studies and Life Skills',    v_cbc, true,  16),
    ('CBC-PTC',  'Pre-Technical and Pre-Career Education', v_cbc, true, 17),
    ('CBC-CAS',  'Creative Arts and Sports',          v_cbc, true,  18)
  ON CONFLICT (code) DO NOTHING;

  -- Senior School — Core (Grades 10–12)
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('CBC-CSL',  'Community Service Learning',        v_cbc, true,  19),
    ('CBC-PE',   'Physical Education',                v_cbc, true,  20),
    ('CBC-ICT',  'ICT Skills',                        v_cbc, true,  21)
  ON CONFLICT (code) DO NOTHING;

  -- Senior School — STEM Pathway
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('CBC-BIO',  'Biology',                           v_cbc, false, 30),
    ('CBC-CHE',  'Chemistry',                         v_cbc, false, 31),
    ('CBC-PHY',  'Physics',                           v_cbc, false, 32),
    ('CBC-CS',   'Computer Science',                  v_cbc, false, 33),
    ('CBC-AGR',  'Agriculture',                       v_cbc, false, 34),
    ('CBC-ET',   'Engineering Technology',            v_cbc, false, 35),
    ('CBC-AVI',  'Aviation',                          v_cbc, false, 36),
    ('CBC-PM',   'Power Mechanics',                   v_cbc, false, 37)
  ON CONFLICT (code) DO NOTHING;

  -- Senior School — Social Sciences Pathway
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('CBC-LIT',  'Literature',                        v_cbc, false, 40),
    ('CBC-AENG', 'Advanced English',                  v_cbc, false, 41),
    ('CBC-ARB',  'Arabic',                            v_cbc, false, 42),
    ('CBC-FRE',  'French',                            v_cbc, false, 43),
    ('CBC-GER',  'German',                            v_cbc, false, 44),
    ('CBC-MAN',  'Mandarin',                          v_cbc, false, 45),
    ('CBC-HC',   'History and Citizenship',           v_cbc, false, 46),
    ('CBC-GEO',  'Geography',                         v_cbc, false, 47),
    ('CBC-BE',   'Business Education',                v_cbc, false, 48)
  ON CONFLICT (code) DO NOTHING;

  -- Senior School — Arts & Sports Science Pathway
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('CBC-VA',   'Visual Arts',                       v_cbc, false, 50),
    ('CBC-PA',   'Performing Arts',                   v_cbc, false, 51),
    ('CBC-MUS',  'Music',                             v_cbc, false, 52),
    ('CBC-MT',   'Media Technology',                  v_cbc, false, 53),
    ('CBC-SPS',  'Sports Science',                    v_cbc, false, 54)
  ON CONFLICT (code) DO NOTHING;


  -- ─── 8-4-4 SUBJECTS ──────────────────────────────────────

  -- Primary (Standard 1–8) — core
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('844-MAT',  'Mathematics',                       v_844, true,  1),
    ('844-ENG',  'English',                           v_844, true,  2),
    ('844-KSW',  'Kiswahili',                         v_844, true,  3),
    ('844-SCI',  'Science',                           v_844, true,  4),
    ('844-SS',   'Social Studies',                    v_844, true,  5),
    ('844-CRE',  'Christian Religious Education',     v_844, true,  6),
    ('844-IRE',  'Islamic Religious Education',       v_844, false, 7),
    ('844-HRE',  'Hindu Religious Education',         v_844, false, 8),
    ('844-CART', 'Creative Arts',                     v_844, true,  9),
    ('844-PE',   'Physical Education',                v_844, true,  10),
    ('844-LS',   'Life Skills',                       v_844, true,  11),
    ('844-AGR',  'Agriculture',                       v_844, false, 12)
  ON CONFLICT (code) DO NOTHING;

  -- Secondary — Languages
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('844-ARB',  'Arabic',                            v_844, false, 20),
    ('844-GER',  'German',                            v_844, false, 21),
    ('844-FRE',  'French',                            v_844, false, 22)
  ON CONFLICT (code) DO NOTHING;

  -- Secondary — Sciences
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('844-BIO',  'Biology',                           v_844, false, 30),
    ('844-CHE',  'Chemistry',                         v_844, false, 31),
    ('844-PHY',  'Physics',                           v_844, false, 32)
  ON CONFLICT (code) DO NOTHING;

  -- Secondary — Applied Sciences
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('844-HS',   'Home Science',                      v_844, false, 33),
    ('844-CS',   'Computer Studies',                  v_844, false, 34)
  ON CONFLICT (code) DO NOTHING;

  -- Secondary — Humanities
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('844-HIS',  'History and Government',            v_844, false, 40),
    ('844-GEO',  'Geography',                         v_844, false, 41),
    ('844-BS',   'Business Studies',                  v_844, false, 42)
  ON CONFLICT (code) DO NOTHING;

  -- Secondary — Creative Arts
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('844-MUS',  'Music',                             v_844, false, 50),
    ('844-AD',   'Art and Design',                    v_844, false, 51)
  ON CONFLICT (code) DO NOTHING;

  -- Secondary — Technical
  INSERT INTO subjects (code, name, academic_level_id, is_compulsory, display_order) VALUES
    ('844-WW',   'Woodwork',                          v_844, false, 60),
    ('844-MW',   'Metal Work',                        v_844, false, 61),
    ('844-BC',   'Building Construction',             v_844, false, 62),
    ('844-PM',   'Power Mechanics',                   v_844, false, 63),
    ('844-AVI',  'Aviation',                          v_844, false, 64)
  ON CONFLICT (code) DO NOTHING;
END $$;


-- ── 5. GRADING SYSTEMS & SCALES ────────────────────────────

DO $$
DECLARE
  v_cbc UUID;
  v_844 UUID;
  v_gs_cbc UUID;
  v_gs_844 UUID;
BEGIN
  SELECT id INTO v_cbc FROM academic_levels WHERE code = 'CBC';
  SELECT id INTO v_844 FROM academic_levels WHERE code = '844';

  -- CBC grading system
  INSERT INTO grading_systems (academic_level_id, name, description)
  VALUES (v_cbc, 'CBC Default Grading', 'Competency-based rubric levels: EE, ME, AE, BE')
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_gs_cbc FROM grading_systems WHERE academic_level_id = v_cbc LIMIT 1;

  IF v_gs_cbc IS NOT NULL THEN
    -- Only insert if no scales exist yet
    IF NOT EXISTS (SELECT 1 FROM grading_scales WHERE grading_system_id = v_gs_cbc LIMIT 1) THEN
      INSERT INTO grading_scales (grading_system_id, min_percentage, max_percentage, symbol, label, points, order_index) VALUES
        (v_gs_cbc, 75.00, 100.00, 'EE', 'Exceeding Expectations',  4, 1),
        (v_gs_cbc, 50.00,  74.99, 'ME', 'Meeting Expectations',     3, 2),
        (v_gs_cbc, 25.00,  49.99, 'AE', 'Approaching Expectations', 2, 3),
        (v_gs_cbc,  0.00,  24.99, 'BE', 'Below Expectations',       1, 4);
    END IF;
  END IF;

  -- 8-4-4 grading system (KCSE-style)
  INSERT INTO grading_systems (academic_level_id, name, description)
  VALUES (v_844, 'KCSE Grading', 'Kenya Certificate of Secondary Education grading: A to E')
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_gs_844 FROM grading_systems WHERE academic_level_id = v_844 LIMIT 1;

  IF v_gs_844 IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM grading_scales WHERE grading_system_id = v_gs_844 LIMIT 1) THEN
      INSERT INTO grading_scales (grading_system_id, min_percentage, max_percentage, symbol, label, points, order_index) VALUES
        (v_gs_844, 80.00, 100.00, 'A',  'Excellent',       12, 1),
        (v_gs_844, 75.00,  79.99, 'A-', 'Very Good',       11, 2),
        (v_gs_844, 70.00,  74.99, 'B+', 'Good',            10, 3),
        (v_gs_844, 65.00,  69.99, 'B',  'Quite Good',       9, 4),
        (v_gs_844, 60.00,  64.99, 'B-', 'Above Average',    8, 5),
        (v_gs_844, 55.00,  59.99, 'C+', 'Average Plus',     7, 6),
        (v_gs_844, 50.00,  54.99, 'C',  'Average',          6, 7),
        (v_gs_844, 45.00,  49.99, 'C-', 'Below Average',    5, 8),
        (v_gs_844, 40.00,  44.99, 'D+', 'Weak Plus',        4, 9),
        (v_gs_844, 35.00,  39.99, 'D',  'Weak',             3, 10),
        (v_gs_844, 30.00,  34.99, 'D-', 'Very Weak',        2, 11),
        (v_gs_844,  0.00,  29.99, 'E',  'Fail',             1, 12);
    END IF;
  END IF;
END $$;


-- ── 6. ACADEMIC YEAR & TERMS (2026) ────────────────────────

INSERT INTO academic_years (name, start_date, end_date)
VALUES ('2026', '2026-01-06', '2026-11-27')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  v_year UUID;
BEGIN
  SELECT id INTO v_year FROM academic_years WHERE name = '2026';
  IF v_year IS NOT NULL THEN
    INSERT INTO terms (academic_year_id, name, start_date, end_date, is_current) VALUES
      (v_year, 'Term 1', '2026-01-06', '2026-04-10', true),
      (v_year, 'Term 2', '2026-05-05', '2026-08-07', false),
      (v_year, 'Term 3', '2026-09-01', '2026-11-27', false)
    ON CONFLICT (academic_year_id, name) DO NOTHING;
  END IF;
END $$;


-- ============================================================
-- NOTES ON USERS:
-- Creating users requires inserting into auth.users (encrypted
-- passwords). The easiest way to test roles:
--   1. Sign up accounts via the app UI
--   2. Then assign roles:
--      UPDATE users SET role = 'ADMIN' WHERE email = '...';
-- ============================================================
