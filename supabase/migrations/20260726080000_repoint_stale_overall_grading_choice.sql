-- Point every school's "Overall grading" setting at the table it actually means.
--
-- The picker in Settings > Grading only offers OVERALL-kind systems, but it
-- also keeps whatever is already stored, so schools that made their choice
-- before that restriction still have an ordinary SUBJECT (percentage) table
-- recorded. Settings promises the setting "grades each student's total points
-- into an overall grade on report cards" — with a percentage table stored,
-- a learner on 54 points was graded on their 52% average instead, printing C
-- where the school's own points table says B- (50-56).
--
-- The report routes already fall back to the school's own OVERALL table, so
-- cards are correct either way; this makes the stored setting say what the
-- school means, so Settings and the printed card agree.
--
-- Only schools whose stored choice is NOT an overall table are touched, and
-- only where the school owns exactly one overall table for the same academic
-- level. Anything ambiguous is left alone for a human to decide.
UPDATE schools s
SET overall_grading_system_id = (
        SELECT gs.id
        FROM grading_systems gs
        WHERE gs.school_id = s.id
          AND gs.system_kind = 'OVERALL'
          AND gs.academic_level_id IS NOT DISTINCT FROM stored.academic_level_id
          AND EXISTS (SELECT 1 FROM grading_scales sc WHERE sc.grading_system_id = gs.id)
        LIMIT 1
    )
FROM grading_systems stored
WHERE s.overall_grading_system_id = stored.id
  AND stored.system_kind IS DISTINCT FROM 'OVERALL'
  AND (
      SELECT count(*)
      FROM grading_systems gs2
      WHERE gs2.school_id = s.id
        AND gs2.system_kind = 'OVERALL'
        AND gs2.academic_level_id IS NOT DISTINCT FROM stored.academic_level_id
        AND EXISTS (SELECT 1 FROM grading_scales sc2 WHERE sc2.grading_system_id = gs2.id)
  ) = 1;
