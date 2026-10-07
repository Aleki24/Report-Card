import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { bandForGrade, type CurriculumBand } from '@/lib/curriculum-bands';
import { HttpError } from '@/lib/platform/access';
import { embedOne } from '@/lib/postgrest';
import { planClasses, type BlockLoad } from './blocks';
import { syncLoadTeachers } from './assignments';
import { BUILT_IN_TOGETHER, togetherGroups, type TogetherRule } from './together';
import { DEFAULT_TIMETABLE_CONFIG, LESSON_SELECT, sectionFor, timetableConfigSchema, type TimetableConfig, type TimetableLesson } from './config';

const db = () => createSupabaseAdmin();

/** Built-in taught-together rules, then the school's own. */
export async function loadTogetherRules(schoolId: string): Promise<TogetherRule[]> {
    const { data, error } = await db().from('timetable_subject_groups').select('id, name, bands, subject_ids').eq('school_id', schoolId).order('created_at');
    if (error) throw error;
    return [
        ...BUILT_IN_TOGETHER,
        ...(data ?? []).map(r => ({ id: r.id as string, name: r.name as string, bands: (r.bands ?? []) as CurriculumBand[], subjectIds: (r.subject_ids ?? []) as string[], builtIn: false })),
    ];
}

export async function saveConfig(schoolId: string, config: TimetableConfig): Promise<TimetableConfig> {
    const { error } = await db().from('timetable_configs').upsert({
        school_id: schoolId,
        days: [...config.days].sort(),
        periods: config.periods,
        rules: { ...config.rules, sections: config.sections },
        updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return loadConfig(schoolId);
}

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
    stream: { full_name: string; grade: { code: string | null; name_display: string | null } | null } | null;
    teacher: { first_name: string; last_name: string } | null;
}

export type PlannedLoad = BlockLoad & { row: LoadRow };

/**
 * The school's teaching loads, each class's teaching periods (its section's
 * bell) and the plan the generator will follow: whole-class subjects and
 * option blocks. One reading for the generator and the readiness check.
 */
export async function loadTimetablePlan(schoolId: string) {
    // Loads follow Subjects → Teachers, so a subject that changed hands there is planned with its new teacher.
    await syncLoadTeachers(db(), schoolId);
    const [config, bands, { data, error }, choiceRows, rules, combos] = await Promise.all([
        loadConfig(schoolId),
        streamBands(schoolId),
        db().from('timetable_requirements')
            .select('id, grade_stream_id, subject_id, teacher_id, lessons_per_week, double_lessons, room_type, option_block, subject:subjects(name, code, category, subject_type), stream:grade_streams(full_name, grade:grades(code, name_display)), teacher:users!timetable_requirements_teacher_id_fkey(first_name, last_name)')
            .eq('school_id', schoolId)
            .limit(5000),
        // Learners' elective choices, read through their class, so blocks follow what is actually taken together.
        db().from('student_subjects')
            .select('student_id, subject_id, student:students!inner(current_grade_stream_id)')
            .eq('school_id', schoolId)
            .eq('role', 'ELECTIVE')
            .limit(20000),
        loadTogetherRules(schoolId),
        // The school's offered Senior School combinations stand in for learners' choices until those are recorded.
        db().from('subject_combinations')
            .select('code, subjects:subject_combination_subjects(subject_id)')
            .eq('school_id', schoolId)
            .eq('is_active', true),
    ]);
    if (combos.error) throw combos.error;
    const comboChoices = new Map<string, Set<string>>();
    for (const c of combos.data ?? []) {
        for (const s of (c.subjects ?? []) as { subject_id: string }[]) {
            comboChoices.set(s.subject_id, (comboChoices.get(s.subject_id) ?? new Set()).add(`combination:${c.code as string}`));
        }
    }
    if (error) throw error;
    if (choiceRows.error) throw choiceRows.error;
    const choices = new Map<string, Map<string, Set<string>>>();
    for (const c of choiceRows.data ?? []) {
        const streamId = embedOne<{ current_grade_stream_id: string | null }>(c.student)?.current_grade_stream_id;
        if (!streamId) continue;
        const bySubject = choices.get(streamId) ?? new Map<string, Set<string>>();
        bySubject.set(c.subject_id as string, (bySubject.get(c.subject_id as string) ?? new Set()).add(c.student_id as string));
        choices.set(streamId, bySubject);
    }
    const rows = ((data ?? []) as unknown as LoadRow[]).map(r => {
        const stream = embedOne(r.stream);
        return { ...r, subject: embedOne(r.subject), stream: stream ? { ...stream, grade: embedOne(stream.grade) } : null, teacher: embedOne(r.teacher) };
    });
    const sectionOf = (streamId: string) => sectionFor(config, bands.get(streamId) ?? null);
    const capacityOf = (streamId: string) => config.days.length * sectionOf(streamId).periods.filter(p => !p.is_break).length;
    const loads: PlannedLoad[] = rows.map(r => ({
        id: r.id, streamId: r.grade_stream_id, subjectId: r.subject_id, subjectName: r.subject?.name ?? '', subjectType: r.subject?.subject_type ?? null,
        category: r.subject?.category ?? null, teacherId: r.teacher_id, lessons: r.lessons_per_week, doubles: r.double_lessons,
        optionBlock: r.option_block, row: r,
    }));
    const bandOf = (streamId: string) => bands.get(streamId) ?? null;
    const choicesOf = (streamId: string) => {
        const learners = choices.get(streamId);
        if (learners?.size) return { choices: learners, source: 'learners' as const };
        return bandOf(streamId) === 'CBC_SENIOR_SCHOOL' && comboChoices.size > 0 ? { choices: comboChoices, source: 'combinations' as const } : undefined;
    };
    const togetherOf = (streamId: string, classLoads: readonly PlannedLoad[]) => togetherGroups(classLoads, bandOf(streamId), rules);
    return { config, rows, bandOf, sectionOf, capacityOf, plans: planClasses(loads, capacityOf, choicesOf, togetherOf) };
}
