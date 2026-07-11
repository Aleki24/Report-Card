/**
 * Server-side helpers for multi-paper exam subjects.
 * (Kept separate from multi-paper.ts so the pure calculation utilities
 * stay importable from client components.)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExamSubjectComponentScheme } from '@/types';
import { isMultiPaper } from '@/lib/multi-paper';

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
