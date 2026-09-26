/**
 * Options for the pickers every module form needs (a learner, a member of
 * staff, a class, a subject, a term). Client-safe types; served by
 * `/api/ops/lookups?type=…`.
 */
export const LOOKUP_TYPES = ['students', 'staff', 'streams', 'subjects', 'terms', 'years', 'grades', 'exams'] as const;
export type LookupType = (typeof LOOKUP_TYPES)[number];

export interface LookupOption {
    id: string;
    label: string;
    /** Secondary line: admission number and class, role, term dates… */
    hint?: string;
    /** Grouping key a form can filter by (a learner's class, a term's year). */
    group?: string;
}

export function isLookupType(value: unknown): value is LookupType {
    return typeof value === 'string' && (LOOKUP_TYPES as readonly string[]).includes(value);
}
