import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extensionFor, isImageType, storageSafeName, type AttachmentMimeType } from '@/lib/attachments';

/** Homework documents live apart from photos. */
export const DOCUMENT_BUCKET = 'assignment-files';
export const PHOTO_BUCKET = 'photos';

/** The signed-in, active uploader's school, or why they may not upload. */
export async function uploaderSchool(supabase: SupabaseClient): Promise<{ schoolId: string } | { error: string; status: 401 | 403 }> {
    const { userId } = await auth();
    if (!userId) return { error: 'Unauthorized', status: 401 };
    const { data: profile } = await supabase.from('users').select('school_id, is_active').eq('id', userId).maybeSingle();
    if (!profile || profile.is_active === false) return { error: 'Unauthorized', status: 401 };
    if (!profile.school_id) return { error: 'No school associated', status: 403 };
    return { schoolId: profile.school_id as string };
}

/**
 * Where an attachment is stored: a random folder keeps the link unguessable,
 * and the original name inside it is what teachers and learners see
 * ("…/attachments/1712_9f…/Fractions-worksheet.pdf").
 */
export function attachmentTarget(schoolId: string, fileName: string, type: AttachmentMimeType): { bucket: string; path: string } {
    const folder = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    return {
        bucket: isImageType(type) ? PHOTO_BUCKET : DOCUMENT_BUCKET,
        path: `${schoolId}/attachments/${folder}/${storageSafeName(fileName)}.${extensionFor(type)}`,
    };
}

/**
 * How a client sends a file to a signed upload link. The project's public key
 * is a publishable key (sb_publishable_…), which the storage gateway takes as
 * `apikey` only; as a Bearer token it would be refused.
 */
export function signedUploadHeaders(): Record<string, string> {
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return publicKey ? { apikey: publicKey } : {};
}
