import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateStudentPerformance, calculateClassRanks, type ExamMarkWithDetails } from '@/lib/analytics';
import { pathwayLabel } from '@/lib/pathway-definitions';
import type { SeniorRankGroup } from '@/lib/ranking';
import type { GradingScale } from '@/types';

/**
 * Overall positions: every stream of a grade ranked together.
 *
 * A stream position says how a learner did in their room; a school with
 * Form 3 East, West and North also wants one order for the whole form. CBC
 * Senior School can instead be ranked within a pathway or a subject
 * combination (the school's `senior_rank_group`), still across every stream.
 *
 * Scored exactly like the stream position — the same round, the same 8-4-4
 * best-seven points or CBC percentage — so the two figures on a card can be
 * compared. Learners with no marks in the round are left unranked.
 */
export interface GradePosition {
    rank: number;
    size: number;
    /** Who the learner was ranked against, e.g. "Form 3, all streams" or "STEM pathway, Grade 10". */
    label: string;
}

export interface GradePositions {
    byStudent: Map<string, GradePosition>;
    /**
     * Whether the overall position says anything the stream position doesn't:
     * the grade has several streams, or learners are grouped by pathway or
     * combination. A one-stream grade ranked whole is the stream position again.
     */
    differsFromStream: boolean;
}

type Options = {
    schoolId: string;
    gradeId: string;
    termId: string;
    yearId?: string | null;
    /** The exam round the card reports (exam_type); null ranks every mark in the term. */
    round: string | null;
    /** Only released exams (what a learner may see). */
    releasedOnly?: boolean;
    gradingScales: GradingScale[];
    gradingSystemType: 'KCSE' | 'CBC';
    /** The school's Senior School grouping; applies to CBC Grades 10-12 only. */
    seniorRankGroup: SeniorRankGroup;
};

type PeerRow = {
    id: string;
    pathway: string | null;
    subject_combination_id: string | null;
    subject_combinations: { code: string } | { code: string }[] | null;
};

type MarkRow = {
    student_id: string;
    raw_score: number;
    grade_symbol: string | null;
    exams: { id: string; max_score: number; subjects: { id: string; name: string | null; category: string | null } | null };
};

const PAGE = 1000;
/** Keeps each `in (…)` list well inside URL limits. */
const ID_CHUNK = 150;

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);

