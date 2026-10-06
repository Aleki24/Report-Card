/**
 * Weekly lesson allocations set by the Ministry of Education / KICD, so a
 * school's teaching loads start where the curriculum expects them.
 *
 * CBC (PP1–Grade 9): KICD timetabling guidelines for the rationalised
 * curriculum (2024). PP 25 lessons of 30 min; Grades 1–3 31 of 30 min;
 * Grades 4–6 35 of 35 min; Grades 7–9 41 of 40 min, with one double lesson
 * only for Integrated Science, Pre-Technical Studies, Agriculture and
 * Creative Arts & Sports. No double lessons below Grade 7.
 * Senior School (Grade 10+): 40 lessons of 40 min; English, Kiswahili and
 * Mathematics 5 each, CSL 3, PE 3, ICT 2, each elective 5.
 * 8-4-4 secondary: Ministry circular on time allocation (Forms 1–2 and 3–4).
 *
 * Subjects are matched by name (and code), since schools rename them; a
 * subject that matches nothing keeps the school's own default.
 */
import { bandForGrade, type CurriculumBand } from '../curriculum-bands';

export interface Allocation {
    lessons: number;
    doubles: number;
}

type Rule = readonly [pattern: RegExp, lessons: number, doubles?: number];

const PRE_PRIMARY: readonly Rule[] = [
    [/creative|psychomotor|movement/, 6],
    [/environment/, 5],
    [/math/, 5],
    [/language|english|kiswahili|literacy|reading/, 5],
    [/religio|\b[chi]re\b/, 3],
    [/\bppi\b|pastoral/, 1],
];

const LOWER_PRIMARY: readonly Rule[] = [
    [/indigenous|mother tongue/, 2],
    [/kiswahili|sign language|\bksl\b/, 4],
    [/english/, 5],
    [/math/, 5],
    [/religio|\b[chi]re\b/, 3],
    [/environment/, 4],
    [/creative|movement/, 7],
    [/\bppi\b|pastoral/, 1],
];

const UPPER_PRIMARY: readonly Rule[] = [
    [/english/, 5],
    [/kiswahili|sign language|\bksl\b/, 4],
    [/math/, 5],
    [/religio|\b[chi]re\b/, 3],
    [/science/, 4],
    [/agricultur/, 4],
    [/social studies/, 3],
    [/creative|movement|arts?\b/, 6],
    [/\bppi\b|pastoral/, 1],
];

const JUNIOR_SCHOOL: readonly Rule[] = [
    [/english/, 5],
    [/kiswahili|sign language|\bksl\b/, 4],
    [/math/, 5],
    [/religio|\b[chi]re\b/, 4],
    [/social studies/, 4],
    [/science/, 5, 1],
    [/pre[\s-]?tech/, 4, 1],
    [/agricultur/, 4, 1],
    [/creative|sports/, 5, 1],
    [/\bppi\b|pastoral/, 1],
];

const SENIOR_SCHOOL: readonly Rule[] = [
    [/^english$|english language/, 5],
    [/^kiswahili$|kiswahili language|^ksl$/, 5],
    [/community service/, 3],
    [/physical education|^pe$/, 3],
    [/\bict\b/, 2],
    [/\bppi\b|pastoral/, 1],
    [/guidance|personal study|\blpg\b/, 1],
    // Every elective, Core or Essential Mathematics included.
    [/./, 5],
];

const SECONDARY_844_LOWER: readonly Rule[] = [
    [/math/, 6], [/english/, 6], [/kiswahili/, 5],
    [/chemistry/, 4], [/biology/, 4], [/physics/, 4],
    [/geography/, 3], [/history/, 3], [/religio|\b[chi]re\b/, 3],
    [/business/, 3], [/physical education|life skills|^pe$/, 1],
    [/agricultur/, 3], [/home science/, 3], [/arabic|french|german/, 3],
];

const SECONDARY_844_UPPER: readonly Rule[] = [
    [/math/, 7], [/english/, 8], [/kiswahili/, 6],
    [/chemistry/, 5], [/biology/, 5], [/physics/, 5],
    [/geography/, 5], [/history/, 4], [/religio|\b[chi]re\b/, 4],
    [/business/, 4], [/physical education|life skills|^pe$/, 2],
    [/agricultur/, 4], [/home science/, 4], [/arabic|french|german/, 4],
];

const RULES: Partial<Record<CurriculumBand, readonly Rule[]>> = {
    CBC_PRE_PRIMARY: PRE_PRIMARY,
    CBC_LOWER_PRIMARY: LOWER_PRIMARY,
    CBC_UPPER_PRIMARY: UPPER_PRIMARY,
    CBC_JUNIOR_SCHOOL: JUNIOR_SCHOOL,
    CBC_SENIOR_SCHOOL: SENIOR_SCHOOL,
};

/** Forms 3–4 carry the heavier 8-4-4 load. */
const isUpperForm = (grade: { code: string | null; name_display: string | null }) =>
    /^F[34]$/i.test((grade.code ?? '').trim()) || /^form\s*[34]\b/i.test((grade.name_display ?? '').trim());

/** The Ministry's weekly lessons for a subject in a class's grade, or null if it sets none. */
export function ministryAllocation(
    grade: { code: string | null; name_display: string | null } | null,
    subject: { name: string | null; code?: string | null },
): Allocation | null {
    const band = bandForGrade(grade);
    if (!band || !grade) return null;
    const rules = band === '844_SECONDARY' ? (isUpperForm(grade) ? SECONDARY_844_UPPER : SECONDARY_844_LOWER) : RULES[band];
    if (!rules) return null;
    const name = (subject.name ?? '').trim().toLowerCase();
    const code = (subject.code ?? '').trim().toLowerCase();
    const hit = rules.find(([pattern]) => pattern.test(name) || (code !== '' && pattern.test(code)));
    return hit ? { lessons: hit[1], doubles: hit[2] ?? 0 } : null;
}
