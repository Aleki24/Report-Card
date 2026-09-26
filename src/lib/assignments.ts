import { z } from 'zod';

/** Client-safe rules and shapes shared by the Assignments page and its API. */

export const ASSIGNMENT_TITLE_MAX = 200;
export const ASSIGNMENT_DESCRIPTION_MAX = 5000;
export const ASSIGNMENT_FEEDBACK_MAX = 1000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a due date.');

export const assignmentSchema = z.object({
    title: z.string().trim().min(1, 'Give the assignment a title.').max(ASSIGNMENT_TITLE_MAX, `Keep the title under ${ASSIGNMENT_TITLE_MAX} characters.`),
    subject_id: z.string().min(1, 'Choose a subject.'),
    grade_stream_id: z.string().min(1, 'Choose the class it is for.'),
    due_date: isoDate,
    description: z.string().trim().max(ASSIGNMENT_DESCRIPTION_MAX, `Keep the instructions under ${ASSIGNMENT_DESCRIPTION_MAX} characters.`).nullish().transform(v => v || null),
    file_url: z.string().url('The attachment link is not valid.').nullish().transform(v => v || null),
});

export const gradeSubmissionSchema = z.object({
    grade: z.number().min(0, 'A grade is from 0 to 100.').max(100, 'A grade is from 0 to 100.').nullable(),
    feedback: z.string().trim().max(ASSIGNMENT_FEEDBACK_MAX, `Keep feedback under ${ASSIGNMENT_FEEDBACK_MAX} characters.`).nullish().transform(v => v || null),
});

export interface Assignment {
    id: string;
    title: string;
    description: string | null;
    /** YYYY-MM-DD */
    dueDate: string;
    fileUrl: string | null;
    subject: string;
    subjectId: string;
    stream: string | null;
    streamId: string | null;
    createdBy: string;
    createdById: string | null;
    createdAt: string;
    submissionCount: number;
}

export interface Submission {
    id: string;
    assignmentId: string;
    fileUrl: string | null;
    submissionText: string | null;
    submittedAt: string;
    grade: number | null;
    feedback: string | null;
    gradedAt: string | null;
    studentName: string | null;
    admissionNumber: string | null;
}

/** Today in the viewer's time zone, as the date inputs show it. */
export function localToday(now = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later';

/**
 * Where a due date stands. Due dates are whole days, so work due today is
 * not overdue until tomorrow; it used to be compared with the current time
 * and show as overdue from midnight UTC on the day it was due.
 */
export function dueState(dueDate: string, today = localToday()): DueState {
    if (dueDate < today) return 'overdue';
    if (dueDate === today) return 'today';
    const days = (Date.parse(dueDate) - Date.parse(today)) / 86_400_000;
    return days <= 7 ? 'soon' : 'later';
}

/** "Due today", "Due tomorrow", "Due Fri 3 Oct", "Was due 12 Sep". */
export function dueLabel(dueDate: string, today = localToday()): string {
    const state = dueState(dueDate, today);
    const date = new Date(`${dueDate}T00:00:00`);
    if (state === 'today') return 'Due today';
    const days = Math.round((Date.parse(dueDate) - Date.parse(today)) / 86_400_000);
    if (days === 1) return 'Due tomorrow';
    if (state === 'overdue') return `Was due ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    return `Due ${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
}
