/**
 * The mark at or above which a result counts as a pass, when a school has not
 * chosen its own.
 *
 * Each school can set its own in Settings (`schools.pass_mark`); the stats,
 * dashboard and analytics routes all read it through `getSchoolPassMark` (pass-mark-server.ts), so
 * the web and mobile dashboards still agree on what passing means. It is
 * passed into the rollup RPCs rather than duplicated in SQL.
 */
export const PASS_MARK = 50;

/** Bounds a school's pass mark must sit within; mirrored by a check constraint. */
export const PASS_MARK_MIN = 1;
export const PASS_MARK_MAX = 100;

/** A stored `schools.pass_mark` (numeric arrives as a string), or the default when unusable. */
export function passMarkOrDefault(stored: unknown): number {
    const value = Number(stored);
    return stored != null && Number.isFinite(value) && value >= PASS_MARK_MIN && value <= PASS_MARK_MAX ? value : PASS_MARK;
}
