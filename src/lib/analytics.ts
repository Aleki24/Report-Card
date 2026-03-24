import type { ExamMark, GradingScale } from '../types';

export interface ExamMarkWithDetails extends ExamMark {
    subject_id: string;
    max_score: number;
}

export function calculatePercentage(score: number, totalPossible: number): number {
    if (totalPossible === 0) return 0;
    return Number(((score / totalPossible) * 100).toFixed(2));
}

/* ── Grade / Points / Rubric from DB scales ─────────────── */

/**
 * Look up grade symbol from the school's grading scales.
 * Falls back to a generic letter grade if no scales are provided.
 */
export function getGradeFromScales(percentage: number, scales?: GradingScale[]): string {
    if (scales && scales.length > 0) {
        const rounded = Math.round(percentage);
        const match = scales.find(s =>
            rounded >= Number(s.min_percentage) && rounded <= Number(s.max_percentage)
        );
        if (match) return match.symbol;
        return '-'; // Return placeholder if scales exist but there's a gap
    }
    // Fallback when no DB scales are available
    return getGradeFromPercentage(percentage);
}

/**
 * Look up KCSE points from percent using grading scales.
 * Returns the `points` field from the matching scale, or undefined.
 */
export function getPointsFromScales(percentage: number, scales: GradingScale[]): number | undefined {
    const rounded = Math.round(percentage);
    const match = scales.find(s =>
        rounded >= Number(s.min_percentage) && rounded <= Number(s.max_percentage)
    );
    return match?.points ?? undefined;
}

/**
 * Look up CBC rubric symbol (EE1, ME2, etc.) from percent using grading scales.
 * Uses the `symbol` field from the matching scale.
 */
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

export function aggregateStudentPerformance(marks: ExamMarkWithDetails[], scales?: GradingScale[]) {
    if (!marks || marks.length === 0) {
        return { totalScore: 0, totalPossible: 0, percentage: 0, gpa: 0, totalPoints: 0, grade: 'N/A', markCount: 0 };
    }

    const totalScore = marks.reduce((sum, mark) => sum + mark.raw_score, 0);
    const totalPossible = marks.reduce((sum, mark) => sum + mark.max_score, 0);

    const percentage = calculatePercentage(totalScore, totalPossible);
    const gpa = getGPAFromPercentage(percentage);
    const grade = scales ? getGradeFromScales(percentage, scales) : getGradeFromPercentage(percentage);

    // Calculate total KCSE points (sum of per-subject points)
    let totalPoints = 0;
    if (scales && scales.length > 0) {
        for (const mark of marks) {
            const pct = calculatePercentage(mark.raw_score, mark.max_score);
            const pts = getPointsFromScales(pct, scales);
            if (pts !== undefined) totalPoints += pts;
        }
    }

    return {
        totalScore,
        totalPossible,
        percentage,
        gpa,
        totalPoints,
        grade,
        markCount: marks.length
    };
}

/* ── Class Ranking ──────────────────────────────────────── */

export function calculateClassRanks(studentAggregates: { studentId: string, percentage: number }[]) {
    if (!studentAggregates || studentAggregates.length === 0) {
        return new Map<string, number>();
    }
    const sorted = [...studentAggregates].sort((a, b) => b.percentage - a.percentage);

    const ranks = new Map<string, number>();
    let currentRank = 1;

    for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i].percentage < sorted[i - 1].percentage) {
            currentRank = i + 1;
        }
        ranks.set(sorted[i].studentId, currentRank);
    }

    return ranks;
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

    return {
        subjectId,
        mean,
        median,
        highest,
        lowest,
        passRate,
        totalStudents
    };
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
        return {
            examId,
            percentage: perf.percentage,
            gpa: perf.gpa
        };
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
    'SCIENCE': 2,
    'HUMANITIES': 3,
    'TECHNICAL': 4,
    'OTHER': 5,
};

export function getCategoryOrder(category: string): number {
    return CATEGORY_ORDER[category] || 99;
}

export function getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
        'LANGUAGE': 'Languages',
        'SCIENCE': 'Sciences',
        'HUMANITIES': 'Humanities',
        'TECHNICAL': 'Technical Subjects',
        'OTHER': 'Other Subjects',
    };
    return labels[category] || category;
}
