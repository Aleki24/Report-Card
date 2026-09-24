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
    gradeBands: curriculum === 'KCSE'
        ? [[80, 100, 'A'], [75, 79, 'A-'], [70, 74, 'B+'], [65, 69, 'B'], [60, 64, 'B-'], [55, 59, 'C+'], [50, 54, 'C'], [45, 49, 'C-'], [40, 44, 'D+'], [35, 39, 'D'], [30, 34, 'D-'], [0, 29, 'E']]
            .map(([min_percentage, max_percentage, symbol]) => ({ symbol: String(symbol), min_percentage: Number(min_percentage), max_percentage: Number(max_percentage) }))
        : [[75, 100, 'EE'], [50, 74, 'ME'], [25, 49, 'AE'], [0, 24, 'BE']]
            .map(([min_percentage, max_percentage, symbol]) => ({ symbol: String(symbol), min_percentage: Number(min_percentage), max_percentage: Number(max_percentage) })),
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
}
main().catch(e => { console.error(e); process.exit(1); });
