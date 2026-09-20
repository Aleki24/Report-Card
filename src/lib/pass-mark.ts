/**
 * The mark at or above which a result counts as a pass.
 *
 * It lived as a private constant in /api/school/stats and again in
 * /api/school/dashboard, and the mobile analytics screen hard-codes 50 a third
 * time. The web and mobile dashboards show the same "pass rate" to the same
 * admin, so they have to agree on what passing means; one exported constant is
 * how they stay agreed. It is also passed into `school_mark_summary` rather
 * than duplicated in SQL.
 */
export const PASS_MARK = 50;
