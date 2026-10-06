import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { bandForGrade, type CurriculumBand } from '@/lib/curriculum-bands';
import { HttpError } from '@/lib/platform/access';
import { embedOne } from '@/lib/postgrest';
import { planClasses, type BlockLoad } from './blocks';
import { DEFAULT_TIMETABLE_CONFIG, LESSON_SELECT, sectionFor, timetableConfigSchema, type TimetableConfig, type TimetableLesson } from './config';

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

export interface LoadRow {
    id: string;
    grade_stream_id: string;
    subject_id: string;
    teacher_id: string | null;
    lessons_per_week: number;
    double_lessons: number;
    room_type: string | null;
    option_block: number | null;
    subject: { name: string; code: string | null; category: string | null; subject_type: string | null } | null;
    stream: { full_name: string } | null;
    teacher: { first_name: string; last_name: string } | null;
}

export type PlannedLoad = BlockLoad & { row: LoadRow };

/**
 * The school's teaching loads, each class's teaching periods (its section's
 * bell) and the plan the generator will follow: whole-class subjects and
 * option blocks. One reading for the generator and the readiness check.
 */
export async function loadTimetablePlan(schoolId: string) {
    const [config, bands, { data, error }] = await Promise.all([
        loadConfig(schoolId),
        streamBands(schoolId),
        db().from('timetable_requirements')
            .select('id, grade_stream_id, subject_id, teacher_id, lessons_per_week, double_lessons, room_type, option_block, subject:subjects(name, code, category, subject_type), stream:grade_streams(full_name), teacher:users!timetable_requirements_teacher_id_fkey(first_name, last_name)')
            .eq('school_id', schoolId)
            .limit(5000),
    ]);
    if (error) throw error;
    const rows = ((data ?? []) as unknown as LoadRow[]).map(r => ({ ...r, subject: embedOne(r.subject), stream: embedOne(r.stream), teacher: embedOne(r.teacher) }));
    const sectionOf = (streamId: string) => sectionFor(config, bands.get(streamId) ?? null);
    const capacityOf = (streamId: string) => config.days.length * sectionOf(streamId).periods.filter(p => !p.is_break).length;
    const loads: PlannedLoad[] = rows.map(r => ({
        id: r.id, streamId: r.grade_stream_id, subjectName: r.subject?.name ?? '', subjectType: r.subject?.subject_type ?? null,
        category: r.subject?.category ?? null, teacherId: r.teacher_id, lessons: r.lessons_per_week, doubles: r.double_lessons,
        optionBlock: r.option_block, row: r,
    }));
    return { config, rows, sectionOf, capacityOf, plans: planClasses(loads, capacityOf) };
}
