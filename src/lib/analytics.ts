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

/**
 * Whether a grade level uses KCSE-style (points-based) grading rather than CBC.
 * G7-8, G11-12, and F3-4 are KCSE. Checks both the grade code and the stream
 * name so a class carrying its level only in one field is still classified
 * consistently everywhere — report cards, marksheets, the student dashboard,
 * and school stats must all agree, or the same student can rank by points in
 * one view and by percentage in another.
 */
export function isKCSEGradeLevel(gradeCode?: string | null, streamName?: string | null): boolean {
    const code = gradeCode || '';
    const stream = streamName || '';
    const combined = `${code} ${stream}`;
    return /^(G[78]|G1[12]|F[34])/i.test(code)
        || /^(G[78]|G1[12]|F[34])/i.test(stream)
        || /\b(F[34]|G[78]|G1[12])\b/i.test(combined);
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
    subjectNames?: Record<string, string>,
    subjectCategories?: Record<string, string>
): AggregateResult {
    if (!marks || marks.length === 0) {
        return { totalScore: 0, totalPossible: 0, percentage: 0, rawAverage: 0, used844Selection: false, gpa: 0, totalPoints: 0, grade: 'N/A', overallGrade: '-', markCount: 0 };
    }

    let marksToProcess = marks;
    let selectedSubjectIds: string[] = [];
    let used844Selection = false;
    
    // Only apply 844 selection for KCSE system (grades 7-12, form 1-4), not for CBC
    const isKCSE = gradingSystemType !== 'CBC';
    
    if (isKCSE && subjectNames && Object.keys(subjectNames).length > 0) {
        const marksWithNames: MarkWithSubjectName[] = marks.map(m => ({
            ...m,
            subjectName: subjectNames[m.subject_id] || '',
            category: (subjectCategories?.[m.subject_id] as SubjectCategory) || undefined
        }));
        
        // Fix: always run select844Subjects; the function handles <8 subjects internally
        const selectedMarks = select844Subjects(marksWithNames, scales || []);
        marksToProcess = selectedMarks as ExamMarkWithDetails[];
        selectedSubjectIds = selectedMarks.map(m => m.subject_id);
        used844Selection = true;
        console.log('[aggregateStudentPerformance] 844 Selection applied:', marksWithNames.length, '->', selectedMarks.length, 'subjects');
    }

    const totalScore = marksToProcess.reduce((sum, mark) => sum + mark.raw_score, 0);
    const totalPossible = marksToProcess.reduce((sum, mark) => sum + mark.max_score, 0);

    const subjectPercentages = marksToProcess.map(m => calculatePercentage(m.raw_score, m.max_score));

    // Use grade-based points for KCSE, scale-based points for CBC
    let totalPoints = 0;
    if (gradingSystemType === 'KCSE') {
        for (const mark of marksToProcess) {
            // Prefer the entered grade symbol, but fall back to points derived
            // from the percentage via the grading scales when no grade was
            // stored (e.g. bulk-uploaded scores with no grade column). Without
            // this, every such mark scored 0 points and the whole class tied.
            let pts = getPointsFromGrade((mark as any).grade_symbol || '');
            if (!pts && scales && scales.length > 0) {
                const pct = calculatePercentage(mark.raw_score, mark.max_score);
                pts = getPointsFromScales(pct, scales) || 0;
            }
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

// Returns the KCSE cluster category for a subject by name, or null when the
// name isn't recognised (e.g. a subject stored under a bare KNEC code like
// "565"). A confident name match is preferred over the DB category because a
// school's stored category can be wrong — most notably Business Studies, which
// is an applied/TECHNICAL subject for 8-4-4 clustering but is often seeded as
// HUMANITY. Callers fall back to the DB category only when this returns null.
function identifySubjectCategory(subjectName: string): SubjectCategory | null {
    const name = subjectName.toLowerCase().trim();
    if (!name) return null;

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
    // Technical / applied subjects (the "technicals": agriculture, business,
    // computer, home science, and any explicitly technical subject).
    if (name.includes('computer')) return 'TECHNICAL';
    if (name.includes('business')) return 'TECHNICAL';
    if (name.includes('agriculture')) return 'TECHNICAL';
    if (name.includes('home science')) return 'TECHNICAL';
    if (name.includes('technical')) return 'TECHNICAL';

    return null;
}

export function select844Subjects(marks: MarkWithSubjectName[], scales: GradingScale[]): MarkWithSubjectName[] {
    if (!marks || marks.length === 0) return marks;
    
    const numSubjects = marks.length;
    
    if (numSubjects <= 7) {
        return marks;
    }
    
    const marksWithCategory = marks.map(m => {
        // Use user-selected grade_symbol for points, not percentage-based
        const pts = getPointsFromGrade((m as any).grade_symbol || '');
        // Categorise by NAME first (a confident keyword match), then fall back
        // to the school's stored subjects.category. Name wins because the DB
        // category is frequently wrong for applied subjects — Business Studies
        // is an applied/TECHNICAL subject for 8-4-4 clustering but is commonly
        // seeded as HUMANITY. Name matching only returns null for subjects
        // stored under a bare KNEC code (e.g. "565"), and only then do we trust
        // the DB category. CREATIVE electives fold into TECHNICAL for
        // clustering; anything still unknown defaults to TECHNICAL.
        const nameCategory = identifySubjectCategory(m.subjectName || '');
        const rawDb = m.category as string | undefined;
        const dbCategory = rawDb === 'CREATIVE' ? 'TECHNICAL' : rawDb;
        const category: SubjectCategory = nameCategory
            ?? (dbCategory as SubjectCategory | undefined)
            ?? 'TECHNICAL';
        return {
            ...m,
            category,
            points: pts,
        };
    });

    const languages = marksWithCategory.filter(m => m.category === 'LANGUAGE');
    const mathematics = marksWithCategory.filter(m => m.category === 'MATHEMATICS');
    const sciences = marksWithCategory.filter(m => m.category === 'SCIENCE');
    const humanities = marksWithCategory.filter(m => m.category === 'HUMANITY');
    const technicals = marksWithCategory.filter(m => m.category === 'TECHNICAL');

    // KCSE 8-4-4 cluster rule for the 7 subjects that earn points:
    //   • Compulsory  → English, Kiswahili and Mathematics always count.
    //   • Sciences    → the best 2 of Biology / Chemistry / Physics count;
    //                   a 3rd (weakest) science is dropped.
    //   • Humanities  → the best 1 (History / Geography / CRE / IRE / HRE).
    //   • Technicals  → the best 1 (Agriculture / Business / Computer / etc.).
    // Those quotas total exactly 7 for the standard combination. If a student
    // is short in some category (e.g. no technical), the remaining slots are
    // filled up to 7 with the best of everything left over — so the graded
    // set always reaches 7 when the student takes 8+ subjects.
    const selected: MarkWithSubjectName[] = [];

    // 1. Compulsory: all languages (English + Kiswahili) and Mathematics.
    selected.push(...languages);
    selected.push(...mathematics);

    // 2. Sciences: best 2 (sorted before slicing).
    selected.push(...sortByPointsDesc(sciences).slice(0, 2));

    // 3. Humanities: best 1.
    selected.push(...sortByPointsDesc(humanities).slice(0, 1));

    // 4. Technicals: best 1.
    selected.push(...sortByPointsDesc(technicals).slice(0, 1));

    // 5. Fill any still-empty slots up to 7 with the best of everything left
    //    over (a 3rd science, a 2nd humanity/technical) so the total reaches 7.
    const remaining = sortByPointsDesc(marksWithCategory.filter(m => !selected.includes(m)));
    for (const m of remaining) {
        if (selected.length >= 7) break;
        selected.push(m);
    }

    // 6. Defensive cap: the compulsory pushes above are unconditional, so a
    //    student taking 3+ languages could exceed 7. Trim the lowest-scoring
    //    non-mathematics subjects until exactly 7 remain (Mathematics is
    //    single and always compulsory; languages are trimmed before it).
    let finalSelected = selected;
    if (finalSelected.length > 7) {
        const excess = finalSelected.length - 7;
        const trimmable = finalSelected
            .filter(m => m.category !== 'MATHEMATICS')
            .sort((a, b) => (a.points ?? 0) - (b.points ?? 0))
            .slice(0, excess);
        finalSelected = finalSelected.filter(m => !trimmable.includes(m));
    }

    console.log('[select844Subjects] Input subjects:', numSubjects, 'Selected:', finalSelected.length, 'Categories:', finalSelected.map(s => `${s.subjectName}(${s.category},${s.points})`).join(', '));

    return finalSelected;
}
