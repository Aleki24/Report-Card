import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, type Access } from '@/lib/platform/access';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import {
    decisionProblem, emptyCounts, gradeStep, nextGradeId,
    type PromotionClass, type PromotionCounts, type PromotionDecision, type PromotionGrade, type PromotionOverview,
    type PromotionRunSummary, type PromotionStage, type StepGrade,
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
    status: 'ACTIVE' | 'PENDING';
    /** Null only for a learner whose class was cleared by hand; promotion can't place them. */
    current_grade_stream_id: string | null;
    users: Person | Person[] | null;
}
interface YearRow { id: string; name: string; start_date: string; end_date: string }
interface RunRow extends PromotionCounts {
    id: string;
    academic_year_id: string;
    created_at: string;
    users: Person | Person[] | null;
}

const fullName = (p: Person | null): string => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();

const COUNTED = ['promoted', 'repeated', 'graduated', 'transferred'] as const satisfies readonly (keyof PromotionCounts)[];

/**
 * The year promotion closes unless another is chosen: the one ending nearest
 * `today`. In November that is the year now ending, and in January the one
 * just ended, never a year merely added ahead of time.
 */
export function defaultPromotionYear<T extends Pick<YearRow, 'end_date'>>(years: readonly T[], today: string): T | null {
    const now = Date.parse(today);
    let best: T | null = null;
    let bestGap = Infinity;
    for (const y of years) {
        const gap = Math.abs(Date.parse(y.end_date) - now);
        if (gap < bestGap) { best = y; bestGap = gap; }
    }
    return best;
}

function runSummary(row: RunRow, decidesPending: boolean): PromotionRunSummary {
    return {
        id: row.id,
        created_at: row.created_at,
        run_by: fullName(embedOne(row.users)) || null,
        decidesPending,
        promoted: row.promoted,
        repeated: row.repeated,
        graduated: row.graduated,
        transferred: row.transferred,
        pending: row.pending,
    };
}

/**
 * Every grade the school teaches, each with its step, its classes and their
 * learners, and the classes learners can move into; and where the chosen
 * year's promotion stands.
 *
 * Learners left pending come first: while any are, the page is about them,
 * in the year whose promotion left them so, and `grades` holds only them.
 * Otherwise the year is `requestedYearId` when it is the school's, else the
 * one ending nearest today.
 */
