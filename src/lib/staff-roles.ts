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

/** Auth roles that teach: they enter marks and see class results. */
export const TEACHING_ROLES: readonly string[] = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER'];

/**
 * Every auth role that works in the school (teaching and non-teaching), as
 * opposed to learners and pending sign-ups.
 */
export const STAFF_ROLES: readonly string[] = [...TEACHING_ROLES, 'STAFF'];
