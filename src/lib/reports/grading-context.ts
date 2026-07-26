import type { createSupabaseAdmin } from '@/lib/supabase-admin';
import { getGradeFromScales, isKCSEGradeLevel, overallKindFromScales, type OverallGradingKind } from '@/lib/analytics';
import type { GradingScale } from '@/types';

type Supabase = ReturnType<typeof createSupabaseAdmin>;

/** Everything needed to turn raw percentages into the grades a report card prints. */
export interface GradingContext {
    /** KCSE-style letter grades vs CBC performance levels. */
    gradingSystemType: 'KCSE' | 'CBC';
    /** Subject-level bands used to grade each individual mark. */
    gradingScales: GradingScale[];
    /** The school's opt-in overall grading system, when one is configured. */
    overallGradingScales?: GradingScale[];
    /** Which figure those overall bands are read against. */
    overallGradingKind: OverallGradingKind;
    gradeLevelCode: string;
    isKCSEGrade: boolean;
}

interface OverallSystemRow {
    id: string;
    system_kind?: string | null;
    academic_level_id?: string | null;
}

/**
 * The overall grading table a school wants applied to one learner's results.
 *
 * Settings calls this "Overall grading" and promises it "grades each student's
 * total points into an overall grade on report cards" — so a points table is
 * weighed against the points earned, never against the average percentage.
 * Two things previously stopped that promise being kept:
 *
 *   • Schools that chose their overall table before the picker was restricted
 *     to OVERALL-kind systems have an ordinary subject (percentage) table
 *     stored. When the school has since built a proper OVERALL points table
 *     for the learner's level, that is plainly the one they meant, so it wins.
 *   • A table belongs to an academic level. An 8-4-4 points table must not be
 *     used to stamp a letter grade on a CBC learner's card, so a table from
 *     another level is ignored rather than mis-applied.
 */
export async function resolveOverallGradingSystem(
    supabase: Supabase,
    schoolId?: string | null,
    academicLevelId?: string | null
): Promise<{ scales?: GradingScale[]; kind: OverallGradingKind }> {
    if (!schoolId) return { kind: 'PERCENTAGE' };

    const { data: schoolRow } = await supabase
        .from('schools')
        .select('overall_grading_system_id')
        .eq('id', schoolId)
        .maybeSingle();

    const chosenId: string | null = schoolRow?.overall_grading_system_id || null;

    let chosen: OverallSystemRow | null = null;
    if (chosenId) {
        const { data } = await supabase
            .from('grading_systems')
            .select('id, system_kind, academic_level_id')
            .eq('id', chosenId)
            .maybeSingle();
        chosen = (data as OverallSystemRow) || null;
    }

    // A stored subject-style table is a legacy pick: prefer a real OVERALL
    // table for this learner's level when the school has built one.
    if (!chosen || chosen.system_kind !== 'OVERALL') {
        const { data: overallSystems } = await supabase
            .from('grading_systems')
            .select('id, system_kind, academic_level_id')
            .eq('school_id', schoolId)
            .eq('system_kind', 'OVERALL');
        const candidates = (overallSystems || []) as OverallSystemRow[];
        const preferred = academicLevelId
            ? candidates.find(s => s.academic_level_id === academicLevelId)
            : undefined;
        const fallback = candidates.find(s => !s.academic_level_id);
        chosen = preferred || fallback || chosen;
    }

    if (!chosen) return { kind: 'PERCENTAGE' };

    // Never grade a learner against another level's table.
    if (chosen.academic_level_id && academicLevelId && chosen.academic_level_id !== academicLevelId) {
        return { kind: 'PERCENTAGE' };
    }

    const { data: scales } = await supabase
        .from('grading_scales')
        .select('*')
        .eq('grading_system_id', chosen.id)
        .order('order_index', { ascending: true });

    if (!scales || scales.length === 0) return { kind: 'PERCENTAGE' };

    const overallScales = (scales as Record<string, unknown>[]).map(s => ({
        ...s,
        min_percentage: Number(s.min_percentage),
        max_percentage: Number(s.max_percentage),
        points: s.points != null ? Number(s.points) : undefined,
        order_index: Number(s.order_index),
    })) as unknown as GradingScale[];

    return {
        scales: overallScales,
        // An OVERALL table is written in points; its own ceiling says whether
        // those are totals (1..84) or means (1..12). A subject-style table
        // still stored as the overall choice keeps grading percentages.
        kind: chosen.system_kind === 'OVERALL' ? overallKindFromScales(overallScales) : 'PERCENTAGE',
    };
}

interface StudentLike {
    academic_level_id?: string | null;
    grade_streams?: { full_name?: string | null; grade_id?: string | null } | null;
}

/**
 * Resolve the grading systems that apply to one student.
 *
 * Shared by the report-card PDF routes and the public verification page so a
 * scanned QR code can never show a different grade from the paper card it was
 * printed on.
 */
