import { NextRequest, NextResponse } from 'next/server';
import { internalError } from '@/lib/api-errors';
import { accessOrResponse } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadCollections } from '@/lib/fee-reports-server';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Longest window one report covers. */
const MAX_DAYS = 400;

/** GET ?from=&to= (YYYY-MM-DD, inclusive; default this month) — money received, by day, method and class. */
export async function GET(request: NextRequest) {
    try {
        const caller = await accessOrResponse('fees.view');
        if (caller instanceof NextResponse) return caller;
        const params = new URL(request.url).searchParams;
        const today = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
        const from = params.get('from') ?? `${today.slice(0, 8)}01`;
        const to = params.get('to') ?? today;
        if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) return NextResponse.json({ error: 'Pick a start date on or before the end date.' }, { status: 400 });
        if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_DAYS) return NextResponse.json({ error: `Pick at most ${MAX_DAYS} days.` }, { status: 400 });

        return NextResponse.json(await loadCollections(createSupabaseAdmin(), caller.schoolId, from, to));
    } catch (err: unknown) {
        return internalError('fee collections', err);
    }
}
