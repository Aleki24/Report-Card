/**
 * A teacher's day joined up: each timetabled lesson with the scheme of work
 * it follows, the next scheme lesson not yet taught, and the lesson plan and
 * record of work for that day. Shared by the web page and the app.
 */
import type { SchemeEntry } from '../ops/forms/academics';

export interface TeachingDayLesson {
    /** The first timetable lesson of the run (a double has two). */
    lessonId: string;
    periods: number;
    start: string;
    end: string;
    label: string;
    subject: { id: string; name: string };
    stream: { id: string; name: string };
    room: string | null;
    scheme: { id: string; title: string; status: string } | null;
    /** The next lesson in the scheme that has no record of work yet. */
    entry: (SchemeEntry & { id: string }) | null;
    plan: { id: string; topic: string } | null;
    record: { id: string; work_covered: string } | null;
}

export interface TeachingDay {
    date: string;
    published: boolean;
    lessons: TeachingDayLesson[];
}

export type TeachingDayAction = 'plan' | 'record';

/** What to do next for a lesson, in order: plan it, then record it. */
export function nextStep(l: TeachingDayLesson): { action: TeachingDayAction; label: string } | null {
    if (!l.plan) return { action: 'plan', label: l.entry ? 'Plan from scheme' : 'Plan lesson' };
    if (!l.record) return { action: 'record', label: 'Mark as taught' };
    return null;
}

export const TEACHING_DAY_NOTE = 'Your lessons for the day from the published timetable, each with the next lesson in its scheme of work. Planning fills the lesson plan from the scheme; marking it taught adds the record of work and counts towards coverage.';
