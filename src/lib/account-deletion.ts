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

/** What is removed, shown before the person confirms. */
export const DELETED_DATA: readonly string[] = [
  'Your sign-in (email, password and Google link)',
  'Your profile: name, phone, photo and job title',
  'Records linked only to you, such as a learner’s marks, attendance, fee statements and report cards',
];

/** What stays, and why, so the request is honest about it. */
export const RETAINED_DATA: readonly string[] = [
  'Records you created for the school (announcements, marks you entered, payments you recorded) stay with the school, no longer linked to your name',
  'Paper or PDF report cards already printed or shared by the school',
  'Payment receipts the law requires the school to keep',
];

export function isDeleteConfirmation(value: string): boolean {
  return value.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;
}
