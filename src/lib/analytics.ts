import type { ExamMark, GradingScale } from '../types';

export const OVERALL_POINTS_GRADES = [
    { symbol: 'A', min: 81, max: 84 },
    { symbol: 'A-', min: 74, max: 80 },
    { symbol: 'B+', min: 67, max: 73 },
    { symbol: 'B', min: 60, max: 66 },
    { symbol: 'B-', min: 53, max: 59 },
    { symbol: 'C+', min: 46, max: 52 },
    { symbol: 'C', min: 39, max: 45 },
    { symbol: 'C-', min: 32, max: 38 },
    { symbol: 'D+', min: 25, max: 31 },
    { symbol: 'D', min: 18, max: 24 },
    { symbol: 'D-', min: 11, max: 17 },
    { symbol: 'E', min: 1, max: 10 },
];

export function getOverallGradeFromPoints(totalPoints: number): string {
    const match = OVERALL_POINTS_GRADES.find(g => totalPoints >= g.min && totalPoints <= g.max);
    return match?.symbol || '-';
}

export interface ExamMarkWithDetails extends ExamMark {
    subject_id: string;
    max_score: number;
}

export function calculatePercentage(score: number, totalPossible: number): number {
    if (totalPossible === 0) return 0;
    return Number(((score / totalPossible) * 100).toFixed(2));
}

/* ── Grade / Points / Rubric from DB scales ─────────────── */

export function getGradeFromScales(percentage: number, scales?: GradingScale[]): string {
    if (scales && scales.length > 0) {
        const rounded = Math.round(percentage);
        const match = scales.find(s =>
            rounded >= Number(s.min_percentage) && rounded <= Number(s.max_percentage)
        );
        if (match) return match.symbol;
        return '-';
    }
    return getGradeFromPercentage(percentage);
}

export function getPointsFromScales(percentage: number, scales: GradingScale[]): number | undefined {
    const rounded = Math.round(percentage);
    const match = scales.find(s =>
        rounded >= Number(s.min_percentage) && rounded <= Number(s.max_percentage)
    );
    return match?.points ?? undefined;
}

export function getRubricFromScales(percentage: number, scales: GradingScale[]): string | undefined {
    const rounded = Math.round(percentage);
    const match = scales.find(s =>
        rounded >= Number(s.min_percentage) && rounded <= Number(s.max_percentage)
    );
    return match?.symbol ?? undefined;
}

/* ── Legacy fallback functions (used when no DB scales) ── */

