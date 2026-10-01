/**
 * Setting a new school up: the standard grades a school ticks, how each is
 * split into classes, the checks before each step and the payload the
 * onboarding API takes. Shared by the web wizard and the mobile app.
 */
import { parseStreamNames } from '../class-names';
import type { Curriculum, OnboardingInput } from '../schemas';

export type StandardGrade = { id: string; code: string; name: string; curriculum: Curriculum };

/** A ticked grade: one class named after the grade, or named streams. */
export type ClassPlan = { hasStreams: boolean; streams: string };

export const CURRICULUM_OPTIONS: Record<Curriculum, { label: string; description: string }> = {
    CBC: { label: 'CBC', description: 'Competency Based Curriculum' },
    '844': { label: '8-4-4 System', description: 'Traditional Curriculum' },
};

export const ONBOARDING_STEPS = [
    { id: 1, title: 'School Details', description: 'Basic school information' },
    { id: 2, title: 'Calendar', description: 'Set your current year and term' },
    { id: 3, title: 'Curriculum', description: 'Select academic levels' },
    { id: 4, title: 'Classes', description: 'Your grades, as one class or streams' },
    { id: 5, title: 'Subjects', description: 'The subjects every learner takes' },
] as const;

/** Grades ticked with streams switched on but none named yet. */
export function gradesMissingStreams(plans: Record<string, ClassPlan>): string[] {
    return Object.entries(plans).filter(([, p]) => p.hasStreams && parseStreamNames(p.streams).length === 0).map(([id]) => id);
}

export interface OnboardingState {
    schoolName: string;
    schoolEmail: string;
    schoolPhone: string;
    schoolAddress: string;
    academicYear: string;
    term: OnboardingInput['term'];
    curricula: Curriculum[];
    classPlans: Record<string, ClassPlan>;
    offerSubjects: boolean;
}

export const initialOnboarding = (): OnboardingState => ({
    schoolName: '', schoolEmail: '', schoolPhone: '', schoolAddress: '',
    academicYear: new Date().getFullYear().toString(),
    term: { name: 'Term 1', start_date: '', end_date: '' },
    curricula: ['CBC'],
    classPlans: {},
    offerSubjects: true,
});

/** Ticked grades still inside the chosen curricula (unticking a curriculum drops its grades). */
export const chosenGrades = (state: OnboardingState, grades: readonly StandardGrade[]) =>
    grades.filter(g => state.classPlans[g.id] && state.curricula.includes(g.curriculum));

/** Why a step can't continue yet, or null. */
export function onboardingStepProblem(step: number, state: OnboardingState, grades: readonly StandardGrade[]): string | null {
    const { schoolName, academicYear, term, curricula, classPlans } = state;
    if (step === 1 && !schoolName.trim()) return 'School name is required';
    if (step === 2) {
        if (!/^\d{4}$/.test(academicYear)) return 'Enter the academic year, e.g. 2026';
        if (!term.start_date || !term.end_date) return `Enter when ${term.name} starts and ends`;
        if (term.end_date <= term.start_date) return 'The term must end after it starts';
        if (!term.start_date.startsWith(academicYear)) return 'The term should start in the academic year you entered';
    }
    if (step === 3 && curricula.length === 0) return 'Pick at least one curriculum';
    if (step === 4) {
        const chosen = chosenGrades(state, grades);
        if (chosen.length === 0) return 'Tick at least one grade';
        const missing = gradesMissingStreams(classPlans).filter(id => chosen.some(g => g.id === id));
        if (missing.length > 0) return `Name the streams for ${grades.find(g => g.id === missing[0])?.name}, or choose "One class"`;
    }
    return null;
}

export const onboardingPayload = (state: OnboardingState, grades: readonly StandardGrade[]): OnboardingInput => ({
    schoolName: state.schoolName,
    schoolEmail: state.schoolEmail,
    schoolPhone: state.schoolPhone,
    schoolAddress: state.schoolAddress,
    academicYear: state.academicYear,
    term: state.term,
    curricula: state.curricula,
    classes: chosenGrades(state, grades).map(g => ({
        grade_id: g.id,
        streams: state.classPlans[g.id].hasStreams ? parseStreamNames(state.classPlans[g.id].streams) : [],
    })),
    offerCompulsorySubjects: state.offerSubjects,
});
