/** One learner on a subject's roster, as /api/admin/student-subjects returns it. Client-safe. */
export interface SubjectRosterEntry {
  id: string;
  admission_number: string | null;
  name: string;
  stream_id: string | null;
  stream_name: string | null;
  /** On a subject combination, which re-syncs their subjects and may undo manual changes. */
  in_combination: boolean;
  enrolled: boolean;
}
