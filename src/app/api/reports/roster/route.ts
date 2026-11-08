import { NextRequest, NextResponse } from 'next/server';
import { authorizeClassReport } from '@/lib/reports/report-access';
import { classLearnersInTerm } from '@/lib/reports/class-history';
import { termBelongsToSchool } from '@/lib/tenant-scope';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { isUuid } from '@/lib/postgrest';

/** The columns the report screens read (the learner picker, results SMS), as `/api/school/data?type=students` gives them. */
const ROSTER_SELECT = 'id, admission_number, status, current_grade_stream_id, academic_level_id, guardian_phone, guardian_name, avatar_url, users ( first_name, last_name, email ), grade_streams ( id, full_name, grade_id )';

/**
 * GET /api/reports/roster?grade_stream_id=&term_id= — a class's learners for
 * a term's report cards: who was in it then, once the term's year has been
 * promoted (whatever class they are in now, or if they have left); otherwise
 * the learners in it now. Admins and the class's teacher, as the cards.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const streamId = searchParams.get('grade_stream_id') ?? '';
        const termId = searchParams.get('term_id') ?? '';
        if (!isUuid(streamId) || !isUuid(termId)) {
            return NextResponse.json({ error: 'grade_stream_id and term_id are required' }, { status: 400 });
        }

        const access = await authorizeClassReport(streamId, 'Only administrators and the designated class teacher can generate class reports.');
        if (!access.ok) return access.response;
        const schoolId = access.session.schoolId;
        if (!(await termBelongsToSchool(termId, schoolId))) {
            return NextResponse.json({ error: 'Term not found' }, { status: 404 });
        }

        const { rows, historical } = await classLearnersInTerm(createSupabaseAdmin(), { schoolId, termId, streamId, select: ROSTER_SELECT, current: 'any' });
        return NextResponse.json({ data: rows, historical });
    } catch (err: unknown) {
        return internalError('report roster', err);
    }
}
