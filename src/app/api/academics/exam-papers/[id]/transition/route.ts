import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { PAPER_ACTIONS, TRANSITIONS, canAct } from '@/lib/academics/exam-papers';
import { PAPER_SELECT, loadPaper } from '@/lib/academics/exam-papers-server';

type Params = { id: string };

const bodySchema = z.object({
    action: z.enum(PAPER_ACTIONS),
    comment: z.string().trim().max(2000).optional(),
});

/** Moves a paper through moderation, recording who did what and why. */
export const POST = route<Params>(
    'exam paper transition',
    { module: 'exam_papers', permission: ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'] },
    async ({ access, params, request }) => {
        const { action, comment } = await parseBody(request, bodySchema);
        const paper = await loadPaper(params.id, access);
        if (!canAct(action, paper, access)) throw new HttpError(403, `You cannot ${TRANSITIONS[action].label.toLowerCase()} this paper now.`);
        if ((action === 'RETURN' || action === 'COMMENT') && !comment) throw new HttpError(400, 'Add a comment explaining what to change.');
        if (action === 'SUBMIT' && !paper.paper_path) throw new HttpError(400, 'Attach the paper before submitting.');

        const db = createSupabaseAdmin();
        const to = TRANSITIONS[action].to;
        if (to) {
            const moderation = action === 'APPROVE' || action === 'RETURN'
                ? { moderated_by: access.userId, moderated_at: new Date().toISOString() }
                : {};
            // Guard on the status we read, so two moderators cannot both act on one submission.
            const { data: moved, error } = await db
                .from('exam_papers')
                .update({ status: to, updated_at: new Date().toISOString(), ...moderation })
                .eq('id', paper.id)
                .eq('status', paper.status)
                .select('id');
            if (error) throw error;
            if (!moved?.length) throw new HttpError(409, 'Someone else changed this paper just now. Refresh and try again.');
        }
        const { error: reviewError } = await db.from('exam_paper_reviews').insert({
            school_id: access.schoolId, paper_id: paper.id, reviewer_id: access.userId, action, comment: comment || null,
        });
        if (reviewError) throw reviewError;
        await audit(access, action === 'APPROVE' ? 'approve' : action === 'RETURN' ? 'reject' : action === 'RELEASE' ? 'release' : 'update', 'exam_papers', paper.id, { action, comment });

        const { data, error } = await db.from('exam_papers').select(PAPER_SELECT).eq('id', paper.id).single();
        if (error) throw error;
        return data;
    },
);
