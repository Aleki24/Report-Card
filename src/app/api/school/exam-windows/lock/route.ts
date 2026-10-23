import { NextRequest, NextResponse } from 'next/server';
import { getAccess } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/postgrest';
import { readTermLock } from '@/lib/term-lock-server';
import type { TermLock } from '@/lib/exam-windows';

/**
 * PUT { termId, locked } — lock a finished term's marks, or unlock them for
 * a correction. Needs marking.open: admins, the principal, deputy, DOS and
 * exams officer.
 */

/** Postgres "undefined_column": the migration hasn't been applied yet. */
const MISSING_COLUMN = '42703';

export async function PUT(request: NextRequest) {
    const access = await getAccess();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!access.can('marking.open')) return NextResponse.json({ error: 'Only the admin, principal, DOS or exams officer can lock a term' }, { status: 403 });

    const body = (await request.json().catch(() => null)) as { termId?: unknown; locked?: unknown } | null;
    const termId = typeof body?.termId === 'string' && isUuid(body.termId) ? body.termId : null;
    if (!termId || typeof body?.locked !== 'boolean') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
        .from('terms')
        .update(body.locked
            ? { marks_locked_at: new Date().toISOString(), marks_locked_by: access.userId }
            : { marks_locked_at: null, marks_locked_by: null })
        .eq('school_id', access.schoolId)
        .eq('id', termId)
        .select('id');
    if (error) {
        if (error.code === MISSING_COLUMN || error.code === 'PGRST204') return NextResponse.json({ error: 'Term locking isn’t switched on yet. Ask your administrator to finish the update.' }, { status: 503 });
        return NextResponse.json({ error: 'Could not save' }, { status: 500 });
    }
    if (!data?.length) return NextResponse.json({ error: 'Term not found' }, { status: 404 });

    const lock: TermLock | null = body.locked ? await readTermLock(supabase, access.schoolId, termId) : null;
    return NextResponse.json({ lock });
}
