import type { ExamMark, GradingScale } from '../types';

export const GRADE_TO_POINTS: Record<string, number> = {
    'A': 12, 'A-': 11,
    'B+': 10, 'B': 9, 'B-': 8,
    'C+': 7, 'C': 6, 'C-': 5,
    'D+': 4, 'D': 3, 'D-': 2,
    'E': 1,
};

// KNEC mean points to overall grade scale (meanPoints = totalPoints / 7)
export const MEAN_POINTS_GRADES = [
    { symbol: 'A', min: 11.5 },
    { symbol: 'A-', min: 10.5 },
    { symbol: 'B+', min: 9.5 },
    { symbol: 'B', min: 8.5 },
    { symbol: 'B-', min: 7.5 },
    { symbol: 'C+', min: 6.5 },
    { symbol: 'C', min: 5.5 },
    { symbol: 'C-', min: 4.5 },
    { symbol: 'D+', min: 3.5 },
    { symbol: 'D', min: 2.5 },
    { symbol: 'D-', min: 1.5 },
    { symbol: 'E', min: 0 },
];

export function getOverallGradeFromMeanPoints(meanPoints: number): string {
    const match = MEAN_POINTS_GRADES.find(g => meanPoints >= g.min);
    return match?.symbol || '-';
}

export function getGradeFromPercentageSimple(percentage: number): string {
    if (percentage >= 81) return 'A';
    if (percentage >= 74) return 'A-';
    if (percentage >= 67) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 53) return 'B-';
    if (percentage >= 46) return 'C+';
    if (percentage >= 39) return 'C';
    if (percentage >= 32) return 'C-';
    if (percentage >= 25) return 'D+';
    if (percentage >= 18) return 'D';
    if (percentage >= 11) return 'D-';
    if (percentage >= 7) return 'E';
    return 'E';
}

export function getPointsFromGrade(grade: string): number {
    return GRADE_TO_POINTS[grade?.trim()] ?? 0;
}

export interface ExamMarkWithDetails extends ExamMark {
    subject_id: string;
    max_score: number;
    grade_symbol?: string;
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
        return '-';
    }
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
        
        // FIX 1: Always run selection — select844Subjects handles <=7 internally
        const selectedMarks = select844Subjects(marksWithNames, scales || []);
        marksToProcess = selectedMarks as ExamMarkWithDetails[];
        selectedSubjectIds = selectedMarks.map(m => m.subject_id);
        used844Selection = true;
    } else {
        selectedSubjectIds = marks.map(m => m.subject_id);
    }

    const totalScore = marksToProcess.reduce((sum, mark) => sum + mark.raw_score, 0);
    const totalPossible = marksToProcess.reduce((sum, mark) => sum + mark.max_score, 0);

    const subjectPercentages = marksToProcess.map(m => calculatePercentage(m.raw_score, m.max_score));

    // Use grade-based points for KCSE, scale-based points for CBC
    let totalPoints = 0;
    if (gradingSystemType === 'KCSE') {
        for (const mark of marksToProcess) {
            const pts = getPointsFromGrade((mark as any).grade_symbol || '');
            totalPoints += pts;
        }
    } else {
        // CBC: use points from grading scales
        for (const mark of marksToProcess) {
            const pct = calculatePercentage(mark.raw_score, mark.max_score);
            const pts = scales ? getPointsFromScales(pct, scales) : 0;
            totalPoints += pts || 0;
        }
    }

    const numSubjects = marksToProcess.length;
    const meanPoints = numSubjects > 0 ? totalPoints / numSubjects : 0;

    const avgPercentage = numSubjects > 0 
        ? subjectPercentages.reduce((a, b) => a + b, 0) / numSubjects 
        : 0;

    const rawAverage = numSubjects > 0 ? totalScore / numSubjects : 0;

    const percentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    const gpa = getGPAFromPercentage(avgPercentage);
    const grade = scales ? getGradeFromScales(avgPercentage, scales) : getGradeFromPercentage(avgPercentage);

    // overallGrade: KCSE uses mean points, CBC uses percentage-based grade
    let overallGrade: string;
    if (gradingSystemType === 'KCSE') {
        overallGrade = getOverallGradeFromMeanPoints(meanPoints);
    } else {
        // CBC: use the grade derived from percentage
        overallGrade = grade;
    }

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
        const bVal = rankingBy === 'points' ? (sorted[i-1] as any)?.totalPoints : sorted[i-1]?.percentage;
        
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
        // Get unique student IDs for this subject
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
    if (name.includes('kiswahili')) return 'LANGUAGE';
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
    if (name.includes('technical')) return 'TECHNICAL';
    
    return 'TECHNICAL';
}

export function select844Subjects(marks: MarkWithSubjectName[], scales: GradingScale[]): MarkWithSubjectName[] {
    if (!marks || marks.length === 0) return marks;
    
    // If 7 or fewer subjects, no selection needed — return all as-is
    if (marks.length <= 7) return marks;

    const marksWithCategory = marks.map(m => {
        // Use user-selected grade_symbol for points, not percentage-based
        const pts = getPointsFromGrade((m as any).grade_symbol || '');
        return {
            ...m,
            category: identifySubjectCategory(m.subjectName || ''),
            points: pts
        };
    });
    
    const languages = marksWithCategory.filter(m => m.category === 'LANGUAGE');
    const mathematics = marksWithCategory.filter(m => m.category === 'MATHEMATICS');
    const sciences = marksWithCategory.filter(m => m.category === 'SCIENCE');
    const humanities = marksWithCategory.filter(m => m.category === 'HUMANITY');
    const technicals = marksWithCategory.filter(m => m.category === 'TECHNICAL');
    
    const selected: MarkWithSubjectName[] = [];
    
    // Step 1: Always include all languages (English + Kiswahili)
    selected.push(...languages);
    
    // Step 2: Always include mathematics
    selected.push(...mathematics);
    
    // Step 3: Sciences - best 2 if 3+, all if 2 or fewer
    const sortedSciences = sortByPointsDesc(sciences);
    if (sciences.length <= 2) {
        selected.push(...sortedSciences);
    } else {
        selected.push(sortedSciences[0], sortedSciences[1]);
    }
    
    // Step 4: Humanities - best 1 always
    if (humanities.length > 0) {
        const sortedHumanities = sortByPointsDesc(humanities);
        selected.push(sortedHumanities[0]);
    }
    
    // FIX 2: Technicals - best 1 always (removed numSubjects >= 8 gate)
    if (technicals.length > 0) {
        const sortedTechnicals = sortByPointsDesc(technicals);
        selected.push(sortedTechnicals[0]);
    }
    
    // FIX 3: Fill-up only from extra technicals (index 1+)
    // Never re-add from sciences or humanities — they are capped by design
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
