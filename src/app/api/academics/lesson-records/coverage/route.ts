import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export interface CoverageRow {
    schemeId: string;
    title: string;
    status: string;
    teacher: string;
    subject: string;
    className: string;
    planned: number;
    covered: number;
    lastTaught: string | null;
}

interface SchemeWithEntries {
    id: string; title: string; status: string;
    teacher: { first_name: string; last_name: string } | null;
    subject: { name: string } | null;
    stream: { full_name: string } | null;
    entries: { id: string }[];
}

/**
 * Syllabus coverage: lessons planned in each scheme against lessons recorded
 * as taught. Reviewers see the school; teachers see their own.
 */
export const GET = route('syllabus coverage', { module: 'lesson_records', permission: ['lesson_records.write', 'lesson_records.review'] }, async ({ access }) => {
    const db = createSupabaseAdmin();
    let q = db.from('schemes_of_work')
        .select('id, title, status, teacher:users!schemes_of_work_teacher_id_fkey(first_name, last_name), subject:subjects(name), stream:grade_streams(full_name), entries:scheme_entries(id)')
        .eq('school_id', access.schoolId)
        .order('created_at', { ascending: false })
        .limit(500);
    if (!access.can('lesson_records.review')) q = q.eq('teacher_id', access.userId);
    const { data, error } = await q;
    if (error) throw error;
    const schemes = (data ?? []) as unknown as SchemeWithEntries[];
    const entryIds = schemes.flatMap(s => s.entries.map(e => e.id));
    const taught = new Map<string, string>();
    for (let i = 0; i < entryIds.length; i += 500) {
        const { data: rows, error: rowsError } = await db.from('records_of_work').select('scheme_entry_id, lesson_date').in('scheme_entry_id', entryIds.slice(i, i + 500));
        if (rowsError) throw rowsError;
        for (const r of rows ?? []) {
            const prev = taught.get(r.scheme_entry_id as string);
            if (!prev || (r.lesson_date as string) > prev) taught.set(r.scheme_entry_id as string, r.lesson_date as string);
        }
    }
    return schemes.map((s): CoverageRow => {
        const dates = s.entries.map(e => taught.get(e.id)).filter((d): d is string => !!d).sort();
        return {
            schemeId: s.id, title: s.title, status: s.status,
            teacher: `${s.teacher?.first_name ?? ''} ${s.teacher?.last_name ?? ''}`.trim(),
            subject: s.subject?.name ?? '', className: s.stream?.full_name ?? '',
            planned: s.entries.length, covered: dates.length, lastTaught: dates.at(-1) ?? null,
        };
    });
});
