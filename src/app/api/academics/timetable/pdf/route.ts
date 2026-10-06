import { NextResponse } from 'next/server';
import { HttpError, route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveTimetable } from '@/lib/timetable/resolve';
import { masterSheets, renderTimetablePdf, type TimetableSheet } from '@/lib/pdf/timetablePdf';
import { teacherName } from '@/lib/ops/forms/academics';

export const runtime = 'nodejs';
export const maxDuration = 60;

const fileName = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'timetable';

/**
 * GET /api/academics/timetable/pdf?view=mine|class|teacher|room|master&id=&version=
 * The same lessons the timetable screen shows, as a printable PDF.
 */
export const GET = route('timetable pdf', { module: 'timetable', permission: 'timetable.view' }, async ({ access, request }) => {
    const params = request.nextUrl.searchParams;
    const { config, lessons, mode } = await resolveTimetable(access, params);
    if (lessons.length === 0) throw new HttpError(404, 'There is no timetable to download yet.');

    const db = createSupabaseAdmin();
    const versionQuery = params.get('version')
        ? db.from('timetable_versions').select('name').eq('id', params.get('version') as string).eq('school_id', access.schoolId)
        : db.from('timetable_versions').select('name').eq('school_id', access.schoolId).eq('status', 'PUBLISHED');
    const [{ data: school }, { data: version }] = await Promise.all([
        db.from('schools').select('name, logo_url').eq('id', access.schoolId).maybeSingle(),
        versionQuery.maybeSingle(),
    ]);

    let sheets: TimetableSheet[];
    let cover;
    if (mode === 'master') {
        ({ sheets, cover } = masterSheets(config, lessons));
    } else {
        const first = lessons[0];
        const title = mode === 'class' ? first.stream?.full_name : mode === 'teacher' ? teacherName(first.teacher) : first.room?.name;
        const kind = { class: 'Class', teacher: 'Teacher', room: 'Room' }[mode];
        sheets = [{ title: title || `${kind} timetable`, subtitle: `${kind} timetable · ${lessons.length} lessons a week`, mode, lessons }];
    }

    const schoolName = school?.name ?? 'School';
    const pdf = await renderTimetablePdf({
        schoolName,
        logoUrl: school?.logo_url,
        versionName: version?.name ?? 'Timetable',
        generatedAt: new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }),
        config,
        sheets,
        cover,
    });
    const name = mode === 'master' ? `${schoolName} master timetable` : `${sheets[0].title} timetable`;
    return new NextResponse(new Uint8Array(pdf), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName(name)}.pdf"`,
            'Cache-Control': 'private, no-store',
        },
    });
});
