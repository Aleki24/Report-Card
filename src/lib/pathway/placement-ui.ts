/**
 * The placement screen's rules, shared by the web Subjects page and the
 * mobile app: which classes can be placed, what each learner starts with,
 * the combinations to choose from, and what is sent when placing.
 *
 * Choice values: "existing:<id>", "official:<code>" or "custom:<code,code,code>".
 */
import { isSeniorSchoolGrade } from '../curriculum-bands';
import { MINISTRY_COMBINATION_TEMPLATES, PATHWAYS, PATHWAY_ORDER, type CbcPathway, type MathsCode } from '../pathway-definitions';
import { customCombinationCode, type PlacementTarget, type SchoolCombinationOption, type SeniorLearnerRow } from './placement';

/** One pickable combination. */
export type ChoiceOption = { value: string; code: string; name: string; detail: string };
/** A ministry combination the school hasn't set up yet; runnable when it offers all three subjects. */
export type MinistryChoice = ChoiceOption & { pathway: CbcPathway; runnable: boolean };

export type SeniorDraft = { include: boolean; choice: string; maths: MathsCode | '' };

type GradeLike = { id: string; code?: string | null; name_display: string; academic_level_id: string; numeric_order: number };
type StreamLike = { id: string; full_name: string; grade_id: string };

const OFFICIAL_BY_CODE = new Map(MINISTRY_COMBINATION_TEMPLATES.map(t => [t.code as string, t]));

