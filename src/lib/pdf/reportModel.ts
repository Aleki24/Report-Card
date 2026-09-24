/**
 * Everything a report card template prints that has to be worked out from
 * ReportCardData, worked out once. The four templates differ in how they look,
 * not in what they say, so the arithmetic lives here and each layout only
 * decides where to put it.
 */
import type { ReportCardData } from '../pdfGenerator';
import { generateShortFeedback, generateClassTeacherComment, generatePrincipalComment } from './pdfHelpers';

type SubjectMark = ReportCardData['subjectMarks'][number];

export type LevelFamily = 'EE' | 'ME' | 'AE' | 'BE';

export interface SubjectRow {
    name: string;
    teacher?: string;
    category: string;
    /** Mark out of 100, or null when nothing was recorded. */
    mark: number | null;
    /** Letter grade (8-4-4) or competency level (CBC). */
    grade: string;
    points?: number;
    /** False when the 8-4-4 best-seven rule left this subject out of the total. */
    countsForPoints: boolean;
    classAverage?: number;
    previous?: number;
    /** Movement since the previous round, rounded; null without one. */
    change: number | null;
    /** "5/42", or undefined when the subject was not ranked. */
    rank?: string;
    /** One entry per paper column; null where this subject has no such paper. */
    papers: (number | null)[];
    remark: string;
}

export interface ScaleRow {
    symbol: string;
    label?: string;
    range: string;
    points?: number;
}

export interface CategoryRow {
    name: string;
    mean: number;
    previous?: number;
}

export interface ReportModel {
    isKCSE: boolean;
    /** "Subject" for 8-4-4, "Learning area" for CBC. */
    subjectNoun: string;
    subjectNounPlural: string;
    /** Label for the grade column: "Grade" or "Level". */
    gradeNoun: string;

    school: { name: string; address?: string; logo?: string; initial: string };
    learner: { name: string; initials: string; admission: string; className: string; pathway?: string };
    exam: { title: string; year: string; openingDate?: string; issued: string };

    subjects: SubjectRow[];
    paperCodes: string[];
    hasPrevious: boolean;
    hasClassAverage: boolean;
    /** Many subjects: templates tighten spacing so the card stays on one page. */
    compact: boolean;
    /** Few subjects: how much to open up row padding so the table carries the page. */
    rowScale: number;

    mean: number;
    /**
     * Movement in the mean since the previous round, like for like: only the
     * subjects sat both times, so a missed paper cannot fake a fall.
     */
    meanChange: number | null;
    /** Every subject's mark added up, and what that total is out of. */
    totalMarks: number;
    totalMarksOutOf: number;
    /** What positions were ordered on, in words: "total marks" or "total points". */
    rankedByLabel: string;
    /** True when positions follow total marks (CBC). */
    ranksByTotal: boolean;
    /** Overall grade (8-4-4) or overall competency level (CBC). */
    grade: string;
    /** What the grade means, e.g. "Meeting Expectations" or "KCSE 12-point scale". */
    gradeCaption: string;
    points?: number;
    pointsChange: number | null;
    /**
     * Whether positions print at all. 8-4-4 always ranks; CBC only when the
     * school opts in. When false, class, overall and subject ranks all hide.
     */
    showPositions: boolean;
    /** Position within the learner's stream. */
    position?: { rank: number; of: number };
    /** Places gained since the previous round (a smaller rank is better). */
    positionChange: number | null;
    /** Position across every stream (or the CBC pathway/combination), when it differs. */
    overallPosition?: { rank: number; of: number; label: string };
    classMean?: number;
    vsClassMean: number | null;
    previousLabel: string;

    scale: ScaleRow[];
    categories: CategoryRow[];
    /** Subjects with a mark, best first. */
    ranked: SubjectRow[];
    /** Subjects with a previous mark, biggest gain first. */
    movers: SubjectRow[];
    aboveClassCount: number;
    improvedCount: number;

    teacherComment: string;
    principalComment: string;
    qrCode?: string;
}

/* ── Formatting ─────────────────────────────────────────────── */

/** Signed figures read as movement. Kept to ASCII: a missing glyph prints blank. */
export const signed = (value: number, unit = ''): string =>
    `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value)}${unit}`;

export const initialsOf = (name: string, count = 2): string =>
    name.trim().split(/\s+/).slice(0, count).map(word => word.charAt(0).toUpperCase()).join('') || '?';

