/** A learner in the chosen class, as the Report Cards page lists them. */
export interface RosterLearner {
    id: string;
    admission_number: string;
    name: string;
    initials: string;
    guardian_phone: string | null;
    guardian_name: string | null;
}

type RawUser = { first_name?: unknown; last_name?: unknown } | null | undefined;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** One row of `/api/school/data?type=students`, or null when it has no id. */
export function toRosterLearner(raw: unknown): RosterLearner | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const id = text(row.id);
    if (!id) return null;
    const user = (Array.isArray(row.users) ? row.users[0] : row.users) as RawUser;
    const first = text(user?.first_name);
    const last = text(user?.last_name);
    const name = `${first} ${last}`.trim() || 'Unnamed learner';
    return {
        id,
        admission_number: text(row.admission_number),
        name,
        initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?',
        guardian_phone: text(row.guardian_phone) || null,
        guardian_name: text(row.guardian_name) || null,
    };
}

/** Name or admission number contains the query, ignoring case. */
export function matchesLearner(learner: Pick<RosterLearner, 'name' | 'admission_number'>, query: string): boolean {
    const q = query.trim().toLowerCase();
    return !q || learner.name.toLowerCase().includes(q) || learner.admission_number.toLowerCase().includes(q);
}
