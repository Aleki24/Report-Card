/**
 * Server-side helpers for multi-paper exam subjects.
 * (Kept separate from multi-paper.ts so the pure calculation utilities
 * stay importable from client components.)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExamSubjectComponentScheme, GradeBand } from '@/types';
import { gradeSymbolFromScales } from '@/lib/analytics';
import { calculateCompositeSubjectScore, isMultiPaper, normalizeResolvedRawScore } from '@/lib/multi-paper';
import { fetchAllRows } from '@/lib/postgrest';
import { findOfferedSubject } from '@/lib/school-subjects';

/**
 * Fetch the component scheme (with its components, sorted by
 * display_order) for an exam. Returns null when the exam has no scheme.
 */
export async function fetchExamComponentScheme(
    supabase: SupabaseClient,
    examId: string
): Promise<ExamSubjectComponentScheme | null> {
    const { data, error } = await supabase
        .from('exam_subject_component_schemes')
        .select(`
            id, exam_id, subject_id, school_id, assessment_mode, aggregation_method, is_enabled,
            exam_subject_components ( id, scheme_id, component_code, component_name, max_score, weight, display_order )
        `)
        .eq('exam_id', examId)
        .maybeSingle();

    if (error || !data) return null;

    const { exam_subject_components, ...scheme } = data as Record<string, unknown> & {
        exam_subject_components?: { max_score: number | string; display_order: number }[];
    };
    const components = (exam_subject_components || [])
        .map(c => ({ ...c, max_score: Number(c.max_score) }))
        .sort((a, b) => a.display_order - b.display_order);

    return { ...scheme, components } as unknown as ExamSubjectComponentScheme;
}

/**
 * Fetch an enabled multi-paper scheme for an exam, or null when the
 * exam should follow the legacy single-paper flow.
 */
export async function fetchActiveMultiPaperScheme(
    supabase: SupabaseClient,
    examId: string
): Promise<ExamSubjectComponentScheme | null> {
    const scheme = await fetchExamComponentScheme(supabase, examId);
    return isMultiPaper(scheme) ? scheme : null;
}

/** Every learner's per-paper scores for an exam, keyed by student. */
async function paperScoresByStudent(supabase: SupabaseClient, examId: string): Promise<Map<string, Map<string, number>>> {
    const { rows, error } = await fetchAllRows<{ student_id: string; component_id: string; raw_score: number | string }>(() => supabase
        .from('exam_mark_components')
        .select('id, student_id, component_id, raw_score')
        .eq('exam_id', examId)
        .order('id'));
    if (error) throw error;
    const byStudent = new Map<string, Map<string, number>>();
    for (const r of rows) {
        const papers = byStudent.get(r.student_id) ?? new Map<string, number>();
        papers.set(r.component_id, Number(r.raw_score));
        byStudent.set(r.student_id, papers);
    }
    return byStudent;
}

/**
 * The papers whose new maximum is below a score already entered for them,
 * as "P1 (3 learners above 60)", so a scheme edit is refused before it
 * leaves marks above their paper's maximum.
 */
export async function papersOverNewMax(
    supabase: SupabaseClient,
    examId: string,
    newMaxById: ReadonlyMap<string, { code: string; max: number }>,
): Promise<string[]> {
    const over = new Map<string, number>();
    for (const papers of (await paperScoresByStudent(supabase, examId)).values()) {
        for (const [componentId, score] of papers) {
            const next = newMaxById.get(componentId);
            if (next && score > next.max) over.set(componentId, (over.get(componentId) ?? 0) + 1);
        }
    }
    return [...over].map(([id, count]) => {
        const { code, max } = newMaxById.get(id)!;
        return `${code} (${count} learner${count === 1 ? '' : 's'} above ${max})`;
    });
}

interface ExamScales {
    /** The subject's own grading system, which mark entry grades on by default. */
    own: GradeBand[] | null;
    /** Every system a mark can have been graded on, the subject's own first. */
    candidates: GradeBand[][];
}

interface StoredMark { student_id: string; percentage: number | string | null; grade_symbol: string | null }

/**
 * The bands of every grading system a mark of this exam can have been graded
 * on: the subject's own, and the others for its level a teacher can pick at
 * mark entry (the school's and the shared ones).
 */