export function getGradeFromPercentage(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

export function getGPAFromPercentage(percentage: number): number {
    if (percentage >= 90) return 4.0;
    if (percentage >= 80) return 3.5;
    if (percentage >= 70) return 3.0;
    if (percentage >= 60) return 2.0;
    if (percentage >= 50) return 1.0;
    return 0.0;
}

/* ── Aggregation ─────────────────────────────────────────── */

export interface AggregateResult {
    totalScore: number;
    totalPossible: number;
    percentage: number;
    rawAverage: number;
    used844Selection: boolean;
    gpa: number;
    totalPoints: number;
    grade: string;
    overallGrade: string;
    markCount: number;
    selectedSubjectIds?: string[];
}

export function aggregateStudentPerformance(
    marks: ExamMarkWithDetails[],
    scales?: GradingScale[],
    gradingSystemType?: 'KCSE' | 'CBC',
    subjectNames?: Record<string, string>
): AggregateResult {
    if (!marks || marks.length === 0) {
        return { totalScore: 0, totalPossible: 0, percentage: 0, rawAverage: 0, used844Selection: false, gpa: 0, totalPoints: 0, grade: 'N/A', overallGrade: '-', markCount: 0 };
    }

    let marksToProcess = marks;
    let selectedSubjectIds: string[] = [];
    let used844Selection = false;

    if (subjectNames && Object.keys(subjectNames).length > 0) {
        const marksWithNames: MarkWithSubjectName[] = marks.map(m => ({
            ...m,
            subjectName: subjectNames[m.subject_id] || ''
        }));

        // FIX 1: Always run selection (not just >=8) — select844Subjects handles <=7 internally
        const selectedMarks = select844Subjects(marksWithNames, scales || []);
        marksToProcess = selectedMarks as ExamMarkWithDetails[];
        selectedSubjectIds = selectedMarks.map(m => m.subject_id);
        used844Selection = true;
    } else {
        selectedSubjectIds = marks.map(m => m.subject_id);
    }

    const totalScore = marksToProcess.reduce((sum, mark) => sum + mark.raw_score, 0);
    const totalPossible = marksToProcess.reduce((sum, mark) => sum + mark.max_score, 0);

    // FIX 4: avgPercentage = mean of raw subject percentages (not points-derived formula)
    const subjectPercentages = marksToProcess.map(m => calculatePercentage(m.raw_score, m.max_score));
    const numSubjects = marksToProcess.length;
    const avgPercentage = numSubjects > 0
        ? subjectPercentages.reduce((a, b) => a + b, 0) / numSubjects
        : 0;

    let totalPoints = 0;
    if (scales && scales.length > 0) {
        for (const mark of marksToProcess) {
            const pct = calculatePercentage(mark.raw_score, mark.max_score);
            const pts = getPointsFromScales(pct, scales);
            if (pts !== undefined) totalPoints += pts;
        }
    }

    const rawAverage = numSubjects > 0 ? totalScore / numSubjects : 0;
    const percentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    const gpa = getGPAFromPercentage(avgPercentage);
    const grade = scales ? getGradeFromScales(avgPercentage, scales) : getGradeFromPercentage(avgPercentage);
    const overallGrade = getOverallGradeFromPoints(totalPoints);

    return {
        totalScore,
        totalPossible,
        percentage: avgPercentage,
        rawAverage,
        used844Selection,
        gpa,
        totalPoints,
        grade,
        overallGrade,
        markCount: marksToProcess.length,
        selectedSubjectIds
    };
}

/* ── Class Ranking ──────────────────────────────────────── */

export function calculateClassRanks(
    studentAggregates: { studentId: string, percentage: number, totalPoints?: number }[],
    rankingBy: 'percentage' | 'points' = 'percentage'
) {
    if (!studentAggregates || studentAggregates.length === 0) {
        return new Map<string, number>();
    }

    const sorted = [...studentAggregates].sort((a, b) => {
        if (rankingBy === 'points' && a.totalPoints !== undefined && b.totalPoints !== undefined) {
            return b.totalPoints - a.totalPoints;
        }
        return b.percentage - a.percentage;
    });

    const ranks = new Map<string, number>();
    let currentRank = 1;

    for (let i = 0; i < sorted.length; i++) {
        const aVal = rankingBy === 'points' ? (sorted[i] as any).totalPoints : sorted[i].percentage;
        const bVal = rankingBy === 'points' ? (sorted[i - 1] as any)?.totalPoints : sorted[i - 1]?.percentage;

        if (i > 0 && aVal < bVal) {
            currentRank = i + 1;
        }
        ranks.set(sorted[i].studentId, currentRank);
    }

    return ranks;
}

/* ── Per-subject student count ────────────────────────── */

export function getSubjectStudentCounts(subjectAggs: Record<string, { studentId: string; pct: number }[]>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [subjId, entries] of Object.entries(subjectAggs)) {
        const uniqueStudents = new Set(entries.map(e => e.studentId));
        counts[subjId] = uniqueStudents.size;
    }
    return counts;
}

/* ── Subject Stats ──────────────────────────────────────── */

export interface SubjectStats {
    subjectId: string;
    mean: number;
    median: number;
    highest: number;
    lowest: number;
    passRate: number;
    totalStudents: number;
}

