import { NextResponse } from 'next/server';
import { loadVerifiedResults } from '@/lib/verify-results';

export const runtime = 'nodejs';

/** Public results verification; see loadVerifiedResults. */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const { searchParams } = new URL(request.url);
        // `t`/`e` are the compact keys the QR uses; the long spellings keep
        // links shared before the switch working.
        const data = await loadVerifiedResults((await params).studentId, {
            term: searchParams.get('t') || searchParams.get('term') || searchParams.get('termId'),
            examType: searchParams.get('e') || searchParams.get('examType'),
        });
        if (!data) return NextResponse.json({ error: 'No published results found for this code.' }, { status: 404 });
        // Results do not change once approved; keep it short so an unpublish shows quickly.
        return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
    } catch {
        return NextResponse.json({ error: 'Could not load these results.' }, { status: 500 });
    }
}
