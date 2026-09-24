import { useMemo } from 'react';
import { useApiQuery } from './useApiQuery';
import { withQuery } from './api';
import { findActiveTermId } from './academics';
import type { AcademicStructure, AcademicYear, ExamSlot, GradeStream, Term } from './types';

/**
 * Small hooks over the school's reference data, so screens that need the
 * same lists (terms, classes, the academic structure) fetch them one way.
 */

export function useTerms() {
    const query = useApiQuery<Term[]>('/api/school/data?type=terms');
    const terms = useMemo(() => query.data ?? [], [query.data]);
    const activeTermId = useMemo(() => findActiveTermId(terms), [terms]);
    return { ...query, terms, activeTermId };
}

export function useAcademicYears() {
    const query = useApiQuery<AcademicYear[]>('/api/school/data?type=academic_years');
    return { ...query, years: query.data ?? [] };
}

/** Classes visible to the caller — the backend narrows these for teachers. */
export function useGradeStreams() {
    const query = useApiQuery<GradeStream[]>('/api/school/data?type=grade_streams');
    return { ...query, streams: query.data ?? [] };
}

export function useAcademicStructure() {
    return useApiQuery<AcademicStructure>('/api/admin/academic-structure', { raw: true });
}

export interface ExamFilters {
    term_id?: string | null;
    exam_type?: string | null;
    stream_id?: string | null;
    grade_id?: string | null;
    status?: string | null;
}

/** Exam slots the caller may see (teachers get only the ones they can mark). */
export function useExams(filters: ExamFilters | null) {
    const path = filters && filters.term_id !== '' ? withQuery('/api/school/exams', { ...filters }) : null;
    const query = useApiQuery<ExamSlot[]>(path);
    return { ...query, exams: query.data ?? [] };
}

/** Distinct classes (grade + optional stream) the given exams cover, sorted by name. */
export function examClasses(exams: readonly ExamSlot[]): { key: string; label: string }[] {
    const map = new Map<string, string>();
    for (const e of exams) map.set(e.grade_id, e.grade_name);
    return [...map.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export function examLabel(exam: ExamSlot): string {
    return exam.grade_stream_name ? `${exam.subject_name} · ${exam.grade_stream_name}` : exam.subject_name;
}
