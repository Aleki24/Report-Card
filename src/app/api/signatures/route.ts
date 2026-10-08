import { HttpError, route, type Access } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { isRoleIn } from '@/lib/roles';
import { isUuid } from '@/lib/postgrest';
import { SIGNATURE_PHOTO_MAX_BYTES, SIGNING_ROLES, type SignatureRecord } from '@/lib/signatures';
import { SignatureImageError, cleanSignaturePhoto, pngDataUrl } from '@/lib/signature-image';

type Target =
    | { kind: 'principal' }
    | { kind: 'section'; sectionId: string }
    | { kind: 'user'; userId: string; name: string };

const SECTION_PREFIX = 'section:';

const fullName = (u: { first_name: string | null; last_name: string | null }) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || null;

/**
 * Whose signature a request is about, and whether the caller may touch it:
 * anyone who signs may keep their own; only admins set the principal's or
 * another staff member's.
 */
async function resolveTarget(access: Access, raw: string | null): Promise<Target> {
    const target = (raw ?? 'me').trim();
    const isAdmin = access.baseRole === 'ADMIN';
    if (target === 'principal') {
        if (!isAdmin) throw new HttpError(403, 'Only admins can change the principal’s signature.');
        return { kind: 'principal' };
    }
    if (target.startsWith(SECTION_PREFIX)) {
        if (!isAdmin) throw new HttpError(403, 'Only admins can change a section head’s signature.');
        const sectionId = target.slice(SECTION_PREFIX.length);
        if (!isUuid(sectionId)) throw new HttpError(400, 'Unknown section.');
        const { data, error } = await createSupabaseAdmin().from('school_sections').select('id').eq('id', sectionId).eq('school_id', access.schoolId).maybeSingle();
        if (error) throw error;
        if (!data) throw new HttpError(404, 'Section not found.');
        return { kind: 'section', sectionId };
    }
    const userId = target === 'me' ? access.userId : target;
    if (userId !== access.userId && !isAdmin) throw new HttpError(403, 'Only admins can change another person’s signature.');
    const { data: user, error } = await createSupabaseAdmin()
        .from('users')
        .select('id, first_name, last_name, role, school_id, is_active')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!user || user.school_id !== access.schoolId) throw new HttpError(404, 'That person is not in your school.');
    if (!isRoleIn(user.role, SIGNING_ROLES)) throw new HttpError(400, 'Only staff sign report cards and mark sheets.');
    return { kind: 'user', userId, name: fullName(user) ?? 'Staff member' };
}

async function readSignature(access: Access, target: Target): Promise<SignatureRecord> {
    const db = createSupabaseAdmin();
    if (target.kind === 'principal') {
        const { data, error } = await db.from('schools').select('principal_name, principal_signature_url').eq('id', access.schoolId).maybeSingle();
        if (error) throw error;
        return { image: data?.principal_signature_url ?? null, name: data?.principal_name ?? null };
    }
    if (target.kind === 'section') {
        const { data, error } = await db.from('school_sections').select('head_name, head_signature').eq('id', target.sectionId).maybeSingle();
        if (error) throw error;
        return { image: data?.head_signature ?? null, name: data?.head_name ?? null };
    }
    const { data, error } = await db.from('user_signatures').select('image').eq('user_id', target.userId).maybeSingle();
    if (error) throw error;
    return { image: data?.image ?? null, name: target.name };
}

/** What the audit log names a signature by. */
const auditEntity = (access: Access, target: Target): [string, string] =>
    target.kind === 'principal' ? ['schools.principal_signature', access.schoolId]
        : target.kind === 'section' ? ['school_sections.head_signature', target.sectionId]
            : ['user_signatures', target.userId];

/** The signature on file: `?target=me|principal|<user id>`. */
export const GET = route('signatures GET', {}, async ({ access, request }) => {
    const target = await resolveTarget(access, request.nextUrl.searchParams.get('target'));
    return readSignature(access, target);
});

/**
 * Saves a signature from a photo (`photo`, plus `target` as for GET). The
 * photo is cleaned on the server (paper removed, cropped), so what is saved
 * and shown back is exactly what the report cards will print.
 */
export const POST = route('signatures POST', {}, async ({ access, request }) => {
    const form = await request.formData().catch(() => { throw new HttpError(400, 'Send the signature photo as a form upload.'); });
    const target = await resolveTarget(access, typeof form.get('target') === 'string' ? (form.get('target') as string) : null);
    const photo = form.get('photo');
    if (!(photo instanceof File) || photo.size === 0) throw new HttpError(400, 'Take or choose a photo of the signature.');
    if (photo.size > SIGNATURE_PHOTO_MAX_BYTES) throw new HttpError(400, 'That photo is too large. Crop it to just the signature and try again.');

    let image: string;
    try {
        image = pngDataUrl(await cleanSignaturePhoto(Buffer.from(await photo.arrayBuffer())));
    } catch (err) {
        if (err instanceof SignatureImageError) throw new HttpError(400, err.message);
        throw err;
    }

    const db = createSupabaseAdmin();
    if (target.kind === 'principal') {
        const { error } = await db.from('schools').update({ principal_signature_url: image }).eq('id', access.schoolId);
        if (error) throw error;
    } else if (target.kind === 'section') {
        const { error } = await db.from('school_sections').update({ head_signature: image, updated_at: new Date().toISOString() }).eq('id', target.sectionId);
        if (error) throw error;
    } else {
        const { error } = await db.from('user_signatures').upsert(
            { user_id: target.userId, school_id: access.schoolId, image, updated_by: access.userId, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
        );
        if (error) throw error;
    }
    await audit(access, 'update', ...auditEntity(access, target));
    return readSignature(access, target);
});

/** Removes a signature (`?target=` as for GET); cards then print an empty line. */
export const DELETE = route('signatures DELETE', {}, async ({ access, request }) => {
    const target = await resolveTarget(access, request.nextUrl.searchParams.get('target'));
    const db = createSupabaseAdmin();
    const { error } = target.kind === 'principal'
        ? await db.from('schools').update({ principal_signature_url: null }).eq('id', access.schoolId)
        : target.kind === 'section'
            ? await db.from('school_sections').update({ head_signature: null, updated_at: new Date().toISOString() }).eq('id', target.sectionId)
            : await db.from('user_signatures').delete().eq('user_id', target.userId);
    if (error) throw error;
    await audit(access, 'delete', ...auditEntity(access, target));
    return readSignature(access, target);
});
