import { route, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import {
    PAPER_SELECT, assertPaperRefs, detailFields, formHasFile, parsePaperFields, storeFormFiles,
} from '@/lib/academics/exam-papers-server';

const READERS = ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'] as const;

/**
 * Moderators and managers see every paper; a teacher sees their own plus
 * released past papers.
 */
export const GET = route('exam papers list', { module: 'exam_papers', permission: READERS }, async ({ access }) => {
    let query = createSupabaseAdmin()
        .from('exam_papers')
        .select(PAPER_SELECT)
        .eq('school_id', access.schoolId)
        .order('updated_at', { ascending: false })
        .limit(1000);
    if (!access.can('exam_papers.moderate') && !access.can('exam_papers.manage')) {
        query = query.or(`uploaded_by.eq.${access.userId},status.eq.RELEASED`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
});

/**
 * A new paper: details plus the paper (and optionally its marking scheme).
 * With `submit=true` it goes straight to moderation, as SUBMIT would; a
 * paper left as a draft waited unseen because nothing said it still had to
 * be submitted.
 */
export const POST = route('exam papers create', { module: 'exam_papers', permission: 'exam_papers.upload' }, async ({ access, request }) => {
    const form = await request.formData().catch(() => { throw new HttpError(400, 'Send the paper as a form upload.'); });
    const values = parsePaperFields(detailFields(form), false);
    await assertPaperRefs(values, access.schoolId);
    if (!formHasFile(form, 'paper')) throw new HttpError(400, 'Attach the exam paper.');
    const submit = form.get('submit') === 'true';

    const db = createSupabaseAdmin();
    const { data: created, error } = await db
        .from('exam_papers')
        .insert({ ...values, school_id: access.schoolId, uploaded_by: access.userId, status: submit ? 'SUBMITTED' : 'DRAFT' })
        .select('id')
        .single();
    if (error || !created) throw error ?? new Error('insert failed');

    try {
        const files = await storeFormFiles(form, access.schoolId, created.id);
        const { data, error: updateError } = await db.from('exam_papers').update(files).eq('id', created.id).select(PAPER_SELECT).single();
        if (updateError) throw updateError;
        if (submit) {
            const { error: reviewError } = await db.from('exam_paper_reviews').insert({
                school_id: access.schoolId, paper_id: created.id, reviewer_id: access.userId, action: 'SUBMIT', comment: null,
            });
            if (reviewError) throw reviewError;
        }
        await audit(access, 'create', 'exam_papers', created.id, { title: values.title, submitted: submit });
        return data;
    } catch (err) {
        // No half-created paper without its file.
        await db.from('exam_papers').delete().eq('id', created.id);
        throw err;
    }
});
