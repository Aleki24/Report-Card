import { Mark } from '../types';

/**
 * Core mathematical utilities for the Results Analysis Engine.
 */

// Calculate percentage from a raw score
export function calculatePercentage(score: number, totalPossible: number): number {
    if (totalPossible === 0) return 0;
    return Number(((score / totalPossible) * 100).toFixed(2));
}

// Map percentage to a letter Grade
export function getGradeFromPercentage(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

// Map percentage to a GPA scale (0.0 to 4.0)
export function getGPAFromPercentage(percentage: number): number {
    if (percentage >= 90) return 4.0;
    if (percentage >= 80) return 3.5;
    if (percentage >= 70) return 3.0;
    if (percentage >= 60) return 2.0;
    if (percentage >= 50) return 1.0;
    return 0.0;
}

// Aggregate a student's marks for a specific exam
export function aggregateStudentPerformance(marks: Mark[]) {
    if (!marks || marks.length === 0) {
        return { totalScore: 0, totalPossible: 0, percentage: 0, gpa: 0, grade: 'N/A' };
    }

    const totalScore = marks.reduce((sum, mark) => sum + mark.score, 0);
    const totalPossible = marks.reduce((sum, mark) => sum + mark.total_possible, 0);

    const percentage = calculatePercentage(totalScore, totalPossible);
    const gpa = getGPAFromPercentage(percentage);
    const grade = getGradeFromPercentage(percentage);

    return {
        totalScore,
        totalPossible,
        percentage,
        gpa,
        grade,
        markCount: marks.length
    };
}

// Calculate ranks for a class of students
// Input: Map or Array of student aggregates
export function calculateClassRanks(studentAggregates: { studentId: string, percentage: number }[]) {
    // Sort descending by percentage
    const sorted = [...studentAggregates].sort((a, b) => b.percentage - a.percentage);

    const ranks = new Map<string, number>();
    let currentRank = 1;

    for (let i = 0; i < sorted.length; i++) {
        // Handle ties by checking if the percentage matches the previous student
        if (i > 0 && sorted[i].percentage < sorted[i - 1].percentage) {
            currentRank = i + 1;
        }
        ranks.set(sorted[i].studentId, currentRank);
    }

    return ranks;
}

/**
 * Subject & Class Performance Aggregations
 */

export interface SubjectStats {
    subjectId: string;
    mean: number;
    median: number;
    highest: number;
    lowest: number;
    passRate: number; // percentage of students who passed (>= 50%)
    totalStudents: number;
}

export function calculateSubjectStats(subjectId: string, marks: Mark[]): SubjectStats {
    const subjectMarks = marks.filter(m => m.subject_id === subjectId);
    const totalStudents = subjectMarks.length;

    if (totalStudents === 0) {
        return { subjectId, mean: 0, median: 0, highest: 0, lowest: 0, passRate: 0, totalStudents: 0 };
    }

    // Calculate percentages for each mark
    const percentages = subjectMarks
        .map(m => calculatePercentage(m.score, m.total_possible))
        .sort((a, b) => a - b); // Sort ascending for median and min/max

    const lowest = percentages[0];
    const highest = percentages[percentages.length - 1];

    // Mean
    const sum = percentages.reduce((acc, val) => acc + val, 0);
    const mean = Number((sum / totalStudents).toFixed(2));

    // Median
    const mid = Math.floor(totalStudents / 2);
    const median = totalStudents % 2 !== 0
        ? percentages[mid]
        : Number(((percentages[mid - 1] + percentages[mid]) / 2).toFixed(2));

    // Pass rate
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

/**
 * Trend Analysis & Comparative Metrics
 */

// Compares the performance of a student across multiple terms (exams)
export function getStudentTrend(studentId: string, allMarks: Mark[]) {
    const studentMarks = allMarks.filter(m => m.student_id === studentId);

    // Group marks by exam_id
    const marksByExam = studentMarks.reduce((acc, mark) => {
        if (!acc[mark.exam_id]) acc[mark.exam_id] = [];
        acc[mark.exam_id].push(mark);
        return acc;
    }, {} as Record<string, Mark[]>);

    // Calculate aggregate performance per exam
    const trends = Object.keys(marksByExam).map(examId => {
        const perf = aggregateStudentPerformance(marksByExam[examId]);
        return {
            examId,
            percentage: perf.percentage,
            gpa: perf.gpa
        };
    });

    return trends; // The UI can chart these sequentially
}

// Actionable feedback generator based on percentage
export function generateFeedback(percentage: number, subjectName: string): string {
    if (percentage >= 90) return `Exceptional performance in ${subjectName}. Keep up the excellent work! Consider advanced enrichment activities.`;
    if (percentage >= 80) return `Strong understanding of ${subjectName}. To reach the top tier, review minor occasional errors in assignments.`;
    if (percentage >= 70) return `Good effort. There are some foundational gaps in ${subjectName} that need targeted practice to improve consistency.`;
    if (percentage >= 60) return `Passing, but struggling with core concepts in ${subjectName}. Recommend after-school tutoring or extra worksheets.`;
    return `Critical attention needed for ${subjectName}. Please schedule a parent-teacher conference. Foundational remediation is required.`;
}