export function calculateSubjectStats(subjectId: string, marks: ExamMarkWithDetails[]): SubjectStats {
    const subjectExamMarks = marks.filter(m => m.subject_id === subjectId);
    const totalStudents = subjectExamMarks.length;

    if (totalStudents === 0) {
        return { subjectId, mean: 0, median: 0, highest: 0, lowest: 0, passRate: 0, totalStudents: 0 };
    }

    const percentages = subjectExamMarks
        .map(m => calculatePercentage(m.raw_score, m.max_score))
        .sort((a, b) => a - b);

    const lowest = percentages[0];
    const highest = percentages[percentages.length - 1];
    const sum = percentages.reduce((acc, val) => acc + val, 0);
    const mean = Number((sum / totalStudents).toFixed(2));

    const mid = Math.floor(totalStudents / 2);
    const median = totalStudents % 2 !== 0
        ? percentages[mid]
        : Number(((percentages[mid - 1] + percentages[mid]) / 2).toFixed(2));

    const passes = percentages.filter(p => p >= 50).length;
    const passRate = Number(((passes / totalStudents) * 100).toFixed(2));

    return { subjectId, mean, median, highest, lowest, passRate, totalStudents };
}

/* ── Student Trend ──────────────────────────────────────── */

export function getStudentTrend(studentId: string, allExamMarks: ExamMarkWithDetails[]) {
    const studentExamMarks = allExamMarks.filter(m => m.student_id === studentId);

    const marksByExam = studentExamMarks.reduce((acc, mark) => {
        if (!acc[mark.exam_id]) acc[mark.exam_id] = [];
        acc[mark.exam_id].push(mark);
        return acc;
    }, {} as Record<string, ExamMarkWithDetails[]>);

    const trends = Object.keys(marksByExam).map(examId => {
        const perf = aggregateStudentPerformance(marksByExam[examId]);
        return { examId, percentage: perf.percentage, gpa: perf.gpa };
    });

    return trends;
}

/* ── Feedback ───────────────────────────────────────────── */

export function generateFeedback(percentage: number, subjectName: string): string {
    if (percentage >= 90) return `Exceptional performance in ${subjectName}. Keep up the excellent work! Consider advanced enrichment activities.`;
    if (percentage >= 80) return `Strong understanding of ${subjectName}. To reach the top tier, review minor occasional errors in assignments.`;
    if (percentage >= 70) return `Good effort. There are some foundational gaps in ${subjectName} that need targeted practice to improve consistency.`;
    if (percentage >= 60) return `Passing, but struggling with core concepts in ${subjectName}. Recommend after-school tutoring or extra worksheets.`;
    return `Critical attention needed for ${subjectName}. Please schedule a parent-teacher conference. Foundational remediation is required.`;
}

/* ── Subject Category Ordering ──────────────────────────── */

const CATEGORY_ORDER: Record<string, number> = {
    'LANGUAGE': 1,
    'MATHEMATICS': 2,
    'SCIENCE': 3,
    'HUMANITY': 4,
    'TECHNICAL': 5,
};

export function getCategoryOrder(category: string): number {
    return CATEGORY_ORDER[category] || 99;
}

export function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        'LANGUAGE': 'Languages',
        'MATHEMATICS': 'Mathematics',
        'SCIENCE': 'Sciences',
        'HUMANITY': 'Humanities',
        'TECHNICAL': 'Technical Subjects',
    };
    return labels[category] || category;
}

export type SubjectCategory = 'LANGUAGE' | 'MATHEMATICS' | 'SCIENCE' | 'HUMANITY' | 'TECHNICAL';

export interface MarkWithSubjectName extends ExamMarkWithDetails {
    subjectName?: string;
    category?: SubjectCategory;
    points?: number;
}

