import { NextResponse } from 'next/server';

/**
 * Uniform 500 for unexpected route failures: the real error (Postgres
 * constraint names, upstream gateway messages, stack details) goes to the
 * server log only — clients get a generic message, so internals never
 * leak through error toasts. Deliberate 4xx validation responses should
 * keep their specific messages; this is only for the catch-all path.
 */
export function internalError(context: string, err: unknown): NextResponse {
    console.error(`[${context}]`, err);
    return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
}

/** Postgres SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * Readable text for the unique constraints a user can actually trip, keyed by
 * constraint name. Raw Postgres ("duplicate key value violates unique
 * constraint ...") means nothing to a school admin, so it never reaches them.
 */
const UNIQUE_CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
    students_school_id_admission_number_key:
        'That admission number is already used by another student in your school.',
};

/** The subset of a PostgREST/Postgres error this module reads. */
interface PostgresErrorLike {
    code?: string;
    message?: string;
    details?: string;
}

function asPostgresError(err: unknown): PostgresErrorLike | null {
    return typeof err === 'object' && err !== null ? (err as PostgresErrorLike) : null;
}

/**
 * Maps a failed write to a message worth showing, falling back to `fallback`
 * for anything unrecognised so internals are not leaked.
 *
 * Postgres reports the offending values in `details` as
 * `Key (school_id, admission_number)=(<uuid>, 001) already exists.` — naming
 * the value turns "something clashed" into something the user can fix, which
 * matters most on a bulk import where one row in hundreds is at fault.
 */
export function writeErrorMessage(err: unknown, fallback: string): string {
    const pgError = asPostgresError(err);
    if (!pgError || pgError.code !== UNIQUE_VIOLATION) return fallback;

    const constraint = Object.keys(UNIQUE_CONSTRAINT_MESSAGES).find(
        name => pgError.message?.includes(name),
    );
    if (!constraint) return fallback;

    const message = UNIQUE_CONSTRAINT_MESSAGES[constraint];
    const duplicated = /\)=\((?:[^,]+,\s*)?([^)]*)\) already exists/.exec(pgError.details ?? '');

    return duplicated?.[1] ? `${message} (${duplicated[1].trim()})` : message;
}
