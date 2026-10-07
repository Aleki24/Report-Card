import { getExamType, getExamTypeName } from './exam-types';

/**
 * Papers ready to release: this term's, with marks entered, not yet released
 * (GET /api/school/exams?ready=1). The dashboard's "ready to release" card
 * counts exactly these and opens on them. Client-safe: the web Publish tab
 * and the app's both group them here.
 */
export interface ReadyPaper {
    id: string;
    exam_type: string;
    subject_name: string;
    grade_name: string;
    grade_stream_name: string | null;
    mark_count: number;
}

/** One class's sitting of one exam, e.g. "Grade 10 · Mid-Term Exam", with its papers. */
export interface ReadyGroup {
    key: string;
    classLabel: string;
    examType: string;
    examName: string;
    papers: ReadyPaper[];
}

const examOrder = (code: string) => getExamType(code)?.order ?? 99;

/** Grouped by class then exam, in school order (numbers compared as numbers: Grade 2 before Grade 10). */
export function groupReadyPapers(papers: readonly ReadyPaper[]): ReadyGroup[] {
    const groups = new Map<string, ReadyGroup>();
    for (const p of papers) {
        const classLabel = p.grade_stream_name ?? p.grade_name;
        const key = `${classLabel}|${p.exam_type}`;
        const group = groups.get(key) ?? { key, classLabel, examType: p.exam_type, examName: getExamTypeName(p.exam_type), papers: [] };
        group.papers.push(p);
        groups.set(key, group);
    }
    for (const g of groups.values()) g.papers.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    return [...groups.values()].sort((a, b) =>
        a.classLabel.localeCompare(b.classLabel, undefined, { numeric: true }) || examOrder(a.examType) - examOrder(b.examType));
}
