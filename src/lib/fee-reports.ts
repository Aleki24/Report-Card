/**
 * The Fees page's reports: who owes (defaulters) and what came in
 * (collections). Client-safe.
 */

export interface Defaulter {
    studentId: string;
    name: string;
    admissionNumber: string | null;
    className: string | null;
    gradeStreamId: string | null;
    /** Owed across every term (arrears included). */
    owed: number;
    /** Terms with something still owing. */
    termsOwing: number;
    /** The earliest due date among the terms owing, YYYY-MM-DD. */
    oldestDue: string | null;
    lastPaymentAt: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
}

/** GET /api/school/fees/defaulters */
export interface DefaultersResponse {
    data: Defaulter[];
    totalOwed: number;
}

export interface CollectionBucket {
    key: string;
    label: string;
    amount: number;
    count: number;
}

/** GET /api/school/fees/collections?from=&to= (YYYY-MM-DD, inclusive). */
export interface CollectionsResponse {
    from: string;
    to: string;
    total: number;
    count: number;
    byDay: CollectionBucket[];
    byMethod: CollectionBucket[];
    byClass: CollectionBucket[];
}

/** Whole days since a YYYY-MM-DD date (0 for today or later). */
export function daysSince(day: string | null, today = new Date()): number {
    if (!day) return 0;
    const [y, m, d] = day.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return 0;
    const then = Date.UTC(y, m - 1, d);
    const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.floor((now - then) / 86_400_000));
}