export async function computeGradePositions(supabase: SupabaseClient, opts: Options): Promise<GradePositions> {
    const empty: GradePositions = { byStudent: new Map(), differsFromStream: false };

    const [{ data: grade }, { data: streams }] = await Promise.all([
        supabase.from('grades').select('name_display, numeric_order').eq('id', opts.gradeId).maybeSingle(),
        supabase.from('grade_streams').select('id').eq('grade_id', opts.gradeId).eq('school_id', opts.schoolId),
    ]);
    const streamIds = (streams ?? []).map(s => s.id as string);
    if (streamIds.length === 0) return empty;

    const { data: peerData } = await supabase
        .from('students')
        .select('id, pathway, subject_combination_id, subject_combinations ( code )')
        .in('current_grade_stream_id', streamIds);
    const peers = (peerData ?? []) as unknown as PeerRow[];
    if (peers.length === 0) return empty;

    const gradeName = (grade?.name_display as string | undefined) ?? 'Grade';
    const order = Number(grade?.numeric_order);
    const isSenior = opts.gradingSystemType === 'CBC' && order >= 10 && order <= 12;
    const group: SeniorRankGroup = isSenior ? opts.seniorRankGroup : 'GRADE';

    const groupOf = (peer: PeerRow): { key: string; label: string } => {
        if (group === 'PATHWAY') {
            return peer.pathway
                ? { key: peer.pathway, label: `${pathwayLabel(peer.pathway)} pathway, ${gradeName}` }
                : { key: '', label: `${gradeName}, no pathway yet` };
        }
        if (group === 'COMBINATION') {
            const code = one(peer.subject_combinations)?.code;
            return peer.subject_combination_id
                ? { key: peer.subject_combination_id, label: `${code ?? 'Same'} combination, ${gradeName}` }
                : { key: '', label: `${gradeName}, no combination yet` };
        }
        return { key: '', label: streamIds.length > 1 ? `${gradeName}, all streams` : gradeName };
    };

    const marks = await loadRoundMarks(supabase, peers.map(p => p.id), opts);
    const subjectNames: Record<string, string> = {};
    const subjectCategories: Record<string, string> = {};
    const marksByPeer = new Map<string, ExamMarkWithDetails[]>();
    for (const m of marks) {
        const subject = m.exams.subjects;
        if (subject?.name) subjectNames[subject.id] = subject.name;
        if (subject?.category) subjectCategories[subject.id] = subject.category;
        const list = marksByPeer.get(m.student_id) ?? [];
        list.push({
            id: '',
            student_id: m.student_id,
            exam_id: m.exams.id,
            subject_id: subject?.id ?? '',
            raw_score: Number(m.raw_score),
            percentage: 0, // derived from raw/max by the aggregation
            max_score: Number(m.exams.max_score),
            grade_symbol: m.grade_symbol ?? undefined,
        });
        marksByPeer.set(m.student_id, list);
    }

    const groups = new Map<string, { label: string; entries: { studentId: string; percentage: number; totalPoints?: number }[] }>();
    for (const peer of peers) {
        const peerMarks = marksByPeer.get(peer.id);
        if (!peerMarks?.length) continue;
        const perf = aggregateStudentPerformance(peerMarks, opts.gradingScales, opts.gradingSystemType, subjectNames, subjectCategories);
        const { key, label } = groupOf(peer);
        const bucket = groups.get(key) ?? { label, entries: [] };
        bucket.entries.push({ studentId: peer.id, percentage: perf.percentage, totalPoints: perf.totalPoints });
        groups.set(key, bucket);
    }

    const byStudent = new Map<string, GradePosition>();
    const rankingBy = opts.gradingSystemType === 'KCSE' ? 'points' : 'percentage';
    for (const { label, entries } of groups.values()) {
        const ranks = calculateClassRanks(entries, rankingBy);
        for (const { studentId } of entries) {
            const rank = ranks.get(studentId);
            if (rank) byStudent.set(studentId, { rank, size: entries.length, label });
        }
    }

    return { byStudent, differsFromStream: streamIds.length > 1 || group !== 'GRADE' };
}

/** Every mark the grade's learners have in the round, past PostgREST's 1,000-row page. */
async function loadRoundMarks(supabase: SupabaseClient, studentIds: string[], opts: Options): Promise<MarkRow[]> {
    const rows: MarkRow[] = [];
    for (let i = 0; i < studentIds.length; i += ID_CHUNK) {
        const ids = studentIds.slice(i, i + ID_CHUNK);
        for (let from = 0; ; from += PAGE) {
            let query = supabase
                .from('exam_marks')
                .select('id, student_id, raw_score, grade_symbol, exams!inner ( id, max_score, term_id, academic_year_id, exam_type, status, subjects ( id, name, category ) )')
                .in('student_id', ids)
                .eq('exams.term_id', opts.termId)
                .order('id')
                .range(from, from + PAGE - 1);
            if (opts.yearId) query = query.eq('exams.academic_year_id', opts.yearId);
            if (opts.round) query = query.eq('exams.exam_type', opts.round);
            if (opts.releasedOnly) query = query.eq('exams.status', 'APPROVED');

            const { data, error } = await query;
            if (error) throw new Error(`Failed to load marks for overall positions: ${error.message}`);
            const page = (data ?? []) as unknown as (MarkRow & { exams: MarkRow['exams'] | MarkRow['exams'][] })[];
            for (const row of page) {
                const exam = one(row.exams);
                if (exam) rows.push({ ...row, exams: { ...exam, subjects: one(exam.subjects) } });
            }
            if (page.length < PAGE) break;
        }
    }
    return rows;
}
