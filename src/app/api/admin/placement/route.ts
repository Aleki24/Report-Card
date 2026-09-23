import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getCaller } from '@/lib/auth-server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { placementApplySchema } from '@/lib/schemas';
import { CombinationError } from '@/lib/pathway/combinations';
import { applyPlacement, getPlacement, PlacementError } from '@/lib/pathway/placement-server';

/**
 * Learner placement from recorded marks (logic in lib/pathway/placement-server).
 *
 * GET  ?grade_stream_id=… — for a CBC Senior School class: each learner's
 *      suggested combination and maths; for an 8-4-4 class: the electives each
 *      learner has marks in. Nothing is written.
 * POST — apply the placements an admin reviewed and approved.
 */
async function requireAdminSchool(): Promise<{ schoolId: string } | NextResponse> {
    const caller = await getCaller();
    if (!caller?.schoolId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'ADMIN') return NextResponse.json({ error: 'Only admins can place learners.' }, { status: 403 });
    return { schoolId: caller.schoolId };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdminSchool();
        if (auth instanceof NextResponse) return auth;

        const streamId = new URL(request.url).searchParams.get('grade_stream_id');
        if (!streamId) return NextResponse.json({ error: 'grade_stream_id is required' }, { status: 400 });

        const body = await getPlacement(createSupabaseAdmin(), auth.schoolId, streamId);
        if (!body) {
            return NextResponse.json({ error: 'Placement applies to CBC Senior School (Grades 10-12) and 8-4-4 classes.' }, { status: 400 });
        }
        return NextResponse.json(body);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdminSchool();
        if (auth instanceof NextResponse) return auth;

        const input = placementApplySchema.parse(await request.json());
        const result = await applyPlacement(createSupabaseAdmin(), auth.schoolId, input);
        return NextResponse.json({ success: true, ...result });
    } catch (err) {
        if (err instanceof ZodError) {
            return NextResponse.json({ error: 'Validation failed', details: err.issues.map(i => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
        }
        if (err instanceof CombinationError || err instanceof PlacementError) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
    }
}
