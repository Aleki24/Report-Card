-- KJSEA 8-Level Achievement System (2025/2026)
-- Run this in Supabase SQL Editor to add CBC grading for Junior Secondary

-- Step 1: Create KJSEA Grading System for CBC
INSERT INTO grading_systems (name, description, academic_level_id)
SELECT 'KJSEA 8-Level Achievement System', 'Kenya Junior Secondary Education Assessment - 8 level grading system', id
FROM academic_levels 
WHERE code = 'CBC'
ON CONFLICT DO NOTHING;

-- Step 2: Add the 8 grading scales
DO $$
DECLARE
    gs_id UUID;
BEGIN
    -- Get the KJSEA grading system ID
    SELECT id INTO gs_id 
    FROM grading_systems 
    WHERE name LIKE '%KJSEA%' 
    LIMIT 1;
    
    IF gs_id IS NOT NULL THEN
        -- Insert all 8 levels (ordered from highest to lowest)
        INSERT INTO grading_scales (grading_system_id, symbol, label, min_percentage, max_percentage, points, order_index) VALUES
        (gs_id, 'EE1', 'Exceeding Expectations - Exceptional', 90, 100, 8, 8),
        (gs_id, 'EE2', 'Exceeding Expectations - Very Good', 75, 89, 7, 7),
        (gs_id, 'ME1', 'Meeting Expectations - Good', 58, 74, 6, 6),
        (gs_id, 'ME2', 'Meeting Expectations - Satisfactory', 41, 57, 5, 5),
        (gs_id, 'AE1', 'Approaching Expectations - Needs Improvement', 31, 40, 4, 4),
        (gs_id, 'AE2', 'Approaching Expectations - Below Average', 21, 30, 3, 3),
        (gs_id, 'BE1', 'Below Expectations', 11, 20, 2, 2),
        (gs_id, 'BE2', 'Beginning', 1, 10, 1, 1)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'KJSEA 8-Level grading system added successfully for CBC!';
    ELSE
        RAISE WARNING 'CBC academic level not found. Please create CBC level first in Academic Structure.';
    END IF;
END $$;

-- Step 3: Verify it was added
SELECT 
    gs.name as grading_system,
    gs.academic_level_id,
    al.code as level_code,
    al.name as level_name,
    COUNT(gs2.id) as scales_count
FROM grading_systems gs
LEFT JOIN grading_scales gs2 ON gs2.grading_system_id = gs.id
LEFT JOIN academic_levels al ON al.id = gs.academic_level_id
WHERE gs.name LIKE '%KJSEA%'
GROUP BY gs.id, al.code, al.name;