function sortByPointsDesc(arr: MarkWithSubjectName[]): MarkWithSubjectName[] {
    return [...arr].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

function identifySubjectCategory(subjectName: string): SubjectCategory {
    const name = subjectName.toLowerCase().trim();

    if (name.includes('english')) return 'LANGUAGE';
    if (name.includes('kiswahili') || name.includes('swahili')) return 'LANGUAGE';
    if (name.includes('math')) return 'MATHEMATICS';
    if (name.includes('physics')) return 'SCIENCE';
    if (name.includes('chemistry')) return 'SCIENCE';
    if (name.includes('biology')) return 'SCIENCE';
    if (name.includes('geography')) return 'HUMANITY';
    if (name.includes('history')) return 'HUMANITY';
    if (name.includes('christian religious') || name === 'cre') return 'HUMANITY';
    if (name.includes('islamic religious') || name === 'ire') return 'HUMANITY';
    if (name.includes('hindu religious') || name === 'hre') return 'HUMANITY';
    if (name.includes('religious')) return 'HUMANITY';
    if (name.includes('computer')) return 'TECHNICAL';
    if (name.includes('business')) return 'TECHNICAL';
    if (name.includes('agriculture')) return 'TECHNICAL';
    if (name.includes('home science')) return 'TECHNICAL';
    if (name.includes('technical drawing') || name.includes('building construction') || name.includes('power mechanics') || name.includes('woodwork') || name.includes('metalwork')) return 'TECHNICAL';

    return 'TECHNICAL';
}

export function select844Subjects(marks: MarkWithSubjectName[], scales: GradingScale[]): MarkWithSubjectName[] {
    if (!marks || marks.length === 0) return marks;

    // If 7 or fewer subjects, no selection needed — use all
    if (marks.length <= 7) return marks;

    const marksWithCategory = marks.map(m => {
        const pct = calculatePercentage(m.raw_score, m.max_score);
        const pts = getPointsFromScales(pct, scales) ?? 0;
        return {
            ...m,
            category: identifySubjectCategory(m.subjectName || ''),
            points: pts
        };
    });

    const languages  = marksWithCategory.filter(m => m.category === 'LANGUAGE');
    const mathematics = marksWithCategory.filter(m => m.category === 'MATHEMATICS');
    const sciences   = marksWithCategory.filter(m => m.category === 'SCIENCE');
    const humanities = marksWithCategory.filter(m => m.category === 'HUMANITY');
    const technicals = marksWithCategory.filter(m => m.category === 'TECHNICAL');

    const selected: MarkWithSubjectName[] = [];

    // Step 1: All languages (English + Kiswahili) — always compulsory
    selected.push(...languages);

    // Step 2: Mathematics — always compulsory
    selected.push(...mathematics);

    // Step 3: Sciences — best 2 if 3+, all if 2 or fewer
    const sortedSciences = sortByPointsDesc(sciences);
    if (sciences.length <= 2) {
        selected.push(...sortedSciences);
    } else {
        selected.push(sortedSciences[0], sortedSciences[1]);
    }

    // Step 4: Humanities — best 1 always
    if (humanities.length > 0) {
        const sortedHumanities = sortByPointsDesc(humanities);
        selected.push(sortedHumanities[0]);
    }

    // FIX 2: Technicals — best 1 always (no subject-count gate)
    if (technicals.length > 0) {
        const sortedTechnicals = sortByPointsDesc(technicals);
        selected.push(sortedTechnicals[0]);
    }

    // FIX 3: Fill-up — only use extra technicals (2nd, 3rd, etc.)
    // Never re-add from sciences or humanities (they are capped by design)
    if (selected.length < 7 && technicals.length > 1) {
        const usedIds = new Set(selected.map(m => m.subject_id));
        const extraTechnicals = sortByPointsDesc(technicals).slice(1);
        for (const m of extraTechnicals) {
            if (!usedIds.has(m.subject_id) && selected.length < 7) {
                selected.push(m);
                usedIds.add(m.subject_id);
            }
        }
    }

    return selected;
}
