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
