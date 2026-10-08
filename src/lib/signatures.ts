/**
 * Signatures printed on report cards and mark sheets. Client-safe: the API,
 * the web pages and the mobile app share these.
 */
import { SERVER_UPLOAD_MAX_BYTES } from './attachments';

export const SIGNATURES_URL = '/api/signatures';

/**
 * Whose signature: your own (`me`), the school's principal (admins), or a
 * staff member's by user id (admins).
 */
export type SignatureTarget = 'me' | 'principal' | (string & {});

/** Staff who sign report cards and mark sheets, and so may keep a signature. */
export const SIGNING_ROLES = ['ADMIN', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STAFF'] as const;

export interface SignatureRecord {
    /** A transparent PNG data URL, or null when none is on file. */
    image: string | null;
    /** Who it signs for, as printed under the line. */
    name: string | null;
}

/** Photos travel through the server, which refuses bodies over 4.5 MB. */
export const SIGNATURE_PHOTO_MAX_BYTES = SERVER_UPLOAD_MAX_BYTES;

export const SIGNATURE_TIPS = 'Sign in dark pen on plain white paper, then photograph just the signature, close up and in good light. The paper is removed automatically.';