/** "Rachael Ng'ang'a" → "R. Ng'ang'a" */
export function shortName(name?: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts[parts.length - 1]}` : parts[0];
}

/** The first `count` words of a name, for places a full name will not fit. */
export const firstWords = (name: string, count = 2): string => name.trim().split(/\s+/).slice(0, count).join(' ');

/* ── Scales ─────────────────────────────────────────────────── */

const KCSE_DEFAULT_SCALE: ScaleRow[] = [
    ['A', '80-100', 12], ['A-', '75-79', 11], ['B+', '70-74', 10], ['B', '65-69', 9], ['B-', '60-64', 8], ['C+', '55-59', 7],
    ['C', '50-54', 6], ['C-', '45-49', 5], ['D+', '40-44', 4], ['D', '35-39', 3], ['D-', '30-34', 2], ['E', '0-29', 1],
].map(([symbol, range, points]) => ({ symbol: String(symbol), range: String(range), points: Number(points) }));

const CBC_LEVEL_NAMES: Record<LevelFamily, string> = {
    EE: 'Exceeding Expectations',
    ME: 'Meeting Expectations',
    AE: 'Approaching Expectations',
    BE: 'Below Expectations',
};

const CBC_DEFAULT_SCALE: ScaleRow[] = [
    { symbol: 'EE', label: CBC_LEVEL_NAMES.EE, range: '75-100' },
    { symbol: 'ME', label: CBC_LEVEL_NAMES.ME, range: '50-74' },
    { symbol: 'AE', label: CBC_LEVEL_NAMES.AE, range: '25-49' },
    { symbol: 'BE', label: CBC_LEVEL_NAMES.BE, range: '0-24' },
];

/** EE1 → EE. Anything unrecognised falls to the band its mark sits in. */
export function levelFamily(level: string, pct?: number | null): LevelFamily {
    const prefix = level.trim().toUpperCase().slice(0, 2);
    if (prefix === 'EE' || prefix === 'ME' || prefix === 'AE' || prefix === 'BE') return prefix;
    const p = pct ?? 0;
    return p >= 75 ? 'EE' : p >= 50 ? 'ME' : p >= 25 ? 'AE' : 'BE';
}

const trimNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function schoolScale(data: ReportCardData, isKCSE: boolean): ScaleRow[] {
    const rows = [...(data.gradeBoundaries ?? [])]
        .filter(b => b.symbol && Number.isFinite(b.min) && Number.isFinite(b.max))
        .sort((a, b) => b.min - a.min)
        .map(b => ({
            symbol: b.symbol,
            label: b.label || undefined,
            range: `${trimNumber(b.min)}-${trimNumber(Math.floor(b.max))}`,
            points: b.points ?? undefined,
        }));
    if (rows.length > 0) return rows;
    return isKCSE ? KCSE_DEFAULT_SCALE : CBC_DEFAULT_SCALE;
}

/** The school's own band the mark falls in, if the scale covers it. */
function bandFor(data: ReportCardData, pct: number) {
    return (data.gradeBoundaries ?? []).find(b => pct >= b.min && pct <= b.max + 0.999);
}

/* ── Model ──────────────────────────────────────────────────── */

const MAX_PAPERS = 3;
/** Beyond this many subjects the layouts tighten their rows. */
const COMPACT_FROM = 10;
/** Below this many subjects the layouts open their rows up. */
const ROOMY_BELOW = 9;

function subjectRow(sm: SubjectMark, paperCount: number, showPositions: boolean): SubjectRow {
    const mark = sm.percentage == null || !Number.isFinite(sm.percentage) ? null : Math.round(sm.percentage);
    return {
        name: sm.subjectName,
        teacher: sm.instructorName || undefined,
        category: sm.category || 'Other',
        mark,
        grade: sm.grade || sm.rubric || '-',
        points: sm.points,
        countsForPoints: sm.includedInPoints !== false,
        classAverage: sm.classAverage != null ? Math.round(sm.classAverage) : undefined,
        previous: sm.previousPercentage != null ? Math.round(sm.previousPercentage) : undefined,
        change: mark != null && sm.previousPercentage != null ? Math.round(mark - sm.previousPercentage) : null,
        rank: showPositions && sm.subjectRank && sm.totalStudents ? `${sm.subjectRank}/${sm.totalStudents}` : undefined,
        papers: Array.from({ length: paperCount }, (_, i) => sm.paperScores?.[i]?.score ?? null),
        remark: sm.teacherComment?.trim() || generateShortFeedback(mark, sm.grade),
    };
}

/** Mean change over the subjects that have a mark in both rounds, or null when none do. */
function likeForLikeChange(subjects: SubjectRow[]): number | null {
    const pairs = subjects.filter(s => s.mark != null && s.previous != null);
    if (pairs.length === 0) return null;
    return Math.round(pairs.reduce((sum, s) => sum + ((s.mark ?? 0) - (s.previous ?? 0)), 0) / pairs.length);
}

export function buildReportModel(data: ReportCardData, qrCode?: string): ReportModel {
    const isKCSE = data.gradingSystemType === 'KCSE';

    const paperCount = Math.min(MAX_PAPERS, Math.max(0, ...data.subjectMarks.map(m => m.paperScores?.length ?? 0)));
    const paperCodes = Array.from({ length: paperCount }, (_, i) =>
        data.subjectMarks.find(m => (m.paperScores?.length ?? 0) > i)?.paperScores?.[i]?.code || `PP${i + 1}`);

    const showPositions = data.showPositions;
    const subjects = data.subjectMarks.map(sm => subjectRow(sm, paperCount, showPositions));
    const marked = subjects.filter(s => s.mark != null);
    const ranked = [...marked].sort((a, b) => (b.mark ?? 0) - (a.mark ?? 0));
    const movers = marked.filter(s => s.change != null).sort((a, b) => (b.change ?? 0) - (a.change ?? 0));

    const mean = Math.round(data.overallPercentage);
    // CBC reports a LEVEL. Derive it from the school's own bands so the card
    // agrees with the levels printed against each learning area.
    const cbcBand = bandFor(data, data.overallPercentage);
    const grade = isKCSE
        ? (data.overallPointsGrade || data.overallGrade || '-')
        : (cbcBand?.symbol || levelFamily(data.overallGrade || '', data.overallPercentage));
    const gradeCaption = isKCSE
        ? 'KCSE 12-point scale'
        : (cbcBand?.label || CBC_LEVEL_NAMES[levelFamily(grade, data.overallPercentage)]);

    const categoryNames = [...new Set(marked.map(s => s.category))];
    const categories: CategoryRow[] = categoryNames.map(name => {
        const inCategory = marked.filter(s => s.category === name);
        const withPrevious = inCategory.filter(s => s.previous != null);
        const avg = (values: number[]) => Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
        return {
            name,
            mean: avg(inCategory.map(s => s.mark ?? 0)),
            previous: withPrevious.length > 0 ? avg(withPrevious.map(s => s.previous ?? 0)) : undefined,
        };
    });

    const hasRank = showPositions && data.classRank > 0 && data.totalStudents > 0;
    const classMean = data.classMeanPercentage != null ? Math.round(data.classMeanPercentage) : undefined;

    return {
        isKCSE,
        subjectNoun: isKCSE ? 'Subject' : 'Learning area',
        subjectNounPlural: isKCSE ? 'subjects' : 'learning areas',
        gradeNoun: isKCSE ? 'Grade' : 'Level',

        school: {
            name: data.schoolName,
            address: data.schoolAddress || undefined,
            logo: data.schoolLogoUrl || undefined,
            initial: (data.schoolName || 'S').trim().charAt(0).toUpperCase(),
        },
        learner: {
            name: data.studentName,
            initials: initialsOf(data.studentName),
            admission: data.enrollmentNumber || '-',
            className: data.className,
            pathway: data.pathwayName
                ? `${data.pathwayName}${data.combinationCode ? ` (${data.combinationCode})` : ''}`
                : undefined,
        },
        exam: {
            title: data.examTitle,
            year: data.academicYear,
            openingDate: data.openingDate || undefined,
            issued: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        },

        subjects,
        paperCodes,
        hasPrevious: subjects.some(s => s.previous != null),
        hasClassAverage: subjects.some(s => s.classAverage != null),
        compact: subjects.length >= COMPACT_FROM,
        rowScale: Math.min(2, 1 + 0.22 * Math.max(0, ROOMY_BELOW - subjects.length)),

        mean,
        meanChange: likeForLikeChange(subjects)
            ?? (data.previousOverallPercentage != null ? Math.round(data.overallPercentage - data.previousOverallPercentage) : null),
        totalMarks: data.totalMarks ?? marked.reduce((sum, s) => sum + (s.mark ?? 0), 0),
        totalMarksOutOf: marked.length * 100,
        rankedByLabel: data.rankedBy === 'points' ? 'total points' : data.rankedBy === 'totalMarks' ? 'total marks' : 'mean mark',
        ranksByTotal: data.rankedBy === 'totalMarks',
        grade,
        gradeCaption,
        points: isKCSE ? data.totalPoints : undefined,
        pointsChange: isKCSE && data.totalPoints != null && data.previousTotalPoints != null
            ? data.totalPoints - data.previousTotalPoints
            : null,
        position: hasRank ? { rank: data.classRank, of: data.totalStudents } : undefined,
        showPositions,
        positionChange: hasRank && data.previousClassRank ? data.previousClassRank - data.classRank : null,
        overallPosition: showPositions && data.overallRank != null && data.overallSize
            ? { rank: data.overallRank, of: data.overallSize, label: data.overallRankLabel || 'Overall position' }
            : undefined,
        classMean,
        vsClassMean: classMean != null ? mean - classMean : null,
        previousLabel: data.previousExamLabel || 'Last exam',

        scale: schoolScale(data, isKCSE),
        categories,
        ranked,
        movers,
        aboveClassCount: marked.filter(s => s.classAverage != null && (s.mark ?? 0) >= s.classAverage).length,
        improvedCount: movers.filter(s => (s.change ?? 0) > 0).length,

        teacherComment: data.classTeacherComment?.trim()
            || generateClassTeacherComment(data.overallPercentage, data.overallGrade, data.totalPoints),
        principalComment: data.principalComment?.trim()
            || generatePrincipalComment(data.overallPercentage, data.overallGrade, data.totalPoints),
        qrCode,
    };
}
