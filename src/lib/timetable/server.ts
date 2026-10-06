import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { bandForGrade, type CurriculumBand } from '@/lib/curriculum-bands';
import { HttpError } from '@/lib/platform/access';
import { DEFAULT_TIMETABLE_CONFIG, LESSON_SELECT, timetableConfigSchema, type TimetableConfig, type TimetableLesson } from './config';

const db = () => createSupabaseAdmin();

export async function loadConfig(schoolId: string): Promise<TimetableConfig> {
    const { data, error } = await db().from('timetable_configs').select('days, periods, rules').eq('school_id', schoolId).maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_TIMETABLE_CONFIG;
    // Sections are kept inside `rules` (a JSON column), so no schema change was needed for them.
    const { sections, ...rules } = (data.rules ?? {}) as { sections?: unknown };
    const parsed = timetableConfigSchema.safeParse({ ...data, rules, sections: sections ?? [] });
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

/** Each class's curriculum band, read from its grade, so it follows its section's bell. */
export async function streamBands(schoolId: string): Promise<Map<string, CurriculumBand | null>> {
    const { data, error } = await db().from('grade_streams').select('id, grade:grades(code, name_display)').eq('school_id', schoolId);
    if (error) throw error;
    return new Map((data ?? []).map(row => {
        const grade = Array.isArray(row.grade) ? row.grade[0] : row.grade;
        return [row.id as string, bandForGrade(grade as { code: string | null; name_display: string | null } | null)];
    }));
}
