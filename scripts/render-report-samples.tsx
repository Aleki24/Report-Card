/**
 * Renders every report card template with sample data to PDFs for visual review.
 *   npx tsx scripts/render-report-samples.tsx <outDir>
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateStudentReportCardPDF } from '../src/lib/pdfGeneratorServer';
import { REPORT_TEMPLATES } from '../src/lib/pdf/templateMeta';
import type { ReportCardData } from '../src/lib/pdfGenerator';

type SubjectMark = ReportCardData['subjectMarks'][number];

const kcseGrade = (p: number): [string, number] => {
    const t: [number, string, number][] = [[80, 'A', 12], [75, 'A-', 11], [70, 'B+', 10], [65, 'B', 9], [60, 'B-', 8], [55, 'C+', 7], [50, 'C', 6], [45, 'C-', 5], [40, 'D+', 4], [35, 'D', 3], [30, 'D-', 2], [0, 'E', 1]];
    const hit = t.find(([min]) => p >= min)!;
    return [hit[1], hit[2]];
};

const kcseRaw: [string, string, number, number, number, string][] = [
    ['English', 'Languages', 72, 64, 68, 'Mr. J. Kamau'],
    ['Kiswahili', 'Languages', 81, 66, 77, 'Mrs. A. Wanjiru'],
    ['Mathematics', 'Sciences', 64, 52, 58, 'Mr. P. Otieno'],
    ['Biology', 'Sciences', 77, 61, 70, 'Ms. L. Njeri'],
    ['Chemistry', 'Sciences', 58, 49, 61, 'Mr. D. Mutua'],
    ['Physics', 'Sciences', 69, 55, 63, 'Mr. K. Ochieng'],
    ['History & Government', 'Humanities', 84, 63, 79, 'Mrs. R. Achieng'],
    ['Geography', 'Humanities', 66, 60, 70, 'Mr. S. Kiprono'],
    ['Business Studies', 'Technical', 88, 67, 82, 'Ms. M. Wairimu'],
];

const kcseMarks: SubjectMark[] = kcseRaw.map(([name, cat, pct, avg, prev, teacher], i) => {
    const [grade, points] = kcseGrade(pct);
    return {
        subjectName: name, category: cat, score: pct, totalPossible: 100, percentage: pct, grade, points,
        teacherComment: '', subjectRank: [5, 2, 11, 4, 14, 8, 1, 12, 1][i], totalStudents: 42, instructorName: teacher,
        includedInPoints: i !== 8, classAverage: avg, previousPercentage: prev,
        paperScores: name === 'Mathematics' ? [{ code: 'PP1', score: 66, maxScore: 100 }, { code: 'PP2', score: 62, maxScore: 100 }]
            : name === 'Biology' ? [{ code: 'PP1', score: 74, maxScore: 80 }, { code: 'PP2', score: 71, maxScore: 80 }, { code: 'PP3', score: 30, maxScore: 40 }]
            : undefined,
    };
});

const kcse: ReportCardData = {
    schoolName: 'Riverside Heights High School', schoolAddress: 'P.O. Box 1234-00100, Nairobi · info@riverside.ac.ke',
    examTitle: 'End of Term 2 Examination', academicYear: '2026', studentName: 'Amani Wanjiku Mwangi', enrollmentNumber: 'RHS/2023/0417',
    className: 'Form 3 East', gradingSystemType: 'KCSE', subjectMarks: kcseMarks, overallPercentage: 73.2, overallGrade: 'B+',
    totalPoints: 76, overallPointsGrade: 'B+', classRank: 4, totalStudents: 42, classMeanPercentage: 59.7,
    previousExamLabel: 'Term 1', previousOverallPercentage: 69.8, previousTotalPoints: 71, previousClassRank: 7,
    gradeBoundaries: [], resultUrl: 'https://skulbase.app/r/abc123', openingDate: '5 January 2027',
    totalScore: 659, totalPossible: 900,
};

const cbcRaw: [string, number, number, number][] = [
    ['English', 78, 64, 70], ['Kiswahili', 71, 62, 66], ['Mathematics', 55, 51, 48], ['Integrated Science', 82, 60, 76],
    ['Social Studies', 68, 58, 71], ['Pre-Technical Studies', 47, 52, 44], ['Agriculture', 74, 63, 69],
    ['Creative Arts & Sports', 88, 70, 85], ['Religious Education (CRE)', 63, 61, 60],
];
const cbc: ReportCardData = {
    ...kcse, gradingSystemType: 'CBC', className: 'Grade 8 Blue', examTitle: 'End of Term 2 Assessment', studentName: 'Baraka Otieno Odhiambo',
    enrollmentNumber: 'RHS/JS/0921', totalPoints: undefined, overallPointsGrade: undefined, overallGrade: 'ME',
    overallPercentage: 69.6, classRank: 6, totalStudents: 38, classMeanPercentage: 60.1, previousOverallPercentage: 64.3, previousClassRank: 9,
    subjectMarks: cbcRaw.map(([name, pct, avg, prev], i) => ({
        subjectName: name, category: 'Core', score: pct, totalPossible: 100, percentage: pct,
        grade: pct >= 75 ? 'EE' : pct >= 50 ? 'ME' : pct >= 25 ? 'AE' : 'BE', teacherComment: '',
        subjectRank: i + 3, totalStudents: 38, classAverage: avg, previousPercentage: prev,
    })),
};

/* Edge cases: a long subject list with long names, and a first exam with
   nothing to compare against and no class figures yet. */
