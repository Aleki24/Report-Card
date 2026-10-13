/**
 * Server-side helpers for multi-paper exam subjects.
 * (Kept separate from multi-paper.ts so the pure calculation utilities
 * stay importable from client components.)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExamSubjectComponentScheme } from '@/types';
import { calculateCompositeSubjectScore, isMultiPaper, normalizeResolvedRawScore } from '@/lib/multi-paper';
import { fetchAllRows } from '@/lib/postgrest';

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

/**
 * Re-derives every learner's subject score for an exam from their saved
 * paper scores under the exam's current scheme. A stored subject score is
 * computed when it is saved; changing a paper's maximum, weight, the
 * aggregation or removing a paper otherwise left every stored percentage
 * (and so report cards, rankings and analytics) on the old scheme. Writing
 * the row also re-grades it (the exam_marks trigger).
 */
export async function recomputeExamComposites(supabase: SupabaseClient, examId: string, examMaxScore: number): Promise<number> {
    const scheme = await fetchActiveMultiPaperScheme(supabase, examId);
    if (!scheme) return 0;
    const updates: { exam_id: string; student_id: string; raw_score: number; percentage: number }[] = [];
    for (const [studentId, papers] of await paperScoresByStudent(supabase, examId)) {
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
        });
    }
    for (let i = 0; i < updates.length; i += 500) {
        const { error } = await supabase.from('exam_marks').upsert(updates.slice(i, i + 500), { onConflict: 'exam_id,student_id' });
        if (error) throw error;
    }
    return updates.length;
}
