import type { PillTone } from '@/components/ops/StatusPill';
import type { PersonName } from '@/lib/ops/resource';
import type { PaperAction, PaperStatus, PrintStatus } from '@/lib/academics/exam-papers';

export interface ExamPaper {
    id: string;
    title: string;
    status: PaperStatus;
    print_status: PrintStatus;
    paper_label: string | null;
    copies_needed: number;
    release_at: string | null;
    uploaded_by: string | null;
    paper_path: string | null;
    scheme_path: string | null;
    updated_at: string;
    subject: { name: string; code: string } | null;
    grade: { name_display: string } | null;
    term: { name: string } | null;
    exam: { name: string } | null;
    uploader: PersonName | null;
    moderator: PersonName | null;
}

export interface PaperReview {
    id: string;
    action: PaperAction;
    comment: string | null;
    created_at: string;
    reviewer: PersonName | null;
}

export const PAPER_STATUS_TONES: Record<PaperStatus, PillTone> = {
    DRAFT: 'neutral',
    SUBMITTED: 'info',
    RETURNED: 'warn',
    APPROVED: 'good',
    LOCKED: 'violet',
    RELEASED: 'good',
};

export const PRINT_STATUS_TONES: Record<PrintStatus, PillTone> = {
    PENDING: 'warn',
    PRINTED: 'info',
    PACKED: 'good',
};
