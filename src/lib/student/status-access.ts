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

export const LOCKED_OUT_STUDENT_MESSAGE = 'Your school has closed your learner account. Contact the school if this is a mistake.';
