/**
 * The school's subject combinations as the settings screens manage them:
 * which subjects may be electives, the create/edit payloads and adding
 * official Ministry combinations. Shared by the web and the mobile app.
 */
import { isSubjectOfferedInBand } from '../curriculum-bands';
import type { CbcPathway, MinistryCombinationTemplate } from '../pathway-definitions';

export interface CombinationSubject { id: string; name: string; code: string; academic_level_id?: string }
export interface CombinationRow {
    id: string;
    code: string;
    name: string;
    pathway: CbcPathway;
    track?: string | null;
    is_active: boolean;
    subjects?: { id: string; name: string; code: string }[];
    student_count?: number;
}

export interface CombinationForm { code: string; name: string; pathway: CbcPathway; track: string; subject_ids: [string, string, string] }
export const emptyCombinationForm = (): CombinationForm => ({ code: '', name: '', pathway: 'STEM', track: '', subject_ids: ['', '', ''] });

export const combinationFormFrom = (c: CombinationRow): CombinationForm => {
    const ids = (c.subjects ?? []).map(s => s.id);
    return { code: c.code, name: c.name, pathway: c.pathway, track: c.track || '', subject_ids: [ids[0] || '', ids[1] || '', ids[2] || ''] };
};

/**
 * Electives can come from any pathway (2+1 blends are legal), but a
 * combination is a Senior School construct, so only Senior School subjects
 * belong in it — the CBC level alone also covers Grades 1 to 9.
 */
export const electiveOptions = <S extends CombinationSubject>(subjects: readonly S[], cbcLevelId?: string): S[] =>
    subjects.filter(s => (!cbcLevelId || s.academic_level_id === cbcLevelId) && isSubjectOfferedInBand(s, 'CBC_SENIOR_SCHOOL'));

export const offeredIdByCode = (electives: readonly CombinationSubject[]) => new Map(electives.map(s => [s.code.trim().toUpperCase(), s.id]));

/** Three different electives, a code and a name. */
export const canSaveCombination = (f: CombinationForm) =>
    !!(f.code.trim() && f.name.trim() && f.subject_ids.every(Boolean) && new Set(f.subject_ids).size === 3);

export const combinationPayload = (f: CombinationForm) => ({
    code: f.code.trim().toUpperCase(),
    name: f.name.trim(),
    pathway: f.pathway,
    track: f.track.trim() || null,
    subject_ids: f.subject_ids,
});

/** An official combination as a create payload, or null when the school doesn't offer one of its subjects. */
export function officialCombinationPayload(t: MinistryCombinationTemplate, offered: ReadonlyMap<string, string>) {
    const subjectIds = t.subjectCodes.map(c => offered.get(c));
    if (subjectIds.some(id => !id)) return null;
    return { type: 'subject_combination', code: t.code, name: t.name, pathway: t.pathway, track: t.track, subject_ids: subjectIds as string[] };
}

export const combinationsHelp = (minGroupSize: number) =>
    `A combination is a Ministry code for a track plus exactly 3 electives (e.g. AS2009 = Biology + Geography + Sports & Recreation). Learners take these 3 electives alongside English, Kiswahili, Community Service Learning and Mathematics — Essential Mathematics unless the combination includes Core Mathematics. Groups need ${minGroupSize}+ learners to run as their own class.`;