export async function loadPromotionOverview(db: SupabaseClient, schoolId: string, requestedYearId?: string | null): Promise<PromotionOverview> {
    const [yearsRes, levelsRes, gradesRes, streamsRes, learners, runsRes] = await Promise.all([
        db.from('academic_years').select('id, name, start_date, end_date').eq('school_id', schoolId).order('start_date', { ascending: false }),
        db.from('academic_levels').select('id, name'),
        db.from('grades').select('id, code, name_display, numeric_order, academic_level_id').order('numeric_order'),
        db.from('grade_streams').select('id, grade_id, name, full_name').eq('school_id', schoolId).order('name'),
        fetchAllRows<LearnerRow>(() => db
            .from('students')
            .select('id, admission_number, status, current_grade_stream_id, users!inner ( first_name, last_name )')
            .eq('school_id', schoolId)
            .in('status', ['ACTIVE', 'PENDING'])
            .order('id')),
        db.from('student_promotion_runs')
            .select('id, academic_year_id, created_at, promoted, repeated, graduated, transferred, pending, users:run_by ( first_name, last_name )')
            .eq('school_id', schoolId)
            .is('undone_at', null)
            .order('created_at'),
    ]);
    const failed = yearsRes.error ?? levelsRes.error ?? gradesRes.error ?? streamsRes.error ?? learners.error ?? runsRes.error;
    if (failed) throw failed;
    if (learners.truncated) throw new HttpError(400, 'Your school has too many learners to promote at once. Contact support.');

    const years = (yearsRes.data ?? []) as YearRow[];
    const runs = (runsRes.data ?? []) as RunRow[];
    const pendingLearners = learners.rows.filter(r => r.status === 'PENDING' && r.current_grade_stream_id);

    const pendingRun = pendingLearners.length > 0 ? runs.findLast(r => r.pending > 0) : undefined;
    const year = years.find(y => y.id === pendingRun?.academic_year_id)
        ?? years.find(y => y.id === requestedYearId)
        ?? defaultPromotionYear(years, new Date().toISOString().slice(0, 10));
    const yearRuns = year ? runs.filter(r => r.academic_year_id === year.id) : [];
    const stage: PromotionStage = pendingLearners.length > 0 ? 'PENDING' : yearRuns.length > 0 ? 'DONE' : 'OPEN';
    const onPage = stage === 'PENDING' ? pendingLearners : learners.rows.filter(r => r.status === 'ACTIVE');

    const grades = (gradesRes.data ?? []) as GradeRow[];
    const streams = (streamsRes.data ?? []) as StreamRow[];
    const curriculumName = new Map((levelsRes.data ?? []).map(l => [l.id as string, l.name as string]));

    const learnersByStream = new Map<string, PromotionClass['learners']>();
    for (const row of onPage) {
        if (!row.current_grade_stream_id) continue;
        const list = learnersByStream.get(row.current_grade_stream_id) ?? [];
        list.push({ id: row.id, name: fullName(embedOne(row.users)) || 'Unnamed learner', admission_number: row.admission_number });
        learnersByStream.set(row.current_grade_stream_id, list);
    }
    for (const list of learnersByStream.values()) list.sort((a, b) => a.name.localeCompare(b.name));

    const streamsByGrade = new Map<string, StreamRow[]>();
    for (const s of streams) streamsByGrade.set(s.grade_id, [...(streamsByGrade.get(s.grade_id) ?? []), s]);
    const taught = new Set(streamsByGrade.keys());
    const toClass = (s: StreamRow) => ({ id: s.id, name: s.name, full_name: s.full_name });
    const pending = stage === 'PENDING';

    const result: PromotionGrade[] = grades
        .filter(g => taught.has(g.id))
        .map(g => {
            const step = gradeStep(g, grades, taught);
            const next = nextGradeId(step);
            const classes = (streamsByGrade.get(g.id) ?? []).map(s => ({ ...toClass(s), learners: learnersByStream.get(s.id) ?? [] }));
            return {
                id: g.id,
                name: g.name_display,
                curriculum: curriculumName.get(g.academic_level_id) ?? '',
                step,
                pending,
                // Pending learners are shown on their own, without the classes now filled by others.
                classes: pending ? classes.filter(c => c.learners.length > 0) : classes,
                nextClasses: next ? (streamsByGrade.get(next) ?? []).map(toClass) : [],
            };
        })
        .filter(g => !pending || g.classes.length > 0);

    const latest = yearRuns.at(-1);
    const totals = yearRuns.length > 0 || pending ? emptyCounts() : null;
    if (totals) {
        for (const run of yearRuns) for (const key of COUNTED) totals[key] += run[key];
        totals.pending = pendingLearners.length;
    }

    return {
        academicYear: year ? { id: year.id, name: year.name } : null,
        years: years.map(({ id, name }) => ({ id, name })),
        stage,
        // A later step of the year decided learners its first step left pending.
        run: latest ? runSummary(latest, yearRuns.length > 1) : null,
        totals,
        grades: result,
    };
}

/**
 * Refuses a plan that gives a learner an outcome their grade doesn't allow,
 * or decides one twice. A year's first promotion must decide every enrolled
 * learner; a later step decides only the pending learners it changes.
 * Checked against the class lists as they are now, so a plan made before
 * someone was admitted or moved is sent back to be looked at again.
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
        const { grade } = found;
        const problem = grade.pending && d.outcome === 'PENDING'
            ? 'is pending already'
            : decisionProblem(grade.step, d, new Set(grade.nextClasses.map(c => c.id)), grade.pending);
        if (problem) problems.push(`${found.name} (${grade.name}): ${problem}`);
    }
    if (overview.stage === 'OPEN' && seen.size !== where.size) {
        throw new HttpError(409, 'Some learners were admitted or moved since this page was opened. Reload and check the plan again.');
    }
    if (problems.length > 0) throw new HttpError(400, 'Some learners need a decision before promoting.', problems.slice(0, 20));
}

/** A refusal raised by the promotion functions, as the 409 the user should see. */
export function promotionDbError(error: { code?: string; message: string }): Error {
    return error.code === 'P0001' ? new HttpError(409, error.message) : new Error(error.message);
}
