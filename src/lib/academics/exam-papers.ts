/**
 * The exam paper workflow, shared by the API and the page:
 *
 *   DRAFT ─submit→ SUBMITTED ─approve→ APPROVED ─lock→ LOCKED ─release→ RELEASED
 *                       └─return→ RETURNED ─submit→ SUBMITTED
 *
 * The teacher who uploads a paper submits it; an HOD or DOS moderates; the
 * DOS or exams officer locks it for printing and releases it after the exam.
 */
import type { Permission } from '@/lib/platform/permissions';

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
