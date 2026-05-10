import { GREEN } from './pdfStyles';

export function gradeColor(grade: string): string {
    const base = grade.replace(/[+-\d]/g, '').toUpperCase();
    switch (base) {
        case 'A': case 'EE': return GREEN;
        case 'B': case 'ME': return '#2563EB';
        case 'C': case 'AE': return '#FF8C00';
        case 'D': case 'BE': return '#DC2626';
        default: return '#EF4444';
    }
}

export function generateShortFeedback(percentage: number | null, grade: string): string {
    if (percentage == null) return '';
    if (percentage >= 80) return 'Excellent work';
    if (percentage >= 60) return 'Good progress';
    if (percentage >= 40) return 'Fair, needs improvement';
    return 'Needs more effort';
}

export function generateClassTeacherComment(percentage: number, grade: string, totalPoints?: number): string {
    if (percentage >= 90) return 'Outstanding performance! Keep up the excellent work.';
    if (percentage >= 80) return 'Great work! You are performing very well.';
    if (percentage >= 70) return 'Good progress. Keep working hard.';
    if (percentage >= 60) return 'Fair performance. Focus on improving weak areas.';
    if (percentage >= 50) return 'You need to put more effort. Seek help where needed.';
    if (percentage >= 40) return 'Performance is below average. Please see me for extra help.';
    return 'Urgent improvement needed. Parent meeting required.';
}

export function generatePrincipalComment(percentage: number, grade: string, totalPoints?: number): string {
    if (percentage >= 90) return 'Congratulations on your outstanding achievement. Keep aiming for excellence.';
    if (percentage >= 80) return 'Excellent performance. You make us proud. Continue the good work.';
    if (percentage >= 70) return 'Good performance. With more dedication, you can achieve even better results.';
    if (percentage >= 60) return 'Satisfactory performance. We encourage you to work harder.';
    if (percentage >= 50) return 'Performance needs improvement. We believe you can do better.';
    if (percentage >= 40) return 'Performance is unsatisfactory. Please put more effort.';
    return 'Poor performance. Immediate improvement is required. Parents to see the principal.';
}

export function barColor(score: number): string {
    if (score >= 80) return '#22A86B';
    if (score >= 60) return '#2563EB';
    if (score >= 40) return '#FF8C00';
    return '#DC2626';
}
