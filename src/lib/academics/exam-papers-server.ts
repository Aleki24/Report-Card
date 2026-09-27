import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, assertInSchool, type Access } from '@/lib/platform/access';
import { optionalCount, optionalDateTime, optionalText, optionalUuid, text, uuid } from '@/lib/ops/zod-fields';
import { MAX_PAPER_BYTES, PAPER_MIME_TYPES, type PaperFileKind, type PaperStatus } from './exam-papers';

export const BUCKET = 'exam-papers';

export const PAPER_SELECT = '*, subject:subjects(name, code), grade:grades(name_display), term:terms(name), exam:exams(name), uploader:users!exam_papers_uploaded_by_fkey(first_name, last_name), moderator:users!exam_papers_moderated_by_fkey(first_name, last_name)';

export const paperFieldsSchema = z.object({
    title: text(200),
    subject_id: uuid,
    grade_id: optionalUuid,
    exam_id: optionalUuid,
    term_id: optionalUuid,
    paper_label: optionalText(20),
    copies_needed: optionalCount(100_000),
    release_at: optionalDateTime,
});

export interface PaperRow {
    id: string;
    school_id: string;
    status: PaperStatus;
    uploaded_by: string | null;
    paper_path: string | null;
    scheme_path: string | null;
}

/** Form fields sent alongside files arrive as strings; read them into an object. */
export function formFields(form: FormData): Record<string, string> {
    const out: Record<string, string> = {};
    form.forEach((value, key) => { if (typeof value === 'string') out[key] = value; });
    return out;
}

export function parsePaperFields(raw: Record<string, string>, partial: boolean) {
    const schema = partial ? paperFieldsSchema.partial() : paperFieldsSchema;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, 'Validation failed', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
    const sent = new Set(Object.keys(raw));
    return Object.fromEntries(Object.entries(parsed.data).filter(([k]) => sent.has(k)));
}

export async function assertPaperRefs(values: Record<string, unknown>, schoolId: string) {
    await Promise.all([
        assertInSchool('school_subject_catalogue', [values.subject_id as string | undefined], schoolId),
        assertInSchool('exams', [values.exam_id as string | undefined], schoolId),
        assertInSchool('terms', [values.term_id as string | undefined], schoolId),
    ]);
}

export async function loadPaper(id: string, access: Access): Promise<PaperRow> {
    const { data, error } = await createSupabaseAdmin()
        .from('exam_papers')
        .select('id, school_id, status, uploaded_by, paper_path, scheme_path')
        .eq('id', id)
        .eq('school_id', access.schoolId)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Paper not found.');
    return data as PaperRow;
}

/** Validates and stores an uploaded file; returns its storage path. */
export async function storePaperFile(file: File, schoolId: string, paperId: string, kind: PaperFileKind): Promise<string> {
    const ext = PAPER_MIME_TYPES[file.type];
    if (!ext) throw new HttpError(400, 'Upload a PDF or Word document.');
    if (file.size > MAX_PAPER_BYTES) throw new HttpError(400, 'Files must be 15 MB or smaller.');
    const path = `${schoolId}/${paperId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await createSupabaseAdmin().storage
        .from(BUCKET)
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
    return path;
}

/** Stores any `paper` / `scheme` files in the form and returns the columns to update. */
export async function storeFormFiles(form: FormData, schoolId: string, paperId: string): Promise<Record<string, string>> {
    const updates: Record<string, string> = {};
    for (const kind of ['paper', 'scheme'] as const) {
        const file = form.get(kind);
        if (file instanceof File && file.size > 0) updates[`${kind}_path`] = await storePaperFile(file, schoolId, paperId, kind);
    }
    return updates;
}
