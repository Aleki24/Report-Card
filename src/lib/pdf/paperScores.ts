/**
 * Bulk-fetch per-paper (multi-paper component) scores for report cards.
 * Returns a map keyed by `${examId}|${studentId}` with the papers in
 * display order, so report templates can show Paper 1 / Paper 2 / Paper 3
 * columns wherever a subject was assessed in components.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PaperScoreEntry {
    code: string;
    score: number;
    maxScore: number;
}

export async function fetchPaperScores(
    supabase: SupabaseClient,
    examIds: string[],
    studentIds: string[]
): Promise<Map<string, PaperScoreEntry[]>> {
    const result = new Map<string, PaperScoreEntry[]>();
    if (examIds.length === 0 || studentIds.length === 0) return result;

    // Component definitions for enabled multi-paper schemes on these exams
    const { data: defs, error: defsErr } = await supabase
        .from('exam_subject_components')
        .select('id, component_code, max_score, display_order, exam_subject_component_schemes!inner(exam_id, is_enabled, assessment_mode)')
        .in('exam_subject_component_schemes.exam_id', examIds)
        .eq('exam_subject_component_schemes.is_enabled', true)
        .eq('exam_subject_component_schemes.assessment_mode', 'multi_paper');

    if (defsErr || !defs || defs.length === 0) return result;

    const defById = new Map<string, { code: string; maxScore: number; order: number }>();
    for (const d of defs as unknown as { id: string; component_code: string; max_score: number | string; display_order: number }[]) {
        defById.set(d.id, { code: d.component_code, maxScore: Number(d.max_score), order: d.display_order });
    }

    // Per-student component scores
    const { data: scores, error: scoresErr } = await supabase
        .from('exam_mark_components')
        .select('exam_id, student_id, component_id, raw_score')
        .in('exam_id', examIds)
        .in('student_id', studentIds);

    if (scoresErr || !scores) return result;

    const withOrder = new Map<string, (PaperScoreEntry & { order: number })[]>();
    for (const s of scores as { exam_id: string; student_id: string; component_id: string; raw_score: number | string }[]) {
        const def = defById.get(s.component_id);
        if (!def) continue;
        const key = `${s.exam_id}|${s.student_id}`;
        const list = withOrder.get(key) || [];
        list.push({ code: def.code, score: Number(s.raw_score), maxScore: def.maxScore, order: def.order });
        withOrder.set(key, list);
    }

    for (const [key, list] of withOrder) {
        list.sort((a, b) => a.order - b.order);
        result.set(key, list.map(({ code, score, maxScore }) => ({ code, score, maxScore })));
    }
    return result;
}
