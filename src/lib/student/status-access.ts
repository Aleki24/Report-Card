import type { StudentStatus } from '@/types';

/**
 * Learners whose school has marked them as gone. Their Clerk session outlives
 * the change and their users row stays active (is_active also means "has
 * activated"), so the learner's status is what shuts them out of the portal.
 * A graduate keeps read access to their own results.
 */
const LOCKED_OUT: ReadonlySet<StudentStatus> = new Set<StudentStatus>(['DEACTIVATED', 'TRANSFERRED']);

export function isLockedOutStudentStatus(status: string | null | undefined): boolean {
    return LOCKED_OUT.has(status as StudentStatus);
}

/**
 * Whether a learner's position is ranked among only the classmates still on
 * the roll. A learner on the roll is, so leavers who keep their last class do
 * not count. One who has left is ranked among the whole class, as when their
 * card was first printed: a class graduates together, and ranking a leaver
 * among only those still enrolled put them alone, "1 / 1".
 */
export function ranksAmongOnRoll(status: string | null | undefined): boolean {
    return (status ?? 'ACTIVE') === 'ACTIVE';
}

/**
 * Whether a learner has left the school (archived), so unused sign-in codes
 * stop working. A pending learner (awaiting promotion) has not left.
 */
export function hasLeftSchool(status: string | null | undefined): boolean {
    return status === 'TRANSFERRED' || status === 'GRADUATED' || status === 'DEACTIVATED';
}

/** Whether a learner must sit in a class: one on the roll, or pending promotion from it. */
export function needsClass(status: string | null | undefined): boolean {
    return !hasLeftSchool(status);
}

/** What a pending status means, for the forms that show it. */
export const PENDING_STATUS_HINT = 'Pending promotion: off class lists until decided under Classes → Promote students.';

export const LOCKED_OUT_STUDENT_MESSAGE = 'Your school has closed your learner account. Contact the school if this is a mistake.';
