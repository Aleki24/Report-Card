import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, type Access } from '@/lib/platform/access';
import { getCurrentAcademicYearId } from '@/lib/auth-server';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import {
    decisionProblem, gradeStep, nextGradeId,
    type PromotionClass, type PromotionDecision, type PromotionGrade, type PromotionOverview, type PromotionRunSummary, type StepGrade,
} from '@/lib/promotion';

/** Promotion moves the whole school, so it is an admin's job, like the rest of setup. */
export function assertAdmin(access: Access): void {
    if (access.baseRole !== 'ADMIN') throw new HttpError(403, 'Only admins can promote students.');
}

type GradeRow = StepGrade & { code: string | null };
interface StreamRow { id: string; grade_id: string; name: string; full_name: string }
interface Person { first_name: string | null; last_name: string | null }
interface LearnerRow {
    id: string;
    admission_number: string | null;
    current_grade_stream_id: string;
    users: Person | Person[] | null;
}
interface RunRow {
    id: string;
    created_at: string;
    promoted: number;
    repeated: number;
    graduated: number;
    transferred: number;
    users: Person | Person[] | null;
}

const fullName = (p: Person | null): string => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();

async function loadRun(db: SupabaseClient, schoolId: string, academicYearId: string): Promise<PromotionRunSummary | null> {
    const { data, error } = await db
        .from('student_promotion_runs')
        .select('id, created_at, promoted, repeated, graduated, transferred, users:run_by ( first_name, last_name )')
        .eq('school_id', schoolId)
        .eq('academic_year_id', academicYearId)
        .is('undone_at', null)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { users, ...run } = data as RunRow;
    return { ...run, run_by: fullName(embedOne(users)) || null };
}

/**
 * Every grade the school teaches, each with its step, its classes and their
 * enrolled learners, and the classes learners can move into.
 */
export async function loadPromotionOverview(db: SupabaseClient, schoolId: string): Promise<PromotionOverview> {
    const yearId = await getCurrentAcademicYearId(db, schoolId);
    const [yearRes, levelsRes, gradesRes, streamsRes, learners, run] = await Promise.all([
        yearId ? db.from('academic_years').select('id, name').eq('id', yearId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        db.from('academic_levels').select('id, name'),
        db.from('grades').select('id, code, name_display, numeric_order, academic_level_id').order('numeric_order'),
        db.from('grade_streams').select('id, grade_id, name, full_name').eq('school_id', schoolId).order('name'),
        fetchAllRows<LearnerRow>(() => db
            .from('students')
            .select('id, admission_number, current_grade_stream_id, users!inner ( first_name, last_name )')
            .eq('school_id', schoolId)
            .eq('status', 'ACTIVE')
            .order('id')),
        yearId ? loadRun(db, schoolId, yearId) : Promise.resolve(null),
    ]);
    const failed = yearRes.error ?? levelsRes.error ?? gradesRes.error ?? streamsRes.error ?? learners.error;
    if (failed) throw failed;
    if (learners.truncated) throw new HttpError(400, 'Your school has too many learners to promote at once. Contact support.');

    const grades = (gradesRes.data ?? []) as GradeRow[];
    const streams = (streamsRes.data ?? []) as StreamRow[];
    const curriculumName = new Map((levelsRes.data ?? []).map(l => [l.id as string, l.name as string]));

    const learnersByStream = new Map<string, PromotionClass['learners']>();
    for (const row of learners.rows) {
        const list = learnersByStream.get(row.current_grade_stream_id) ?? [];
        list.push({ id: row.id, name: fullName(embedOne(row.users)) || 'Unnamed learner', admission_number: row.admission_number });
        learnersByStream.set(row.current_grade_stream_id, list);
    }
    for (const list of learnersByStream.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    const streamsByGrade = new Map<string, StreamRow[]>();
    for (const s of streams) streamsByGrade.set(s.grade_id, [...(streamsByGrade.get(s.grade_id) ?? []), s]);
    const taught = new Set(streamsByGrade.keys());
    const toClass = (s: StreamRow) => ({ id: s.id, name: s.name, full_name: s.full_name });

    const result: PromotionGrade[] = grades
        .filter(g => taught.has(g.id))
        .map(g => {
            const step = gradeStep(g, grades, taught);
            const next = nextGradeId(step);
            return {
                id: g.id,
                name: g.name_display,
                curriculum: curriculumName.get(g.academic_level_id) ?? '',
                step,
                classes: (streamsByGrade.get(g.id) ?? []).map(s => ({ ...toClass(s), learners: learnersByStream.get(s.id) ?? [] })),
                nextClasses: next ? (streamsByGrade.get(next) ?? []).map(toClass) : [],
            };
        });

    return {
        academicYear: yearRes.data ? { id: yearRes.data.id as string, name: yearRes.data.name as string } : null,
        run,
        grades: result,
    };
}

/**
 * Refuses a plan that doesn't decide every enrolled learner exactly once, or
 * gives one an outcome their grade doesn't allow. Checked against the class
 * lists as they are now, so a plan made before someone was admitted or moved
 * is sent back to be looked at again.
 */
export function assertPlanCoversSchool(overview: PromotionOverview, decisions: readonly PromotionDecision[]): void {
    const where = new Map<string, { grade: PromotionGrade; classId: string; name: string }>();
    for (const grade of overview.grades) {
        for (const cls of grade.classes) for (const l of cls.learners) where.set(l.id, { grade, classId: cls.id, name: l.name });
    }

    const seen = new Set<string>();
    const problems: string[] = [];
    for (const d of decisions) {
        const found = where.get(d.student_id);
        if (!found || found.classId !== d.from_stream_id || seen.has(d.student_id)) {
            throw new HttpError(409, 'The class lists have changed since this page was opened. Reload and check the plan again.');
        }
        seen.add(d.student_id);
        const problem = decisionProblem(found.grade.step, d, new Set(found.grade.nextClasses.map(c => c.id)));
        if (problem) problems.push(`${found.name} (${found.grade.name}): ${problem}`);
    }
    if (seen.size !== where.size) {
        throw new HttpError(409, 'Some learners were admitted or moved since this page was opened. Reload and check the plan again.');
    }
    if (problems.length > 0) throw new HttpError(400, 'Some learners need a decision before promoting.', problems.slice(0, 20));
}

/** A refusal raised by the promotion functions, as the 409 the user should see. */
export function promotionDbError(error: { code?: string; message: string }): Error {
    return error.code === 'P0001' ? new HttpError(409, error.message) : new Error(error.message);
}
