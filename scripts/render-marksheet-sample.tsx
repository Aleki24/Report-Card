/**
 * Renders the class mark sheet with a realistic sample class for visual review.
 *   npx tsx scripts/render-marksheet-sample.tsx <outDir>
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateMarkSheetPDF, type MarkSheetData, type SubjectStats } from '../src/lib/marksheetPdfGenerator';

const SUBJECTS: [string, string][] = [
    ['101', 'English'], ['102', 'Kiswahili'], ['121', 'Mathematics'], ['231', 'Biology'], ['232', 'Physics'],
    ['233', 'Chemistry'], ['311', 'History & Government'], ['312', 'Geography'], ['313', 'CRE'],
    ['443', 'Agriculture'], ['565', 'Business Studies'],
];
const FIRST = ['Amani', 'Baraka', 'Chebet', 'Daudi', 'Esther', 'Faith', 'Gideon', 'Halima', 'Imani', 'Jabari', 'Kendi', 'Lilian', 'Moses', 'Njeri', 'Otieno', 'Purity', 'Quincy', 'Rehema', 'Sifa', 'Tumaini', 'Wanjiru'];
const LAST = ['Mwangi', 'Odhiambo', 'Kiprono', 'Wambui', 'Achieng', 'Kamau', 'Mutua', 'Njoroge', 'Chepkoech', 'Ouma', 'Nyambura', 'Kariuki'];

// Deterministic pseudo-random so every render is identical.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const kcse = (p: number): [string, number] => {
    const t: [number, string, number][] = [[80, 'A', 12], [75, 'A-', 11], [70, 'B+', 10], [65, 'B', 9], [60, 'B-', 8], [55, 'C+', 7], [50, 'C', 6], [45, 'C-', 5], [40, 'D+', 4], [35, 'D', 3], [30, 'D-', 2], [0, 'E', 1]];
    const hit = t.find(([min]) => p >= min)!;
    return [hit[1], hit[2]];
};

function buildClass(size: number, curriculum: 'KCSE' | 'CBC'): MarkSheetData {
const students = Array.from({ length: size }, (_, i) => {
    const ability = 35 + rand() * 50;
    const marks: Record<string, number | null> = {};
    for (const [code] of SUBJECTS) marks[code] = i === 17 && code === '443' ? null : Math.round(Math.min(98, Math.max(12, ability + (rand() - 0.5) * 30)));
    const vals = Object.values(marks).filter((v): v is number => v != null);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const points = vals.slice(0, 7).reduce((a, v) => a + kcse(v)[1], 0);
    return {
        studentName: `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]} ${i % 3 === 0 ? LAST[(i + 3) % LAST.length] : ''}`.trim(),
        admissionNumber: `RHS/2023/${String(400 + i * 7).padStart(4, '0')}`,
        marks, overallPercentage: Math.round(mean * 10) / 10, overallGrade: kcse(mean)[0], totalPoints: points,
        classRank: 0, previousPercentage: Math.round(mean + (rand() - 0.55) * 10),
    };
});
students.sort((a, b) => b.overallPercentage - a.overallPercentage).forEach((s, i) => (s.classRank = i + 1));

const subjectStats: Record<string, SubjectStats> = {};
const TEACHERS = ['John Kamau', 'Alice Wanjiru', 'Peter Otieno', 'Lucy Njeri', 'Kevin Ochieng', 'David Mutua', 'Rose Achieng', 'Samuel Kiprono', 'Mary Wairimu', 'James Kirui', 'Grace Mumbua'];
SUBJECTS.forEach(([code], i) => {
    const v = students.map(s => s.marks[code]).filter((x): x is number => x != null);
    const mean = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
    subjectStats[code] = { mean, highest: Math.max(...v), lowest: Math.min(...v), studentCount: v.length, previousMean: mean + Math.round((rand() - 0.5) * 8), teacher: TEACHERS[i] };
});
const gradeDistribution: Record<string, number> = {};
for (const s of students) gradeDistribution[s.overallGrade] = (gradeDistribution[s.overallGrade] ?? 0) + 1;
const classMean = students.reduce((a, s) => a + s.overallPercentage, 0) / students.length;

const cbcLevel = (p: number) => (p >= 75 ? 'EE' : p >= 50 ? 'ME' : p >= 25 ? 'AE' : 'BE');
if (curriculum === 'CBC') {
    for (const s of students) s.overallGrade = cbcLevel(s.overallPercentage);
    for (const k of Object.keys(gradeDistribution)) delete gradeDistribution[k];
    for (const s of students) gradeDistribution[s.overallGrade] = (gradeDistribution[s.overallGrade] ?? 0) + 1;
}
return {
    schoolName: 'Riverside Heights High School', schoolAddress: 'P.O. Box 1234-00100, Nairobi · info@riverside.ac.ke',
    examTitle: 'End of Term 2 Examination', academicYear: '2026', className: curriculum === 'KCSE' ? 'Form 3 East' : 'Grade 9 Blue', gradingSystemType: curriculum,
    subjects: SUBJECTS.map(([code, name]) => ({ code, name })), students, gradeDistribution,
    meanGrade: curriculum === 'KCSE' ? kcse(classMean)[0] : cbcLevel(classMean), meanPoints: Math.round(students.reduce((a, s) => a + s.totalPoints, 0) / students.length * 10) / 10,
    classMeanPercentage: classMean, previousClassMeanPercentage: classMean - 2.4, previousExamLabel: 'Term 1',
    subjectStats,
    subjectRankings: SUBJECTS.map(([code]) => ({ code, mean: subjectStats[code].mean, rank: 0 }))
        .sort((a, b) => b.mean - a.mean).map((r, i) => ({ ...r, rank: i + 1 })),
    rankedBy: curriculum === 'KCSE' ? 'points' : 'totalMarks',
    gradeBands: curriculum === 'KCSE'
        ? [[80, 100, 'A'], [75, 79, 'A-'], [70, 74, 'B+'], [65, 69, 'B'], [60, 64, 'B-'], [55, 59, 'C+'], [50, 54, 'C'], [45, 49, 'C-'], [40, 44, 'D+'], [35, 39, 'D'], [30, 34, 'D-'], [0, 29, 'E']]
            .map(([min_percentage, max_percentage, symbol]) => ({ symbol: String(symbol), min_percentage: Number(min_percentage), max_percentage: Number(max_percentage) }))
        : [[75, 100, 'EE'], [50, 74, 'ME'], [25, 49, 'AE'], [0, 24, 'BE']]
            .map(([min_percentage, max_percentage, symbol]) => ({ symbol: String(symbol), min_percentage: Number(min_percentage), max_percentage: Number(max_percentage) })),
};
}

/**
 * A CBC Grade 9 class shaped like a real one that exposed weak analysis:
 * EE1–BE2 sub-levels, learners who missed a learning area, most learners
 * dropping since the last round, and two areas with 30-mark swings. Changes
 * are measured like for like, as the route does.
 */
