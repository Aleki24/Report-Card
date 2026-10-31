import { ArrowUpRight, GraduationCap, LogOut, Repeat2, Route, type LucideIcon } from 'lucide-react';
import type { Hue } from '@/components/ui/tones';
import type { GradeStep, PromotionCounts, PromotionOutcome } from '@/lib/promotion';

/** One colour and icon per outcome, used by the pickers, tallies and summary alike. */
export const OUTCOME_META: Record<PromotionOutcome, { hue: Hue; icon: LucideIcon; count: keyof PromotionCounts; tally: string }> = {
    PROMOTE: { hue: 'emerald', icon: ArrowUpRight, count: 'promoted', tally: 'Move up' },
    GRADUATE: { hue: 'violet', icon: GraduationCap, count: 'graduated', tally: 'Graduate / leave' },
    REPEAT: { hue: 'sky', icon: Repeat2, count: 'repeated', tally: 'Repeat' },
    TRANSFER: { hue: 'slate', icon: LogOut, count: 'transferred', tally: 'Transfer out' },
};

export const OUTCOME_ORDER: readonly PromotionOutcome[] = ['PROMOTE', 'GRADUATE', 'REPEAT', 'TRANSFER'];

/** How a grade's card reads: its badge, colour and one-line explanation. */
export function stepMeta(step: GradeStep, gradeName: string): { hue: Hue; icon: LucideIcon; badge: string; target: string; explain: string } {
    switch (step.kind) {
        case 'PROMOTE':
            return { hue: 'emerald', icon: ArrowUpRight, badge: 'Moves up', target: step.nextGradeName, explain: `Learners move up to ${step.nextGradeName}.` };
        case 'TRANSITION':
            return step.canStay
                ? {
                    hue: 'amber', icon: Route, badge: 'Decide each learner', target: `${step.nextGradeName} or leave`,
                    explain: `${gradeName} learners are placed into ${step.nextLevelName} nationally, so not all of them stay. Mark who joins your ${step.nextGradeName} and who leaves; leavers are archived as having completed ${gradeName}.`,
                }
                : {
                    hue: 'violet', icon: GraduationCap, badge: 'Completes here', target: 'Archived',
                    explain: `Your school has no ${step.nextGradeName} class, so ${gradeName} learners complete here and leave for ${step.nextLevelName}. They are archived as having completed ${gradeName}.`,
                };
        case 'COMPLETE':
            return {
                hue: 'violet', icon: GraduationCap, badge: 'Candidates', target: 'Graduated',
                explain: step.reason === 'FINAL_GRADE'
                    ? `${gradeName} is the last grade, so candidates graduate and are archived.`
                    : `Your school has no ${step.nextGradeName} class, so ${gradeName} learners graduate and are archived. Add ${step.nextGradeName} on the Classes page if they should move up instead.`,
            };
    }
}
