/**
 * GET /api/school/data?type=students for one exam's mark sheet: the learners
 * of its class (or of its whole grade, for a grade-wide paper) who take its
 * subject. Mark entry used to download every learner in the school and
 * filter in the browser, and bulk upload matched admission numbers against
 * all of them.
 *
 * Client-safe: the web and the app build the same request.
 */
export interface ExamRosterScope {
    subjectId?: string | null;
    gradeStreamId?: string | null;
    gradeId?: string | null;
}

export function examRosterUrl({ subjectId, gradeStreamId, gradeId }: ExamRosterScope): string {
    const params = new URLSearchParams({ type: 'students' });
    if (subjectId) params.set('subject_id', subjectId);
    if (gradeStreamId) params.set('grade_stream_id', gradeStreamId);
    else if (gradeId) params.set('grade_id', gradeId);
    return `/api/school/data?${params.toString()}`;
}
