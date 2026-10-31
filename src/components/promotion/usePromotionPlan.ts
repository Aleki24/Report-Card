"use client";

import { useCallback, useMemo, useState } from 'react';
import {
    countOutcomes, decisionProblem, defaultOutcome, defaultTargetStream, nextGradeId,
    type PromotionCounts, type PromotionDecision, type PromotionGrade, type PromotionOutcome,
} from '@/lib/promotion';

export interface LearnerChoice {
    outcome: PromotionOutcome | null;
    /** The class a promoted learner moves into. */
    to: string | null;
}

interface PlanState {
    choices: Record<string, LearnerChoice>;
    /** Each class's default class to move into, set from the class row. */
    classTargets: Record<string, string | null>;
}

const toFor = (outcome: PromotionOutcome | null, target: string | null): string | null => (outcome === 'PROMOTE' ? target : null);

function initialState(grades: readonly PromotionGrade[]): PlanState {
    const state: PlanState = { choices: {}, classTargets: {} };
    for (const grade of grades) {
        const outcome = defaultOutcome(grade.step);
        const canMove = nextGradeId(grade.step) !== null;
        for (const cls of grade.classes) {
            const target = canMove ? defaultTargetStream(cls, grade.nextClasses) : null;
            state.classTargets[cls.id] = target;
            for (const l of cls.learners) state.choices[l.id] = { outcome, to: toFor(outcome, target) };
        }
    }
    return state;
}

export interface PromotionPlanApi {
    choices: Readonly<Record<string, LearnerChoice>>;
    classTargets: Readonly<Record<string, string | null>>;
    counts: PromotionCounts;
    /** Learners with no outcome yet (Grade 9s the school must decide). */
    undecided: number;
    /** Learners whose choice can't be applied, e.g. promoted with no class. */
    incomplete: number;
    total: number;
    setLearner: (learnerId: string, classId: string, patch: Partial<LearnerChoice>) => void;
    /** Gives every learner of these classes the same outcome. */
    setClassesOutcome: (classIds: readonly string[], outcome: PromotionOutcome) => void;
    /** Sets where a class moves to, for its learners being promoted. */
    setClassTarget: (classId: string, target: string | null) => void;
    decisions: () => PromotionDecision[];
}

/** The admin's promotion plan for every enrolled learner, starting from each grade's usual step. */
export function usePromotionPlan(grades: readonly PromotionGrade[]): PromotionPlanApi {
    const [state, setState] = useState<PlanState>(() => initialState(grades));

    const classesById = useMemo(() => {
        const map = new Map<string, { grade: PromotionGrade; learnerIds: string[] }>();
        for (const grade of grades) for (const cls of grade.classes) map.set(cls.id, { grade, learnerIds: cls.learners.map(l => l.id) });
        return map;
    }, [grades]);

    const setLearner = useCallback((learnerId: string, classId: string, patch: Partial<LearnerChoice>) => {
        setState(prev => {
            const current = prev.choices[learnerId];
            const outcome = patch.outcome !== undefined ? patch.outcome : current.outcome;
            const to = patch.to !== undefined ? patch.to : current.to ?? prev.classTargets[classId] ?? null;
            return { ...prev, choices: { ...prev.choices, [learnerId]: { outcome, to: toFor(outcome, to) } } };
        });
    }, []);

    const setClassesOutcome = useCallback((classIds: readonly string[], outcome: PromotionOutcome) => {
        setState(prev => {
            const choices = { ...prev.choices };
            for (const classId of classIds) {
                for (const id of classesById.get(classId)?.learnerIds ?? []) {
                    choices[id] = { outcome, to: toFor(outcome, choices[id]?.to ?? prev.classTargets[classId] ?? null) };
                }
            }
            return { ...prev, choices };
        });
    }, [classesById]);

    const setClassTarget = useCallback((classId: string, target: string | null) => {
        setState(prev => {
            const choices = { ...prev.choices };
            for (const id of classesById.get(classId)?.learnerIds ?? []) {
                choices[id] = { ...choices[id], to: toFor(choices[id].outcome, target) };
            }
            return { choices, classTargets: { ...prev.classTargets, [classId]: target } };
        });
    }, [classesById]);

    const summary = useMemo(() => {
        let undecided = 0;
        let incomplete = 0;
        for (const { grade, learnerIds } of classesById.values()) {
            const nextIds = new Set(grade.nextClasses.map(c => c.id));
            for (const id of learnerIds) {
                const choice = state.choices[id];
                if (!choice.outcome) undecided++;
                else if (decisionProblem(grade.step, { outcome: choice.outcome, to_stream_id: choice.to }, nextIds)) incomplete++;
            }
        }
        const outcomes = Object.values(state.choices).map(c => c.outcome);
        return { undecided, incomplete, total: outcomes.length, counts: countOutcomes(outcomes) };
    }, [classesById, state.choices]);

    const decisions = useCallback((): PromotionDecision[] => {
        const list: PromotionDecision[] = [];
        for (const [classId, { learnerIds }] of classesById) {
            for (const id of learnerIds) {
                const { outcome, to } = state.choices[id];
                if (outcome) list.push({ student_id: id, from_stream_id: classId, outcome, to_stream_id: to });
            }
        }
        return list;
    }, [classesById, state.choices]);

    return { choices: state.choices, classTargets: state.classTargets, ...summary, setLearner, setClassesOutcome, setClassTarget, decisions };
}
