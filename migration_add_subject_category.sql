-- Add category and display_order to subjects for grouping in report cards
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Core',
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 10;

-- Update existing subjects to have sensible defaults
UPDATE subjects SET category = 'Languages', display_order = 1 WHERE name ILIKE '%English%' OR name ILIKE '%Kiswahili%';
UPDATE subjects SET category = 'Mathematics', display_order = 2 WHERE name ILIKE '%Math%';
UPDATE subjects SET category = 'Sciences', display_order = 3 WHERE name ILIKE '%Science%' OR name ILIKE '%Physics%' OR name ILIKE '%Chemistry%' OR name ILIKE '%Biology%';
UPDATE subjects SET category = 'Humanities', display_order = 4 WHERE name ILIKE '%History%' OR name ILIKE '%Geography%' OR name ILIKE '%CRE%' OR name ILIKE '%IRE%';
UPDATE subjects SET category = 'Technical', display_order = 5 WHERE name ILIKE '%Business%' OR name ILIKE '%Computer%' OR name ILIKE '%Agriculture%' OR name ILIKE '%Home Science%';
