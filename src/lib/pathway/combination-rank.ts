import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateStudentPerformance, calculateClassRanks } from '@/lib/analytics';
import type { ExamMarkWithDetails } from '@/lib/analytics';
import type { GradingScale } from '@/types';

export interface CombinationRankInfo {
    rank: number;
    size: number;
}

/**
 * CBC senior pathway ranking: ranks every student in the grade
 * (across all streams of the school) who shares one of the given
 * subject combinations, within their combination group.
 *
 * Percentages are derived uniformly from raw exam marks via
 * `aggregateStudentPerformance(..., 'CBC')` for every peer, so the
 * class-report and single-student-report routes always agree on a
 * learner's pathway rank.
 *
 * Returns a map of studentId -> { rank, size }.
 */
export async function computeCombinationRanks(
    supabase: SupabaseClient,
    opts: {
        schoolId: string;
        gradeId: string;
        /** Used when the grade has no resolvable streams (defensive) */
        fallbackStreamId: string;
        combinationIds: string[];
        termId: string;
        yearId?: string | null;
        gradingScales: GradingScale[];
    }
): Promise<Map<string, CombinationRankInfo>> {
    const result = new Map<string, CombinationRankInfo>();
    if (opts.combinationIds.length === 0) return result;

    const { data: gradeStreams } = await supabase
        .from('grade_streams')
        .select('id')
        .eq('grade_id', opts.gradeId)
        .eq('school_id', opts.schoolId);
    const gradeStreamIds = (gradeStreams ?? []).map((gs: { id: string }) => gs.id);

    const { data: peers } = await supabase
        .from('students')
        .select('id, subject_combination_id')
        .in('current_grade_stream_id', gradeStreamIds.length > 0 ? gradeStreamIds : [opts.fallbackStreamId])
        .in('subject_combination_id', opts.combinationIds);
    if (!peers || peers.length === 0) return result;

    const peerIds = peers.map((p: { id: string }) => p.id);
    let marksQuery = supabase
        .from('exam_marks')
        .select('student_id, raw_score, grade_symbol, exams!inner(id, max_score, term_id, academic_year_id, subjects(id))')
        .in('student_id', peerIds)
        .eq('exams.term_id', opts.termId);
    if (opts.yearId) marksQuery = marksQuery.eq('exams.academic_year_id', opts.yearId);
    const { data: peerMarks } = await marksQuery;

    type PeerMarkRow = {
        student_id: string;
        raw_score: number;
        grade_symbol: string | null;
        exams: { id: string; max_score: number; subjects: { id: string } | null };
    };
    const marksByPeer: Record<string, ExamMarkWithDetails[]> = {};
    for (const m of (peerMarks ?? []) as unknown as PeerMarkRow[]) {
        if (!marksByPeer[m.student_id]) marksByPeer[m.student_id] = [];
        marksByPeer[m.student_id].push({
            id: '',
            student_id: m.student_id,
            exam_id: m.exams.id || '',
            subject_id: m.exams.subjects?.id || '',
            raw_score: Number(m.raw_score),
            percentage: 0, // unused: CBC aggregation derives from raw/max
            max_score: Number(m.exams.max_score),
            grade_symbol: m.grade_symbol ?? undefined,
        });
    }

    const peersByCombination = new Map<string, { studentId: string; percentage: number }[]>();
    for (const peer of peers as { id: string; subject_combination_id: string }[]) {
        const marks = marksByPeer[peer.id] || [];
        const percentage = marks.length > 0
            ? aggregateStudentPerformance(marks, opts.gradingScales, 'CBC', {}, {}).percentage
            : 0;
        if (!peersByCombination.has(peer.subject_combination_id)) {
            peersByCombination.set(peer.subject_combination_id, []);
        }
        peersByCombination.get(peer.subject_combination_id)!.push({ studentId: peer.id, percentage });
    }

    for (const entries of peersByCombination.values()) {
        const ranks = calculateClassRanks(entries);
        for (const entry of entries) {
            const rank = ranks.get(entry.studentId);
            if (rank !== undefined) {
                result.set(entry.studentId, { rank, size: entries.length });
            }
        }
    }

    return result;
}
