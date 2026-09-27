import { route, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { EDITABLE_BY_OWNER, PRINT_STATUSES, type PrintStatus } from '@/lib/academics/exam-papers';
import {
    BUCKET, PAPER_SELECT, assertPaperRefs, formFields, loadPaper, parsePaperFields, storeFormFiles,
} from '@/lib/academics/exam-papers-server';

type Params = { id: string };
const READERS = ['exam_papers.upload', 'exam_papers.moderate', 'exam_papers.manage'] as const;

/** One paper with its moderation history. */
export const GET = route<Params>('exam paper detail', { module: 'exam_papers', permission: READERS }, async ({ access, params }) => {
    const paper = await loadPaper(params.id, access);
    const reviewer = access.can('exam_papers.moderate') || access.can('exam_papers.manage');
    if (!reviewer && paper.uploaded_by !== access.userId && paper.status !== 'RELEASED') throw new HttpError(404, 'Paper not found.');
    const db = createSupabaseAdmin();
    const [{ data, error }, { data: reviews, error: reviewsError }] = await Promise.all([
        db.from('exam_papers').select(PAPER_SELECT).eq('id', paper.id).single(),
        db.from('exam_paper_reviews')
            .select('id, action, comment, created_at, reviewer:users!exam_paper_reviews_reviewer_id_fkey(first_name, last_name)')
            .eq('paper_id', paper.id)
            .order('created_at'),
    ]);
    if (error || reviewsError) throw error ?? reviewsError;
    return { ...data, reviews: reviews ?? [] };
});

/**
 * Edit details or replace files (author while in draft or returned, or a
 * manager any time), or set printing progress (manager).
 */
export const PATCH = route<Params>('exam paper update', { module: 'exam_papers', permission: READERS }, async ({ access, params, request }) => {
    const paper = await loadPaper(params.id, access);
    const manager = access.can('exam_papers.manage');
    const isForm = request.headers.get('content-type')?.includes('multipart/form-data');
    const form = isForm ? await request.formData() : null;
    const raw = form ? formFields(form) : ((await request.json().catch(() => ({}))) as Record<string, string>);

    const updates: Record<string, unknown> = {};
    if ('print_status' in raw) {
        if (!manager) throw new HttpError(403, 'Only the exams office updates printing.');
        if (!(PRINT_STATUSES as readonly string[]).includes(raw.print_status)) throw new HttpError(400, 'Unknown print status.');
        updates.print_status = raw.print_status as PrintStatus;
        delete raw.print_status;
    }

    const detailKeys = Object.keys(raw);
    const hasFiles = !!form && (['paper', 'scheme'] as const).some(k => { const f = form.get(k); return f instanceof File && f.size > 0; });
    if (detailKeys.length > 0 || hasFiles) {
        const ownerMayEdit = paper.uploaded_by === access.userId && EDITABLE_BY_OWNER.includes(paper.status);
        if (!manager && !ownerMayEdit) throw new HttpError(409, 'This paper is with the moderators; it can no longer be edited.');
        const values = parsePaperFields(raw, true);
        await assertPaperRefs(values, access.schoolId);
        Object.assign(updates, values);
        if (form) {
            const files = await storeFormFiles(form, access.schoolId, paper.id);
            Object.assign(updates, files);
            // Replaced files are removed so an old draft cannot leak later.
            const stale = (['paper_path', 'scheme_path'] as const).filter(k => files[k] && paper[k]).map(k => paper[k] as string);
            if (stale.length > 0) await createSupabaseAdmin().storage.from(BUCKET).remove(stale);
        }
    }
    if (Object.keys(updates).length === 0) throw new HttpError(400, 'Nothing to update.');

    const { data, error } = await createSupabaseAdmin()
        .from('exam_papers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', paper.id)
        .select(PAPER_SELECT)
        .single();
    if (error) throw error;
    await audit(access, 'update', 'exam_papers', paper.id, { fields: Object.keys(updates) });
    return data;
});

/** Authors may delete their own drafts; managers any paper. Files go with it. */
export const DELETE = route<Params>('exam paper delete', { module: 'exam_papers', permission: READERS }, async ({ access, params }) => {
    const paper = await loadPaper(params.id, access);
    const own = paper.uploaded_by === access.userId && paper.status === 'DRAFT';
    if (!own && !access.can('exam_papers.manage')) throw new HttpError(403, 'Only draft papers can be deleted by their author.');
    const files = [paper.paper_path, paper.scheme_path].filter((p): p is string => !!p);
    if (files.length > 0) await createSupabaseAdmin().storage.from(BUCKET).remove(files);
    const { error } = await createSupabaseAdmin().from('exam_papers').delete().eq('id', paper.id);
    if (error) throw error;
    await audit(access, 'delete', 'exam_papers', paper.id);
    return { deleted: true };
});