/** Placement applies to CBC Senior School (Grades 10-12) and every 8-4-4 class. */
export function placeableStreams<S extends StreamLike>(grades: readonly GradeLike[], streams: readonly S[], academicLevels: readonly { id: string; code: string }[]): S[] {
    const codeByLevel = new Map(academicLevels.map(l => [l.id, l.code]));
    const eligible = new Set(
        grades
            .filter(g => {
                const code = codeByLevel.get(g.academic_level_id);
                return code === '844' || (code === 'CBC' && isSeniorSchoolGrade(g));
            })
            .map(g => g.id),
    );
    return streams.filter(s => eligible.has(s.grade_id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function suggestedChoice(row: SeniorLearnerRow): string {
    if (row.matchingCombinationId) return `existing:${row.matchingCombinationId}`;
    if (row.suggestion.kind === 'official') return `official:${row.suggestion.code}`;
    if (row.suggestion.kind === 'custom') return `custom:${row.suggestion.electiveCodes.join(',')}`;
    return row.currentCombinationId ? `existing:${row.currentCombinationId}` : '';
}

/** Confident suggestions start ticked unless the learner is already there. */
export function initialDraft(row: SeniorLearnerRow): SeniorDraft {
    const choice = suggestedChoice(row);
    const maths = row.currentMaths ?? (row.suggestion.kind === 'no-marks' ? null : row.suggestion.maths) ?? '';
    const alreadyThere = choice === `existing:${row.currentCombinationId}` && (maths === '' || maths === row.currentMaths);
    const confident = row.suggestion.kind === 'official' || row.suggestion.kind === 'custom';
    return { include: confident && !alreadyThere && choice !== '', choice, maths };
}

export function toTarget(choice: string, row: SeniorLearnerRow): PlacementTarget | null {
    const [type, value] = [choice.slice(0, choice.indexOf(':')), choice.slice(choice.indexOf(':') + 1)];
    if (type === 'existing') return { type: 'existing', combinationId: value };
    if (type === 'official') return { type: 'official', code: value };
    if (type === 'custom' && row.suggestion.kind === 'custom') {
        return { type: 'custom', electiveCodes: row.suggestion.electiveCodes, pathway: row.suggestion.pathway, name: row.suggestion.name };
    }
    return null;
}

/** What a learner's marks point to, as a chooser option — null when they point nowhere. */
export function suggestionOption(row: SeniorLearnerRow, combinations: readonly SchoolCombinationOption[]): ChoiceOption | null {
    const s = row.suggestion;
    if (s.kind !== 'official' && s.kind !== 'custom') return null;
    const existing = combinations.find(c => c.id === row.matchingCombinationId);
    if (existing) return { value: `existing:${existing.id}`, code: existing.code, name: existing.name, detail: 'Already set up at your school' };
    return s.kind === 'official'
        ? { value: `official:${s.code}`, code: s.code, name: s.name, detail: `Official · ${s.track} — added to your school when you place` }
        : { value: `custom:${s.electiveCodes.join(',')}`, code: customCombinationCode(s.electiveCodes), name: s.name, detail: 'Not on the Ministry list — added as a custom combination when you place' };
}

/** "CODE · name" for a choice, or null when nothing is chosen. */
export function choiceLabel(choice: string, row: SeniorLearnerRow | null, combinations: readonly SchoolCombinationOption[]): string | null {
    const value = choice.slice(choice.indexOf(':') + 1);
    if (choice.startsWith('existing:')) {
        const c = combinations.find(x => x.id === value);
        return c ? `${c.code} · ${c.name}` : null;
    }
    if (choice.startsWith('official:')) {
        const t = OFFICIAL_BY_CODE.get(value);
        return t ? `${t.code} · ${t.name}` : value;
    }
    if (choice.startsWith('custom:') && row?.suggestion.kind === 'custom') {
        return `${customCombinationCode(row.suggestion.electiveCodes)} · ${row.suggestion.name} (custom)`;
    }
    return null;
}

/** The school's own combinations as choices. */
export const schoolChoiceOptions = (combinations: readonly SchoolCombinationOption[]): ChoiceOption[] =>
    combinations.map(c => ({
        value: `existing:${c.id}`,
        code: c.code,
        name: c.name,
        detail: [PATHWAYS[c.pathway]?.label, c.track].filter(Boolean).join(' · '),
    }));

/** Official combinations the school hasn't set up, pathway by pathway, noting subjects it doesn't offer. */
export function ministryChoiceOptions(combinations: readonly SchoolCombinationOption[], offeredCodes: ReadonlySet<string>): MinistryChoice[] {
    const taken = new Set(combinations.map(c => c.code.trim().toUpperCase()));
    const rank = (p: CbcPathway) => PATHWAY_ORDER.indexOf(p);
    return MINISTRY_COMBINATION_TEMPLATES
        .filter(t => !taken.has(t.code))
        .sort((a, b) => rank(a.pathway) - rank(b.pathway) || a.code.localeCompare(b.code))
        .map(t => {
            const missing = t.subjectCodes.filter(c => !offeredCodes.has(c));
            return {
                value: `official:${t.code}`,
                code: t.code,
                name: t.name,
                pathway: t.pathway,
                detail: `${PATHWAYS[t.pathway].label} · ${t.track}${missing.length ? ` · not offered yet: ${missing.join(', ')}` : ''}`,
                runnable: missing.length === 0,
            };
        });
}

/** The senior placement request for the ticked learners with a choice. */
export function seniorPlacements(learners: readonly SeniorLearnerRow[], drafts: Readonly<Record<string, SeniorDraft>>) {
    return learners.flatMap(l => {
        const draft = drafts[l.studentId];
        if (!draft?.include || !draft.choice) return [];
        const target = toTarget(draft.choice, l);
        return target ? [{ student_id: l.studentId, target, maths: draft.maths || null }] : [];
    });
}

/** How many learners' marks point to each kind of suggestion. */
export const suggestionCounts = (learners: readonly SeniorLearnerRow[]) =>
    learners.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.suggestion.kind]: (acc[l.suggestion.kind] ?? 0) + 1 }), {});

export const placedMessage = (summary: string, result: { combinationsCreated?: number }) =>
    summary + (result.combinationsCreated ? ` ${result.combinationsCreated} new combination(s) were added to your school.` : '');

export const MATHS_DEFAULT_NOTE = '“Default” maths keeps what the learner takes now, else Core for STEM and Essential otherwise.';