function buildGrade9(): MarkSheetData {
    const AREAS: [string, string][] = [
        ['AGRI_JS', 'Agriculture'], ['CAS_JS', 'Creative Arts and Sports'], ['ENG_JS', 'English'], ['KISW_JS', 'Kiswahili'],
        ['MATH_JS', 'Mathematics'], ['PTS_JS', 'Pre-Technical Studies'], ['RE_JS', 'Religious Education'],
        ['SCI_JS', 'Integrated Science'], ['SS_JS', 'Social Studies'],
    ];
    const bands: [number, number, string][] = [[90, 100, 'EE1'], [75, 89, 'EE2'], [58, 74, 'ME1'], [41, 57, 'ME2'], [31, 40, 'AE1'], [21, 30, 'AE2'], [11, 20, 'BE1'], [0, 10, 'BE2']];
    const level = (p: number) => bands.find(([min, max]) => p >= min && p <= max + 0.999)![2];
    // Per-area difficulty now, and how much easier the last round was.
    const areaShift: Record<string, [number, number]> = {
        AGRI_JS: [14, 4], CAS_JS: [0, 9], ENG_JS: [4, 2], KISW_JS: [-4, 0], MATH_JS: [-22, 3],
        PTS_JS: [6, -5], RE_JS: [-11, 32], SCI_JS: [-12, 5], SS_JS: [-29, 36],
    };
    const learners = Array.from({ length: 26 }, (_, i) => {
        const ability = 40 + rand() * 45;
        const marks: Record<string, number | null> = {};
        const before: Record<string, number> = {};
        for (const [code] of AREAS) {
            const [now, easier] = areaShift[code];
            const missing = (i === 2 && code === 'MATH_JS') || (i === 15 && (code === 'KISW_JS' || code === 'PTS_JS'));
            const mark = Math.round(Math.min(95, Math.max(4, ability + now + (rand() - 0.5) * 24)));
            marks[code] = missing ? null : mark;
            before[code] = Math.round(Math.min(98, Math.max(5, mark + easier + (rand() - 0.3) * 10)));
        }
        const sat = Object.values(marks).filter((v): v is number => v != null);
        const pairs = AREAS.filter(([c]) => marks[c] != null).map(([c]) => ({ now: marks[c] as number, before: before[c] }));
        const beforeAll = Object.values(before);
        return {
            studentName: `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`,
            admissionNumber: `ADM-2026-${String(10000 + i * 3733).slice(0, 5)}`,
            marks, overallPercentage: sat.reduce((a, b) => a + b, 0) / sat.length,
            overallGrade: '', totalPoints: 0, classRank: 0,
            totalMarks: sat.reduce((a, b) => a + b, 0), subjectsSat: sat.length,
            previousPercentage: beforeAll.reduce((a, b) => a + b, 0) / beforeAll.length,
            previousTotal: beforeAll.reduce((a, b) => a + b, 0),
            previousClassRank: 0 as number | undefined,
            change: Math.round(pairs.reduce((a, p) => a + (p.now - p.before), 0) / pairs.length),
            before,
        };
    });
    // CBC ranks on total marks — now and last round.
    [...learners].sort((a, b) => b.totalMarks - a.totalMarks).forEach((l, i, all) => { l.classRank = i > 0 && all[i - 1].totalMarks === l.totalMarks ? all[i - 1].classRank : i + 1; });
    [...learners].sort((a, b) => b.previousTotal - a.previousTotal).forEach((l, i) => { l.previousClassRank = i + 1; });
    for (const l of learners) l.overallGrade = level(l.overallPercentage);
    learners.sort((a, b) => a.classRank - b.classRank);

    const subjectStats: Record<string, SubjectStats> = {};
    AREAS.forEach(([code]) => {
        const sat = learners.filter(l => l.marks[code] != null);
        const v = sat.map(l => l.marks[code] as number);
        const mean = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
        const previousMean = Math.round(learners.reduce((a, l) => a + l.before[code], 0) / learners.length);
        const change = Math.round(sat.reduce((a, l) => a + ((l.marks[code] as number) - l.before[code]), 0) / sat.length);
        subjectStats[code] = { mean, highest: Math.max(...v), lowest: Math.min(...v), studentCount: v.length, previousMean, change, comparedCount: sat.length, teacher: 'B. Cheruiyot' };
    });
    const gradeDistribution: Record<string, number> = {};
    for (const l of learners) gradeDistribution[l.overallGrade] = (gradeDistribution[l.overallGrade] ?? 0) + 1;
    const classMean = learners.reduce((a, l) => a + l.overallPercentage, 0) / learners.length;
    const allPairs = learners.flatMap(l => AREAS.filter(([c]) => l.marks[c] != null).map(([c]) => (l.marks[c] as number) - l.before[c]));
    return {
        schoolName: 'Sathya Sai School - Kisaju', schoolAddress: 'P. O. Box 333 Kajiado Kenya',
        examTitle: 'Term 3', examRound: 'Midterm', academicYear: '2026', className: 'Grade 9', gradingSystemType: 'CBC',
        subjects: AREAS.map(([code, name]) => ({ code, name })),
        students: learners.map(({ before: _before, previousTotal: _previousTotal, ...l }) => l),
        gradeDistribution, meanGrade: level(classMean), meanPoints: 0,
        classMeanPercentage: classMean,
        previousClassMeanPercentage: learners.reduce((a, l) => a + l.previousPercentage, 0) / learners.length,
        classMeanChange: Math.round(allPairs.reduce((a, b) => a + b, 0) / allPairs.length),
        previousExamLabel: 'Term 2 Midterm',
        subjectStats,
        subjectRankings: AREAS.map(([code]) => ({ code, mean: subjectStats[code].mean, rank: 0 }))
            .sort((a, b) => b.mean - a.mean).map((r, i) => ({ ...r, rank: i + 1 })),
        rankedBy: 'totalMarks',
        gradeBands: bands.map(([min_percentage, max_percentage, symbol]) => ({ symbol, min_percentage, max_percentage })),
    };
}

async function main() {
    const out = process.argv[2] ?? 'render-out';
    mkdirSync(out, { recursive: true });
    // A full class, one learner over a page, a small class and a CBC class.
    for (const [size, curriculum] of [[42, 'KCSE'], [27, 'KCSE'], [8, 'KCSE'], [35, 'CBC']] as const) {
        writeFileSync(join(out, `marksheet-${curriculum.toLowerCase()}-${size}.pdf`), await generateMarkSheetPDF(buildClass(size, curriculum)));
        console.log('rendered marksheet', curriculum, size);
    }
    writeFileSync(join(out, 'marksheet-cbc-grade9.pdf'), await generateMarkSheetPDF(buildGrade9()));
    console.log('rendered marksheet CBC grade 9');
}
main().catch(e => { console.error(e); process.exit(1); });
