/**
 * Self-service account deletion, shared by the web (/delete-account) and the
 * mobile app (Profile → Delete account). Client-safe: no server imports, so
 * the app can use it through `@shared/account-deletion`.
 */

/** What the person types to confirm; a tap alone is too easy to make by mistake. */
export const DELETE_CONFIRMATION_WORD = 'DELETE';

export const ACCOUNT_DELETION_ENDPOINT = '/api/account' as const;

/** Body of DELETE /api/account. */
export interface DeleteAccountRequest {
  confirm: typeof DELETE_CONFIRMATION_WORD;
}

/**
 * A learner's account is also the school's learner record: marks,
 * attendance, report cards, fee statements and payment receipts hang off it,
 * and the school must keep them. So a learner's deletion removes the sign-in
 * and contact details and keeps the record; everyone else's removes the
 * account and what is only theirs.
 */
export type DeletionKind = 'learner' | 'member';

export function deletionKindForRole(role: string | null | undefined): DeletionKind {
  return role === 'STUDENT' ? 'learner' : 'member';
}

export interface DeletionSummary {
  /** What is removed, shown before the person confirms. */
  deleted: readonly string[];
  /** What stays, and why, so the request is honest about it. */
  retained: readonly string[];
}

const PRINTED_COPIES = 'Paper or PDF report cards already printed or shared by the school';

export const DELETION_SUMMARY: Readonly<Record<DeletionKind, DeletionSummary>> = {
  member: {
    deleted: [
      'Your sign-in (email, password and Google link)',
      'Your profile: name, phone, photo and job title',
      'Records that are only yours: your duties and class assignments, leave requests, lesson plans and schemes of work, and the links to your children',
    ],
    retained: [
      'Records you created for the school (announcements, marks you entered, payments you recorded) stay with the school, no longer linked to your name',
      PRINTED_COPIES,
    ],
  },
  learner: {
    deleted: [
      'Your sign-in (email or username, password and Google link)',
      'Your phone number and photo',
    ],
    retained: [
      'Your school keeps your learner record (name, admission number, marks, attendance and report cards), as schools are required to',
      'Fee statements and payment receipts the law requires the school to keep',
      PRINTED_COPIES,
    ],
  },
};

export function isDeleteConfirmation(value: string): boolean {
  return value.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;
}