const extraSubjects: [string, number][] = [
    ['Computer Studies', 71], ['Home Science', 63], ['French', 57], ['Art & Design', 80], ['Music', 66],
];
const kcseLong: ReportCardData = {
    ...kcse, studentName: 'Wanjiku Nyambura Chepkoech-Kariuki', className: 'Form 4 North',
    subjectMarks: [...kcseMarks, ...extraSubjects.map(([name, pct], i) => {
        const [grade, points] = kcseGrade(pct);
        return { subjectName: name, category: 'Technical', score: pct, totalPossible: 100, percentage: pct, grade, points,
            teacherComment: '', subjectRank: 3 + i, totalStudents: 42, instructorName: 'Mr. B. Omondi', includedInPoints: false,
            classAverage: 60, previousPercentage: pct - 2 };
    })],
};
const firstExam: ReportCardData = {
    ...kcse, previousExamLabel: undefined, previousOverallPercentage: undefined, previousTotalPoints: undefined,
    previousClassRank: undefined, classMeanPercentage: undefined, resultUrl: undefined,
    subjectMarks: kcseMarks.slice(0, 6).map(m => ({ ...m, previousPercentage: undefined, classAverage: undefined, paperScores: undefined, instructorName: undefined })),
};
const cbcScale = [['EE1', 'Exceeding Expectations', 90, 100, 8], ['EE2', 'Exceeding Expectations', 75, 89, 7], ['ME1', 'Meeting Expectations', 58, 74, 6],
    ['ME2', 'Meeting Expectations', 41, 57, 5], ['AE1', 'Approaching Expectations', 31, 40, 4], ['AE2', 'Approaching Expectations', 21, 30, 3],
    ['BE1', 'Below Expectations', 11, 20, 2], ['BE2', 'Below Expectations', 0, 10, 1]] as const;
const cbc8: ReportCardData = {
    ...cbc,
    gradeBoundaries: cbcScale.map(([symbol, label, min, max, points]) => ({ symbol, label, min, max, points })),
    subjectMarks: cbc.subjectMarks.map(m => ({ ...m, grade: cbcScale.find(([, , min, max]) => m.percentage >= min && m.percentage <= max)![0] })),
};

const CASES: [string, ReportCardData][] = [['kcse', kcse], ['cbc', cbc], ['cbc8', cbc8], ['kcse-long', kcseLong], ['first-exam', firstExam]];

async function main() {
    const out = process.argv[2] ?? 'render-out';
    mkdirSync(out, { recursive: true });
    const only = process.argv[3]?.split(',');
    for (const t of REPORT_TEMPLATES) {
        if (only && !only.includes(t.id)) continue;
        for (const [label, data] of CASES) {
            writeFileSync(join(out, `${t.id}-${label}.pdf`), await generateStudentReportCardPDF(data, t.id));
            console.log('rendered', t.id, label);
        }
    }
}
main().catch(e => { console.error(e); process.exit(1); });
