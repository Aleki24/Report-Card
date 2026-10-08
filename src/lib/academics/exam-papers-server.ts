import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, assertInSchool, type Access } from '@/lib/platform/access';
import { optionalCount, optionalDateTime, optionalText, optionalUuid, text, uuid } from '@/lib/ops/zod-fields';
import { resolveAttachmentType } from '@/lib/attachments';
import { DUTIES, grantAllows, isDutyKey } from '@/lib/platform/permissions';
import type { ModuleKey } from '@/lib/platform/modules';
import { MAX_PAPER_BYTES, PAPER_FILE_KINDS, PAPER_MIME_TYPES, type PaperFileKind, type PaperModerator, type PaperStatus } from './exam-papers';

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

/**
 * A paper file's real type, or null when it is not a PDF or Word document.
 * Phones report many Word and PDF files as "application/octet-stream", and
 * those were refused; the file name decides when the reported type does not.
 */
export function paperFileType(name: string, reportedType: string | null | undefined): string | null {
    const type = resolveAttachmentType(name, reportedType);
    return type && PAPER_MIME_TYPES[type] ? type : null;
}

/** Where a file uploaded straight to storage waits until its paper is saved. */
export function stagedPaperPath(schoolId: string, kind: PaperFileKind, type: string): string {
    return `${schoolId}/staged/${crypto.randomUUID()}/${kind}.${PAPER_MIME_TYPES[type]}`;
}

/** Validates and stores a file sent with the form; returns its storage path. */
export async function storePaperFile(file: File, schoolId: string, paperId: string, kind: PaperFileKind): Promise<string> {
    const type = paperFileType(file.name, file.type);
    if (!type) throw new HttpError(400, 'Upload a PDF or Word document.');
    if (file.size > MAX_PAPER_BYTES) throw new HttpError(400, 'Files must be 15 MB or smaller.');
    const path = `${schoolId}/${paperId}/${kind}-${Date.now()}.${PAPER_MIME_TYPES[type]}`;
    const { error } = await createSupabaseAdmin().storage
        .from(BUCKET)
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, upsert: false });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
    return path;
}

/** The form field naming a file already uploaded to storage (see the upload-url route). */
export const stagedField = (kind: PaperFileKind) => `${kind}_upload`;

/**
 * Checks a file uploaded straight to storage: it must be this school's, in
 * the staging folder, for this kind of file, and really there.
 */
async function claimStagedFile(path: string, schoolId: string, kind: PaperFileKind): Promise<string> {
    const match = new RegExp(`^${schoolId}/staged/([0-9a-f-]{36})/${kind}\\.(pdf|docx?)$`).exec(path);
    if (!match) throw new HttpError(400, 'That upload is not valid. Attach the file again.');
    const { data, error } = await createSupabaseAdmin().storage.from(BUCKET).list(`${schoolId}/staged/${match[1]}`);
    if (error) throw new Error(`storage list failed: ${error.message}`);
    if (!data?.some(f => f.name === path.split('/').pop())) throw new HttpError(400, 'The file did not finish uploading. Attach it again.');
    return path;
}

/**
 * Stores the form's `paper` / `scheme` files, or claims ones already uploaded
 * straight to storage (`paper_upload` / `scheme_upload`), and returns the
 * columns to update.
 */
export async function storeFormFiles(form: FormData, schoolId: string, paperId: string): Promise<Record<string, string>> {
    const updates: Record<string, string> = {};
    for (const kind of PAPER_FILE_KINDS) {
        const file = form.get(kind);
        const staged = form.get(stagedField(kind));
        if (file instanceof File && file.size > 0) updates[`${kind}_path`] = await storePaperFile(file, schoolId, paperId, kind);
        else if (typeof staged === 'string' && staged) updates[`${kind}_path`] = await claimStagedFile(staged, schoolId, kind);
    }
    return updates;
}

/** Whether the form carries a paper or scheme, sent or already uploaded. */
export function formHasFile(form: FormData, kind: PaperFileKind): boolean {
    const file = form.get(kind);
    const staged = form.get(stagedField(kind));
    return (file instanceof File && file.size > 0) || (typeof staged === 'string' && staged.length > 0);
}

/** Form fields minus the staged-upload ones (files) and `submit` (an action), which are not details. */
export function detailFields(form: FormData): Record<string, string> {
    const raw = formFields(form);
    for (const kind of PAPER_FILE_KINDS) delete raw[stagedField(kind)];
    delete raw.submit;
    return raw;
}

interface NamedUser { id: string; first_name: string | null; last_name: string | null; is_active: boolean | null }

const fullName = (u: Pick<NamedUser, 'first_name' | 'last_name'>) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unnamed';

/**
 * Everyone who can moderate this school's papers: its admins, and staff
 * holding a current duty that grants moderation (HOD, Director of Studies,
 * Deputy, Exams Officer, Principal). Each person once, admins first.
 */
export async function paperModerators(schoolId: string, modules: ReadonlySet<ModuleKey>): Promise<PaperModerator[]> {
    const db = createSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const [adminsRes, dutiesRes] = await Promise.all([
        db.from('users').select('id, first_name, last_name, is_active').eq('school_id', schoolId).eq('role', 'ADMIN').eq('is_active', true).order('first_name'),
        db.from('user_duties').select('duty, starts_on, ends_on, users!user_duties_user_id_fkey ( id, first_name, last_name, is_active )').eq('school_id', schoolId),
    ]);
    if (adminsRes.error) throw adminsRes.error;
    if (dutiesRes.error) throw dutiesRes.error;

    const found = new Map<string, PaperModerator>();
    for (const u of (adminsRes.data ?? []) as NamedUser[]) found.set(u.id, { id: u.id, name: fullName(u), via: 'Admin' });
    for (const d of dutiesRes.data ?? []) {
        const user = (Array.isArray(d.users) ? d.users[0] : d.users) as NamedUser | null;
        const current = (!d.starts_on || d.starts_on <= today) && (!d.ends_on || d.ends_on >= today);
        if (!user?.is_active || !current || !isDutyKey(d.duty) || found.has(user.id)) continue;
        if (!grantAllows(DUTIES[d.duty].grants, modules, 'exam_papers.moderate')) continue;
        found.set(user.id, { id: user.id, name: fullName(user), via: DUTIES[d.duty].label });
    }
    return [...found.values()];
}
