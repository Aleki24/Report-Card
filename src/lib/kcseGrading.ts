export const GRADE_POINTS: Record<string, number> = {
    'A': 12, 'A-': 11,
    'B+': 10, 'B': 9, 'B-': 8,
    'C+': 7, 'C': 6, 'C-': 5,
    'D+': 4, 'D': 3, 'D-': 2,
    'E': 1,
};

export const MEAN_GRADE_SCALE: [number, string][] = [
    [11.5, 'A'], [10.5, 'A-'], [9.5, 'B+'], [8.5, 'B'], [7.5, 'B-'], [6.5, 'C+'],
    [5.5, 'C'], [4.5, 'C-'], [3.5, 'D+'], [2.5, 'D'], [1.5, 'D-'], [0, 'E'],
];

export const COMPULSORY_SUBJECTS = ['mathematics', 'english', 'kiswahili'];
export const SCIENCE_SUBJECTS = ['biology', 'chemistry', 'physics'];
export const HUMANITY_SUBJECTS = [
    'geography', 'history',
    'cre', 'christian religious education',
    'ire', 'islamic religious education',
    'hre', 'hindu religious education',
];

export type SubjectCategory = 'compulsory' | 'science' | 'humanity' | 'technical';

export function getSubjectCategory(subjectName: string): SubjectCategory {
    const n = subjectName.trim().toLowerCase();
    if (COMPULSORY_SUBJECTS.includes(n)) return 'compulsory';
    if (SCIENCE_SUBJECTS.includes(n)) return 'science';
    if (HUMANITY_SUBJECTS.includes(n)) return 'humanity';
    return 'technical';
}

export function gradeToPoints(grade: string): number {
    return GRADE_POINTS[grade?.trim()] ?? 0;
}

export function pointsToOverallGrade(totalPoints: number): string {
    const mean = totalPoints / 7;
    const entry = MEAN_GRADE_SCALE.find(([min]) => mean >= min);
    return entry ? entry[1] : 'E';
}

export function sortByPointsDesc<T extends { points: number }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => b.points - a.points);
}

export interface KCESubject {
    name: string;
    grade: string;
    points: number;
    category: SubjectCategory;
}

export interface KCEResult {
    selected: KCESubject[];
    dropped: KCESubject[];
    totalPoints: number;
    meanPoints: number;
    overallGrade: string;
    breakdown: {
        compulsory: KCESubject[];
        sciences: { all: KCESubject[]; selected: KCESubject[]; dropped: KCESubject[] };
        humanities: { all: KCESubject[]; selected: KCESubject[]; dropped: KCESubject[] };
        technical: { all: KCESubject[]; selected: KCESubject[]; dropped: KCESubject[] };
    };
}

export function calculateKCSEResult(subjects: { name: string; grade: string }[]): KCEResult {
    const enriched: KCESubject[] = subjects.map(s => ({
        ...s,
        points: gradeToPoints(s.grade),
        category: getSubjectCategory(s.name),
    }));

    const compulsory = enriched.filter(s => s.category === 'compulsory');
    const sciences = enriched.filter(s => s.category === 'science');
    const humanities = enriched.filter(s => s.category === 'humanity');
    const technical = enriched.filter(s => s.category === 'technical');

    const sciencesSorted = sortByPointsDesc(sciences);
    const selSciences = sciences.length >= 3
        ? sciencesSorted.slice(0, 2)
        : sciencesSorted;

    const humanitiesSorted = sortByPointsDesc(humanities);
    const selHumanities = humanities.length >= 2
        ? humanitiesSorted.slice(0, 1)
        : humanitiesSorted;

    const technicalSorted = sortByPointsDesc(technical);
    const selTechnical = technicalSorted.slice(0, 1);

    const selected = [...compulsory, ...selSciences, ...selHumanities, ...selTechnical];
    const selectedNames = new Set(selected.map(s => s.name));
    const dropped = enriched.filter(s => !selectedNames.has(s.name));

    const totalPoints = selected.reduce((sum, s) => sum + s.points, 0);
    const meanPoints = totalPoints / 7;
    const overallGrade = pointsToOverallGrade(totalPoints);

    return {
        selected,
        dropped,
        totalPoints,
        meanPoints,
        overallGrade,
        breakdown: {
            compulsory,
            sciences: {
                all: sciences,
                selected: selSciences,
                dropped: sciencesSorted.slice(selSciences.length),
            },
            humanities: {
                all: humanities,
                selected: selHumanities,
                dropped: humanitiesSorted.slice(selHumanities.length),
            },
            technical: {
                all: technical,
                selected: selTechnical,
                dropped: technicalSorted.slice(1),
            },
        },
    };
}