export async function resolveGradingContext(
    supabase: Supabase,
    student: StudentLike,
    schoolId?: string | null
): Promise<GradingContext> {
    // Determine grading system by grade code — G7-8, G11-12, F3-4 use KCSE
    // style; Grade 9 and 10 are CBC.
    const streamName = student.grade_streams?.full_name || '';
    const gradeId = student.grade_streams?.grade_id;

    let gradeLevelCode = '';
    if (gradeId) {
        const { data: gradeData } = await supabase.from('grades').select('code').eq('id', gradeId).maybeSingle();
        if (gradeData) gradeLevelCode = gradeData.code || '';
    }

    const isKCSEGrade = isKCSEGradeLevel(gradeLevelCode, streamName);

    let gradingSystemType: 'KCSE' | 'CBC' = 'KCSE';
    let gradingScales: GradingScale[] = [];

    if (student.academic_level_id) {
        const { data: academicLevel } = await supabase
            .from('academic_levels')
            .select('code')
            .eq('id', student.academic_level_id)
            .maybeSingle();

        // Use grade code to determine KCSE vs CBC, fallback to academic level
        if (isKCSEGrade) {
            gradingSystemType = 'KCSE';
        } else if (academicLevel) {
            gradingSystemType = academicLevel.code === 'CBC' ? 'CBC' : 'KCSE';
        }

        // Fetch grading systems for this academic level - get the one with
        // scales. Only SUBJECT-kind systems grade subject marks; an OVERALL
        // (points-band) system must never be chosen as the subject default.
        const { data: allGradingSystems } = await supabase
            .from('grading_systems')
            .select('id, name')
            .eq('academic_level_id', student.academic_level_id)
            .neq('system_kind', 'OVERALL');

        // Find the grading system with scales (prefer KCSE/8-4-4 letter grades)
        let gradingSystemId: string | null = null;
        if (allGradingSystems && allGradingSystems.length > 0) {
            for (const gs of allGradingSystems) {
                // A head+count query returns the count in `count`, not `data`
                // (data is always null) — reading `.length` off data meant
                // this "prefer the system that actually has scales" check
                // never fired, so the report always fell to the name-based
                // fallback and could pick an empty system → blank grades.
                const { count: scalesCount } = await supabase
                    .from('grading_scales')
                    .select('id', { count: 'exact', head: true })
                    .eq('grading_system_id', gs.id);

                if (scalesCount && scalesCount > 0) {
                    gradingSystemId = gs.id;
                    break; // Found one with scales
                }
            }
            // Fallback: prefer system with "KCSE" or "Letter" in name
            if (!gradingSystemId) {
                const preferred = allGradingSystems.find((gs: { name?: string | null }) =>
                    gs.name?.toLowerCase().includes('kcse') ||
                    gs.name?.toLowerCase().includes('letter')
                );
                gradingSystemId = preferred?.id || allGradingSystems[0]?.id;
            }
        }

        if (gradingSystemId) {
            const { data: scales } = await supabase
                .from('grading_scales')
                .select('*')
                .eq('grading_system_id', gradingSystemId)
                .order('order_index', { ascending: true });

            if (scales) {
                gradingScales = scales as GradingScale[];
            }
        }
    }

    // A school-configured Overall Grading System (Settings > Grading) is
    // opt-in — most schools won't have one set, in which case this stays
    // undefined and every existing report card computes exactly as before.
    const overall = await resolveOverallGradingSystem(supabase, schoolId, student.academic_level_id);

    return {
        gradingSystemType,
        gradingScales,
        overallGradingScales: overall.scales,
        overallGradingKind: overall.kind,
        gradeLevelCode,
        isKCSEGrade,
    };
}

/**
 * The single overall grade a student's results carry.
 *
 * KCSE uses the points-based grade; CBC reads the average percentage against
 * the CBC subject bands. CBC deliberately does NOT use `overallGrade`: a
 * school's opt-in Overall Grading System is an 8-4-4 points/letter table, and
 * letting it decide here stamps a CBC learner's card with a letter like "A"
 * beside per-subject levels like EE2.
 *
 * Shared by the report-card routes and the public verification page so the
 * scanned page cannot show a different overall grade from the paper card.
 */
export function resolveOverallGrade(
    perf: { overallGrade: string; grade: string; percentage: number },
    grading: Pick<GradingContext, 'gradingSystemType' | 'gradingScales'>
): string {
    if (grading.gradingSystemType === 'KCSE') return perf.overallGrade;
    return grading.gradingScales.length > 0
        ? getGradeFromScales(perf.percentage, grading.gradingScales)
        : perf.grade;
}

/** UUID with the dashes stripped — 4 fewer QR characters per id. */
const compactId = (id: string) => id.replace(/-/g, '');

/** Restore a compact id to canonical UUID form; passes through anything else. */
export function expandId(value: string): string {
    return /^[0-9a-f]{32}$/i.test(value)
        ? `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
        : value;
}

/**
 * The URL a report card's QR code points at — the public verification page.
 *
 * The term and round travel with it so the scanned page shows the sitting the
 * paper card was printed for, rather than whatever was approved most recently.
 *
 * Every character here becomes QR modules, and a printed card is a fixed
 * physical size, so the payload is kept tight: short `t`/`e` keys and dashless
 * ids hold the code to version 6 (~0.40mm modules at the 56pt print size).
 * Spelling these out in full pushes it to version 7 and measurably harder to
 * scan, so keep any future additions short.
 */
export function buildVerifyUrl(
    baseUrl: string,
    studentId: string,
    termId?: string | null,
    examType?: string | null
): string {
    const params = new URLSearchParams();
    if (termId) params.set('t', compactId(termId));
    if (examType) params.set('e', examType);
    const query = params.toString();
    return `${baseUrl}/verify/${compactId(studentId)}${query ? `?${query}` : ''}`;
}
