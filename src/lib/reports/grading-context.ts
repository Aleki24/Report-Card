import type { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isKCSEGradeLevel } from '@/lib/analytics';
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
    /** Whether those overall bands are read against total points or average percentage. */
    overallGradingKind: 'POINTS' | 'PERCENTAGE';
    gradeLevelCode: string;
    isKCSEGrade: boolean;
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
    let overallGradingScales: GradingScale[] | undefined;
    let overallGradingKind: 'POINTS' | 'PERCENTAGE' = 'POINTS';
    if (schoolId) {
        const { data: schoolRow } = await supabase
            .from('schools')
            .select('overall_grading_system_id')
            .eq('id', schoolId)
            .maybeSingle();
        if (schoolRow?.overall_grading_system_id) {
            const [{ data: overallSystem }, { data: overallScales }] = await Promise.all([
                supabase.from('grading_systems').select('system_kind').eq('id', schoolRow.overall_grading_system_id).maybeSingle(),
                supabase.from('grading_scales').select('*').eq('grading_system_id', schoolRow.overall_grading_system_id).order('order_index', { ascending: true }),
            ]);
            if (overallScales && overallScales.length > 0) {
                overallGradingScales = overallScales as GradingScale[];
                // An OVERALL-kind system grades total points; a subject-style
                // system chosen as overall grades average percentage.
                overallGradingKind = overallSystem?.system_kind === 'SUBJECT' ? 'PERCENTAGE' : 'POINTS';
            }
        }
    }

    return {
        gradingSystemType,
        gradingScales,
        overallGradingScales,
        overallGradingKind,
        gradeLevelCode,
        isKCSEGrade,
    };
}

/**
 * The URL a report card's QR code points at — the public verification page.
 *
 * The term and round are carried along so the scanned page shows the same
 * sitting the paper card was printed for, not merely the latest one.
 */
export function buildVerifyUrl(
    baseUrl: string,
    studentId: string,
    termId?: string | null,
    examType?: string | null
): string {
    const params = new URLSearchParams();
    if (termId) params.set('term', termId);
    if (examType) params.set('examType', examType);
    const query = params.toString();
    return `${baseUrl}/verify/${studentId}${query ? `?${query}` : ''}`;
}
