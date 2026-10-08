/**
 * Changing who is a class's class teacher. Client-safe: the API, the web
 * Users page and the mobile app share these.
 */

export const CLASS_TEACHER_URL = '/api/admin/class-teacher';

/**
 * Error code for a change that would replace someone: the class already has
 * a class teacher, or the new teacher leaves another class. The error text is
 * the question to ask; sending again with `replace: true` goes ahead.
 */
export const CLASS_TEACHER_REPLACE = 'CLASS_TEACHER_REPLACE';

/** A teacher who can be made a class teacher, and the class they hold this year. */
export interface ClassTeacherCandidate {
    id: string;
    name: string;
    class_id: string | null;
    class_name: string | null;
}

export interface ClassTeacherCandidates {
    teachers: ClassTeacherCandidate[];
}

/** PUT body: `user_id` null leaves the class without a class teacher. */
export interface SetClassTeacherRequest {
    grade_stream_id: string;
    user_id: string | null;
    replace?: boolean;
}

/** Who holds each class this year, by class id. */
export function holdersByClass(teachers: readonly ClassTeacherCandidate[]): Map<string, ClassTeacherCandidate> {
    return new Map(teachers.filter(t => t.class_id).map(t => [t.class_id as string, t]));
}