async function examGradingScales(supabase: SupabaseClient, examId: string): Promise<ExamScales> {
    const none: ExamScales = { own: null, candidates: [] };
    const { data: exam, error } = await supabase
        .from('exams')
        .select('school_id, subject_id')
        .eq('id', examId)
        .maybeSingle<{ school_id: string; subject_id: string | null }>();
    if (error) throw error;
    if (!exam?.subject_id) return none;
    // How this school grades the subject lives on its offering of it.
    const subject = await findOfferedSubject(supabase, exam.school_id, exam.subject_id, 'grading_system_id, academic_level_id');
    if (!subject) return none;

    const scopes = [
        subject.grading_system_id && `id.eq.${subject.grading_system_id}`,
        subject.academic_level_id && `and(academic_level_id.eq.${subject.academic_level_id},or(school_id.eq.${exam.school_id},school_id.is.null))`,
    ].filter(Boolean);
    if (scopes.length === 0) return none;
    const { data: systems, error: systemsError } = await supabase
        .from('grading_systems')
        .select('id, system_kind, grading_scales ( symbol, min_percentage, max_percentage )')
        .or(scopes.join(','));
    if (systemsError) throw systemsError;

    const usable = ((systems ?? []) as { id: string; system_kind: string | null; grading_scales: GradeBand[] | null }[])
        .filter(sys => sys.system_kind !== 'OVERALL' && (sys.grading_scales?.length ?? 0) > 0)
        .sort((a, b) => Number(b.id === subject.grading_system_id) - Number(a.id === subject.grading_system_id));
    return {
        own: usable.find(sys => sys.id === subject.grading_system_id)?.grading_scales ?? null,
        candidates: usable.map(sys => sys.grading_scales!),
    };
}

/**
 * A mark's grade at its new percentage, on the scale it was graded on: the
 * one whose band for the old percentage is its stored grade, the subject's
 * own first. A grade no scale gives that percentage was picked by hand and
 * is kept. An ungraded mark takes the subject's own scale, or none (null),
 * which the exam_marks trigger then fills.
 */
function regrade(stored: StoredMark | undefined, percentage: number, scales: ExamScales): string | null {
    const symbol = stored?.grade_symbol?.trim() ?? '';
    if (!symbol) return scales.own ? gradeSymbolFromScales(percentage, scales.own) : null;
    if (stored?.percentage == null) return symbol;
    const gradedOn = scales.candidates.find(bands => gradeSymbolFromScales(Number(stored.percentage), bands) === symbol);
    return (gradedOn && gradeSymbolFromScales(percentage, gradedOn)) ?? symbol;
}

/**
 * Re-derives every learner's subject score for an exam from their saved
 * paper scores under the exam's current scheme. A stored subject score is
 * computed when it is saved; changing a paper's maximum, weight, the
 * aggregation or removing a paper otherwise left every stored percentage
 * (and so report cards, rankings and analytics) on the old scheme.
 *
 * The grade moves with it. The exam_marks trigger grades only a row without
 * one, and mark entry always sends one, so a new percentage kept its old
 * grade and points: 65% printed beside the C that 50% had earned.
 */
export async function recomputeExamComposites(supabase: SupabaseClient, examId: string, examMaxScore: number): Promise<number> {
    const scheme = await fetchActiveMultiPaperScheme(supabase, examId);
    if (!scheme) return 0;
    const [papersByStudent, storedRes, scales] = await Promise.all([
        paperScoresByStudent(supabase, examId),
        fetchAllRows<StoredMark & { id: string }>(() => supabase
            .from('exam_marks')
            .select('id, student_id, percentage, grade_symbol')
            .eq('exam_id', examId)
            .order('id')),
        examGradingScales(supabase, examId),
    ]);
    if (storedRes.error) throw storedRes.error;
    const stored = new Map(storedRes.rows.map(m => [m.student_id, m]));

    // Every row carries its grade: an upsert sets a column a row leaves out to null.
    const updates: { exam_id: string; student_id: string; raw_score: number; percentage: number; grade_symbol: string | null }[] = [];
    for (const [studentId, papers] of papersByStudent) {
        const inputs = (scheme.components ?? []).map(c => ({
            componentId: c.id,
            code: c.component_code,
            maxScore: Number(c.max_score),
            score: papers.has(c.id) ? papers.get(c.id)! : null,
            displayOrder: c.display_order,
        }));
        if (inputs.every(i => i.score === null)) continue;
        const result = calculateCompositeSubjectScore(inputs, scheme.aggregation_method);
        updates.push({
            exam_id: examId,
            student_id: studentId,
            raw_score: normalizeResolvedRawScore(result.finalPercentage, examMaxScore),
            percentage: result.finalPercentage,
            grade_symbol: regrade(stored.get(studentId), result.finalPercentage, scales),
        });
    }
    for (let i = 0; i < updates.length; i += 500) {
        const { error } = await supabase.from('exam_marks').upsert(updates.slice(i, i + 500), { onConflict: 'exam_id,student_id' });
        if (error) throw error;
    }
    return updates.length;
}
