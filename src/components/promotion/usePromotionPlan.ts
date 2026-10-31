"use client";

import { useCallback, useMemo, useState } from 'react';
import {
    initialPlan, planDecisions, planSummary, withClassTarget, withClassesOutcome, withLearnerChoice,
    type LearnerChoice, type PromotionDecision, type PromotionGrade, type PromotionOutcome, type PromotionPlanState, type PromotionPlanSummary,
} from '@/lib/promotion';

export interface PromotionPlanApi extends PromotionPlanState, PromotionPlanSummary {
    setLearner: (learnerId: string, classId: string, patch: Partial<LearnerChoice>) => void;
    /** Gives every learner of these classes the same outcome. */
    setClassesOutcome: (classIds: readonly string[], outcome: PromotionOutcome) => void;
    /** Sets where a class moves to, for its learners being promoted. */
    setClassTarget: (classId: string, target: string | null) => void;
    decisions: () => PromotionDecision[];
}

/** The admin's promotion plan for every enrolled learner (rules in `@/lib/promotion`). */
export function usePromotionPlan(grades: readonly PromotionGrade[]): PromotionPlanApi {
    const [plan, setPlan] = useState<PromotionPlanState>(() => initialPlan(grades));
    const setLearner = useCallback((id: string, classId: string, patch: Partial<LearnerChoice>) => setPlan(p => withLearnerChoice(p, id, classId, patch)), []);
    const setClassesOutcome = useCallback((ids: readonly string[], o: PromotionOutcome) => setPlan(p => withClassesOutcome(p, grades, ids, o)), [grades]);
    const setClassTarget = useCallback((id: string, t: string | null) => setPlan(p => withClassTarget(p, grades, id, t)), [grades]);
    const decisions = useCallback(() => planDecisions(grades, plan), [grades, plan]);
    const summary = useMemo(() => planSummary(grades, plan), [grades, plan]);
    return { ...plan, ...summary, setLearner, setClassesOutcome, setClassTarget, decisions };
}
