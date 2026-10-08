/**
 * The exam paper workflow, shared by the API and the page:
 *
 *   DRAFT ─submit→ SUBMITTED ─approve→ APPROVED ─lock→ LOCKED ─release→ RELEASED
 *                       └─return→ RETURNED ─submit→ SUBMITTED
 *
 * The teacher who uploads a paper submits it; an HOD or DOS moderates; the
 * DOS or exams officer locks it for printing and releases it after the exam.
 */
import type { Permission } from '../platform/permissions';

export const PAPER_STATUSES = ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'LOCKED', 'RELEASED'] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const PRINT_STATUSES = ['PENDING', 'PRINTED', 'PACKED'] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];

export const PAPER_ACTIONS = ['SUBMIT', 'APPROVE', 'RETURN', 'LOCK', 'RELEASE', 'COMMENT'] as const;
export type PaperAction = (typeof PAPER_ACTIONS)[number];

export const PAPER_FILE_KINDS = ['paper', 'scheme'] as const;
export type PaperFileKind = (typeof PAPER_FILE_KINDS)[number];

interface Transition {
    from: readonly PaperStatus[];
    to: PaperStatus | null;
    /** Who may act; `owner` means the teacher who uploaded the paper. */
    by: Permission | 'owner';
    label: string;
}

export const TRANSITIONS: Record<PaperAction, Transition> = {
    SUBMIT: { from: ['DRAFT', 'RETURNED'], to: 'SUBMITTED', by: 'owner', label: 'Submit for moderation' },
    APPROVE: { from: ['SUBMITTED'], to: 'APPROVED', by: 'exam_papers.moderate', label: 'Approve' },
    RETURN: { from: ['SUBMITTED', 'APPROVED'], to: 'RETURNED', by: 'exam_papers.moderate', label: 'Return for changes' },
    LOCK: { from: ['APPROVED'], to: 'LOCKED', by: 'exam_papers.manage', label: 'Lock for printing' },
    RELEASE: { from: ['LOCKED'], to: 'RELEASED', by: 'exam_papers.manage', label: 'Release to past papers' },
    COMMENT: { from: PAPER_STATUSES, to: null, by: 'exam_papers.moderate', label: 'Comment' },
};

/** Statuses in which the uploading teacher may still replace files and edit details. */
export const EDITABLE_BY_OWNER: readonly PaperStatus[] = ['DRAFT', 'RETURNED'];

export const MAX_PAPER_BYTES = 15 * 1024 * 1024;
export const PAPER_MIME_TYPES: Readonly<Record<string, string>> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export interface PaperActor {
    userId: string;
    can: (p: Permission) => boolean;
}

export function canAct(action: PaperAction, paper: { status: PaperStatus; uploaded_by: string | null }, actor: PaperActor): boolean {
    const t = TRANSITIONS[action];
    if (!t.from.includes(paper.status)) return false;
    if (t.by === 'owner') return paper.uploaded_by === actor.userId || actor.can('exam_papers.manage');
    // An author comments on their own paper; moderators and managers on any.
    if (action === 'COMMENT' && paper.uploaded_by === actor.userId) return true;
    return actor.can(t.by) || actor.can('exam_papers.manage');
}

/**
 * Who may open a paper's files: its author, moderators and managers at any
 * stage; any teacher once it is released as a past paper.
 */
export function canOpenFiles(paper: { status: PaperStatus; uploaded_by: string | null }, actor: PaperActor): boolean {
    if (paper.uploaded_by === actor.userId) return true;
    if (actor.can('exam_papers.moderate') || actor.can('exam_papers.manage')) return true;
    return paper.status === 'RELEASED' && actor.can('exam_papers.upload');
}

/** Someone who can moderate this school's papers, and what lets them. */
export interface PaperModerator {
    id: string;
    name: string;
    /** "Admin", or the duty that grants moderation ("Head of Department"). */
    via: string;
}

/** "Ann, Ben and Cy"; more than three end "and N others". */
function nameList(names: readonly string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    const shown = names.length > 3 ? [...names.slice(0, 3), `${names.length - 3} other${names.length === 4 ? '' : 's'}`] : names;
    return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

/** Who a submitted paper waits for, in words. */
export function moderatorNames(moderators: readonly PaperModerator[] | null | undefined): string {
    return moderators?.length ? nameList(moderators.map(m => m.name)) : 'a moderator (an HOD or the Director of Studies)';
}

/**
 * What happens next to a paper, said to the person looking at it: uploading
 * a paper used to leave it a draft with no hint that it still had to be
 * submitted, or who would moderate it.
 */
export function paperNextStep(
    paper: { status: PaperStatus; uploaded_by: string | null },
    actor: PaperActor,
    moderators?: readonly PaperModerator[] | null,
): string {
    const mine = paper.uploaded_by === actor.userId;
    switch (paper.status) {
        case 'DRAFT':
            return canAct('SUBMIT', paper, actor)
                ? `Not sent yet. Tap “${TRANSITIONS.SUBMIT.label}” when it is ready, and ${moderatorNames(moderators)} will be able to moderate it.`
                : 'A draft: the teacher has not submitted it for moderation yet.';
        case 'SUBMITTED':
            return canAct('APPROVE', paper, actor)
                ? 'Waiting for you: open the paper, then approve it or return it with a comment saying what to change.'
                : `Submitted. Waiting for ${moderatorNames(moderators)} to moderate it.`;
        case 'RETURNED':
            return mine
                ? 'Returned for changes. Read the comments below, replace the file, then submit it again.'
                : 'Returned to the teacher for changes.';
        case 'APPROVED':
            return canAct('LOCK', paper, actor)
                ? 'Approved. Lock it for printing when the copies are being made.'
                : 'Approved. The exams office will lock it for printing.';
        case 'LOCKED':
            return canAct('RELEASE', paper, actor)
                ? 'Locked for printing. Release it to past papers once the exam is over.'
                : 'Locked for printing. It becomes a past paper after the exam.';
        case 'RELEASED':
            return 'Released: every teacher can open it under Past papers.';
    }
}
