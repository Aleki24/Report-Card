/**
 * Descriptive job titles for non-teaching STAFF members (role = 'STAFF').
 * These are labels stored in users.job_title — they are NOT auth roles, so
 * they don't grant any extra access. Kept in one place so the invite form and
 * the People directory offer the same list.
 */
export const STAFF_JOB_TITLES = [
    'Principal',
    'Deputy Principal',
    'Bursar',
    'Secretary',
    'Accountant',
    'Librarian',
    'Nurse',
    'Support Staff',
    'Other',
] as const;

export type StaffJobTitle = (typeof STAFF_JOB_TITLES)[number];
