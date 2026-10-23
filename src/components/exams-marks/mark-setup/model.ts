import type { ExamWindow } from '@/lib/exam-windows';

/**
 * Shapes and helpers of the Mark Entry tab: what the exam list returns,
 * remembering the last exam opened, and laying out subject columns.
 */

export interface MySubjectItem { id: string; code: string; name: string; academic_level_id: string; category?: string; }
export interface Term { id: string; name: string; academic_year_id: string; academic_year_name?: string | null; is_current: boolean; }
export interface AcademicLevel { id: string; code: string; name: string; }
export interface GradeItem { id: string; code?: string | null; name_display: string; academic_level_id: string; }
export interface ExamSlot {
  id: string; name: string; exam_type: string; max_score: number;
  /** YYYY-MM-DD the paper is scheduled for. */
  exam_date: string;
  subject_id: string; subject_name: string; subject_code: string; subject_category: string;
  grade_id: string; grade_name: string; term_id: string;
  grade_stream_id?: string | null; grade_stream_name?: string | null;
  /** APPROVED once results are released to learners and parents. */
  status?: string;
}
/** A subject shown in the picker; `hasExam` is false for a teacher's subject with no exam slot yet. */
export interface SubjectChoice { subject_id: string; subject_name: string; subject_code: string; subject_category: string; hasExam: boolean; }

export type EntryMode = 'manual' | 'bulk' | 'scan';

/** The last exam opened here, so a teacher can pick up where they left off. */
export interface LastExam { termId: string; examId: string; label: string; }
const LAST_EXAM_KEY = 'skulbase:mark-entry:last:v1';

export function readLastExam(): LastExam | null {
  try {
    const raw = window.localStorage.getItem(LAST_EXAM_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LastExam>) : null;
    return parsed?.termId && parsed.examId && parsed.label ? { termId: parsed.termId, examId: parsed.examId, label: parsed.label } : null;
  } catch {
    return null;
  }
}

export function writeLastExam(value: LastExam): void {
  try { window.localStorage.setItem(LAST_EXAM_KEY, JSON.stringify(value)); } catch { /* private mode: nothing to remember */ }
}

export async function fetchTermExams(termId: string): Promise<ExamSlot[]> {
  const res = await fetch(`/api/school/exams?term_id=${encodeURIComponent(termId)}`, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as { data?: ExamSlot[]; error?: string } | null;
  // Throw rather than return []: an empty list reads as "no exams set up yet"
  // and invites an admin to set the term up again.
  if (!res.ok) throw new Error(json?.error || 'Could not load this term’s exams.');
  return json?.data ?? [];
}

export async function loadSubjects(url: string): Promise<MySubjectItem[]> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const json = (await res.json()) as { data?: MySubjectItem[] };
    return json.data ?? [];
  } catch (err) {
    console.error('Failed to fetch subjects:', err);
    return [];
  }
}

export function windowMap(rows: readonly ExamWindow[]): ReadonlyMap<string, string> {
  return new Map(rows.map(w => [w.grade_id, w.exam_type]));
}

export const COLUMN_CLASS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' };

/** Deals items into `count` columns, each to the shortest so far, keeping their order within a column. */
export function balanceColumns<T>(items: readonly T[], count: number, weight: (item: T) => number): T[][] {
  const columns = Array.from({ length: Math.max(1, count) }, () => ({ items: [] as T[], height: 0 }));
  for (const item of items) {
    const shortest = columns.reduce((low, c) => (c.height < low.height ? c : low));
    shortest.items.push(item);
    shortest.height += weight(item);
  }
  return columns.map(c => c.items);
}
