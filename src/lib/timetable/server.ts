import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError } from '@/lib/platform/access';
import { DEFAULT_TIMETABLE_CONFIG, LESSON_SELECT, timetableConfigSchema, type TimetableConfig, type TimetableLesson } from './config';

const db = () => createSupabaseAdmin();

export async function loadConfig(schoolId: string): Promise<TimetableConfig> {
    const { data, error } = await db().from('timetable_configs').select('days, periods, rules').eq('school_id', schoolId).maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_TIMETABLE_CONFIG;
    const parsed = timetableConfigSchema.safeParse(data);
    return parsed.success ? parsed.data : DEFAULT_TIMETABLE_CONFIG;
}

export async function loadVersion(id: string, schoolId: string) {
    const { data, error } = await db().from('timetable_versions').select('*').eq('id', id).eq('school_id', schoolId).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Timetable not found.');
    return data as { id: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; name: string };
}

export async function publishedVersionId(schoolId: string): Promise<string | null> {
    const { data, error } = await db().from('timetable_versions').select('id').eq('school_id', schoolId).eq('status', 'PUBLISHED').maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
}

export async function loadLessons(versionId: string, filter: { column: 'grade_stream_id' | 'teacher_id' | 'room_id'; value: string } | null = null): Promise<TimetableLesson[]> {
    let q = db().from('timetable_lessons').select(LESSON_SELECT).eq('version_id', versionId);
    if (filter) q = q.eq(filter.column, filter.value);
    const { data, error } = await q.order('day').order('period').limit(10_000);
    if (error) throw error;
    return (data ?? []) as unknown as TimetableLesson[];
}

/** Inserts rows in chunks; PostgREST bodies have a size limit. */
export async function insertChunked(table: string, rows: Record<string, unknown>[], size = 500) {
    for (let i = 0; i < rows.length; i += size) {
        const { error } = await db().from(table).insert(rows.slice(i, i + size));
        if (error) throw error;
    }
}
