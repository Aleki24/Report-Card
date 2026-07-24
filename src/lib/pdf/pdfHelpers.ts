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

/* ── Auto-generated remarks ──────────────────────────────────
   These are the fallback remarks printed when a teacher hasn't written
   their own. They are read by the learner and their parents, so they stay
   encouraging and specific about the next step — never a judgement of the
   child ("poor", "unsatisfactory") and never a summons or threat. A teacher's
   own comment always takes precedence over anything generated here. */

export function generateShortFeedback(percentage: number | null, grade: string): string {
    if (percentage == null) return '';
    if (percentage >= 80) return 'Excellent grasp of the subject';
    if (percentage >= 65) return 'Good understanding shown';
    if (percentage >= 50) return 'Steady work, keep practising';
    if (percentage >= 35) return 'Improving, needs more practice';
    return 'Keep working, ask for support';
}

export function generateClassTeacherComment(percentage: number, grade: string, totalPoints?: number): string {
    if (percentage >= 80) return 'Excellent results this term. Keep up the consistent effort.';
    if (percentage >= 70) return 'Very good work. Maintain this pace and aim a little higher.';
    if (percentage >= 60) return 'Good performance. With steady revision you can move up further.';
    if (percentage >= 50) return 'A fair term. Focus your revision on the weaker subjects.';
    if (percentage >= 40) return 'You are making progress. Give the difficult subjects more practice time.';
    if (percentage >= 30) return 'There is room to grow. Let us work together on a revision plan.';
    return 'A challenging term. With extra support and regular practice you can improve.';
}

export function generatePrincipalComment(percentage: number, grade: string, totalPoints?: number): string {
    if (percentage >= 80) return 'Outstanding achievement. Congratulations and keep aiming high.';
    if (percentage >= 70) return 'Very good results. Continue with the same commitment.';
    if (percentage >= 60) return 'Good progress. Keep building on these results next term.';
    if (percentage >= 50) return 'A fair performance. Consistent revision will lift these marks.';
    if (percentage >= 40) return 'You are on your way. Keep working and use the support available.';
    if (percentage >= 30) return 'Improvement is possible with steady effort. The school is here to help.';
    return 'Do not lose heart. With guidance and regular practice you can do better next term.';
}

export function barColor(score: number): string {
    if (score >= 80) return '#22A86B';
    if (score >= 60) return '#2563EB';
    if (score >= 40) return '#FF8C00';
    return '#DC2626';
}
