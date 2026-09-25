/**
 * A class the signed-in user runs: every class for an admin, their own
 * class(es) for a class teacher. Registers, report cards, mark sheets and
 * report comments are all limited to these, so pages that do those things
 * list only these rather than every class the user can see.
 * Served by /api/school/managed-streams. Client-safe.
 */
export interface ManagedStream {
  id: string;
  full_name: string;
  grade_id: string | null;
}

export const MANAGED_STREAMS_URL = '/api/school/managed-streams';
