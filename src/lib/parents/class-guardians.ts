/**
 * Shapes for linking a whole class's parents at once (Parent accounts →
 * Whole class). Client-safe.
 */

export interface ClassGuardianLink {
    name: string;
    phone: string | null;
    relationship: string | null;
}

export interface ClassGuardianLearner {
    id: string;
    name: string;
    admissionNumber: string | null;
    /** Contact typed on the learner's record, to start a link from. */
    recordName: string | null;
    recordPhone: string | null;
    links: ClassGuardianLink[];
}

export interface ClassLinkResult {
    student_id: string;
    ok: boolean;
    /** Linked to a parent already in the school (no new invite sent). */
    reused?: boolean;
    error?: string;
}

/** "Grace Wanjirũ Mwangi" → first "Grace", last "Wanjirũ Mwangi". */
export function splitName(full: string | null | undefined): { first: string; last: string } {
    const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
    return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

/** Most links a whole-class save sends at once. */
export const CLASS_LINK_LIMIT = 120;
